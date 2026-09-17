import { create } from 'zustand';
import {
  DEFAULT_PRESET_ID,
  matchesPreset,
  presetBindings,
  rebind,
  type Action,
  type Bindings,
} from './engine/bindings';
import { drawCombo } from './engine/combos';
import { isTimed, MODE_ORDER, MODES, type ModeId, type ScoreBy } from './engine/modes';
import { pushOrb, spellFor } from './engine/orbs';
import { optimalChainCost } from './engine/planner';
import { EMPTY_SLOTS, invokeInto, parFor, type Par, type SlotIndex, type Slots } from './engine/slots';
import { dominantOrb, ORB_INFO, type Orb, type Spell } from './engine/spells';
import {
  creditChain,
  EMPTY_STATS,
  foldCast,
  LOG_CAP,
  weakestSpells,
  type CastOutcome,
  type SpellStats,
  type Stats,
} from './engine/stats';
import { SPELLS } from './engine/spells';

/**
 * The `arsenal-magus` prefix predates the app's rename to Invoker Lab and is
 * kept deliberately: these keys hold every binding, setting and lifetime stat
 * anyone already has. Renaming them to match the app orphans all of it, so
 * leave them be unless you also ship a migration that copies the old keys over.
 */
const BINDINGS_KEY = 'arsenal-magus.bindings.v1';
const STATS_KEY = 'arsenal-magus.stats.v5';
/** Read once, migrated forward, then never touched again. */
const STATS_KEY_PREV = 'arsenal-magus.stats.v4';
const LENGTHS_KEY = 'arsenal-magus.lengths.v2';
const TIMEOUTS_KEY = 'arsenal-magus.timeouts.v1';
const PREFS_KEY = 'arsenal-magus.prefs.v1';

/** How many spells the weakness filter narrows the pool to. */
export const WEAK_POOL_SIZE = 6;

/** Chosen value per mode, in milliseconds. */
export type PerMode = Record<ModeId, number>;

export interface Prefs {
  /** Draw only from your weakest spells, in whatever mode you are in. */
  focusWeak: boolean;
}

const defaultLengths = (): PerMode =>
  Object.fromEntries(MODE_ORDER.map((id) => [id, MODES[id].defaultDuration])) as PerMode;

const defaultTimeouts = (): PerMode =>
  Object.fromEntries(MODE_ORDER.map((id) => [id, MODES[id].defaultSpellTimeout])) as PerMode;

export interface Verdict {
  text: string;
  tone: 'idle' | 'good' | 'bad';
}

export interface DrillResult {
  /** The number this mode is actually judged on. */
  score: number;
  scoreBy: ScoreBy;
  /** False when the player stopped the run rather than playing it out. */
  completed: boolean;
  hits: number;
  misses: number;
  combos: number;
  bestStreak: number;
  avgMs: number | null;
  /** Chains routed optimally, out of those judged. */
  efficient: number;
  judged: number;
  previousBest: number;
  isRecord: boolean;
  tracksEfficiency: boolean;
}

/** One cast, kept so the results view can show what happened spell by spell. */
export interface CastLog {
  id: string;
  ok: boolean;
  ms: number;
}

/** A finished run, retained so its breakdown outlives the run itself. */
export interface LastRun {
  mode: ModeId;
  casts: CastLog[];
  score: number;
  hits: number;
  misses: number;
  bestStreak: number;
  avgMs: number | null;
  optimalChains: number;
  judgedChains: number;
}

/** How many times a single run may be held. */
export const PAUSE_MAX = 3;

/** The three count that opens a run, and the one that releases a pause. */
export const COUNT_IN_MS = 3000;

/** The full-screen surfaces. Only one is ever open, so they cannot stack. */
export type Page = 'keyboard' | 'stats' | 'mastery' | null;

/** One-shot celebration cue. `id` changes so the same kind can fire twice running. */
export interface Celebration {
  id: number;
  kind: 'spell' | 'combo';
  text: string;
  hex: string;
  /**
   * What was cast. The flourish used to work this out from the last entry in
   * the cast log, which the sandbox never writes to — so practice drew no
   * reagent rings at all, and after a drill it drew them over whichever spell
   * had ended that run. An event should carry its own subject.
   */
  spellId: string;
}

function readJSON<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window, blocked storage — history is a convenience, not the app */
  }
}

/**
 * Stats are written on every cast, and `localStorage.setItem` is synchronous —
 * at speed that is a main-thread stall per keypress for data nobody reads until
 * the drill ends. Coalesce instead, and flush on anything that could lose it.
 */
let pendingStats: Stats | null = null;
let flushHandle: number | null = null;

function flushStats(): void {
  if (flushHandle !== null) {
    clearTimeout(flushHandle);
    flushHandle = null;
  }
  if (pendingStats) {
    writeJSON(STATS_KEY, pendingStats);
    pendingStats = null;
  }
}

function queueStats(stats: Stats): void {
  pendingStats = stats;
  if (flushHandle === null) flushHandle = window.setTimeout(flushStats, 1200);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushStats);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushStats();
  });
}

/**
 * Records that cannot be compared with anything set since.
 *
 * These three modes gave two seconds back per landed cast, so a fast player
 * topped the clock up faster than they spent it and the run never ended. The
 * scores that came out are not achievable now that a minute is a minute —
 * Streak records in the fifties against a realistic twenty.
 *
 * Dropping them is deliberate. A stale number is worse than no number: it
 * reads as a target you have already beaten, and it silently gates every
 * future leaderboard submission behind a score nobody can reach. Everything
 * else in a player's history is untouched; bumping the storage key wholesale
 * would throw away every spell's lifetime record to fix three fields.
 */
const STALE_RECORDS: readonly string[] = ['rapid', 'combo', 'efficient'];

function loadStats(): Stats {
  // The current key exists once the migration has run, so it can never run
  // twice. Doing this by key rather than by inspecting the data matters:
  // an inflated record is indistinguishable from an honest one, and a
  // migration that cannot tell the difference would erase them on every load.
  const current = localStorage.getItem(STATS_KEY);
  if (current) return readJSON<Stats>(STATS_KEY, EMPTY_STATS);

  const stats = readJSON<Stats>(STATS_KEY_PREV, EMPTY_STATS);
  const modes = { ...stats.modes };
  for (const id of STALE_RECORDS) delete modes[id];
  const migrated: Stats = { ...stats, modes };
  writeJSON(STATS_KEY, migrated);
  return migrated;
}

function spellHex(spell: Spell): string {
  const orb = dominantOrb(spell.orbs);
  return orb ? ORB_INFO[orb].hex : '#ffcf6b';
}

/** Fold one cast's outcome into the lifetime record. */
function recordCast(stats: Stats, spellId: string, outcome: CastOutcome): Stats {
  return { ...stats, spells: foldCast(stats.spells, spellId, outcome) };
}

interface State {
  bindings: Bindings;
  presetId: string | null;
  capturing: Action | null;

  mode: ModeId;
  lengths: PerMode;
  timeouts: PerMode;
  prefs: Prefs;
  running: boolean;
  endsAt: number;
  runDurationMs: number;

  orbs: Orb[];
  slots: Slots;

  /** Spells this run may draw from — narrowed when the weakness filter is on. */
  pool: Spell[];

  /** The combination in play and how far through it you are. */
  combo: Spell[];
  step: number;
  par: Par | null;
  shownAt: number;
  presses: number;
  /** Fewest keys that could complete the whole chain from where it began. */
  chainPar: number;
  /** Keys spent since this chain began — pre-invoking included. */
  chainPresses: number;
  /** The challenge after this one, drawn early so it can be shown and planned for. */
  nextCombo: Spell[];
  /** When the current spell's time expires. 0 means it never does. */
  spellEndsAt: number;
  spellTimeoutMs: number;

  hits: number;
  misses: number;
  combos: number;
  streak: number;
  bestStreak: number;
  /** Running sum, not a list: only the mean is ever read, and `hits` is the count. */
  timeTotal: number;
  /** Efficiency is judged per chain, never per spell — see engine/planner.ts. */
  optimalChains: number;
  judgedChains: number;
  /** Spells that were part of a chain routed at par — what Professional scores. */
  optimalSpells: number;

  verdict: Verdict;
  result: DrillResult | null;
  stats: Stats;
  /**
   * Per-spell record for the latest run. Survives switching modes and tabs so a
   * finished run can still be studied; only starting another run clears it.
   */
  sessionSpells: SpellStats;
  /** Which mode that run belonged to, since it can now outlive its mode. */
  sessionMode: ModeId | null;

  celebration: Celebration | null;
  shake: number;
  flash: { action: Action; id: number } | null;

  /* ── surfaces the constellation UI owns ── */
  /**
    * The star you picked, which drives the detail card. Chosen by click, not by
    * hover: on a short window the card itself scrolls, and you cannot hold a
    * hover and scroll it at the same time.
    */
  selected: Spell | null;
  kbOpen: boolean;
  statsOpen: boolean;
  masteryOpen: boolean;
  /**
   * The free-casting sandbox. Not a mode — you enter it from inside whichever
   * mode you are in and come back to that same brief, because it teaches the
   * orb queue rather than how any one drill is played.
   */
  practicing: boolean;
  /** Held drills stop every clock; the count to resume runs on its own timer. */
  paused: boolean;
  /**
   * The same hold, used to open a run rather than interrupt one.
   *
   * Deliberately the pause mechanism and not a second countdown: pausing
   * already stops every clock and pushes them all forward on release, which is
   * exactly what a starting drill needs. It costs no pause from the allowance.
   */
  starting: boolean;
  pausedAt: number;
  resumeUntil: number;
  pausesLeft: number;
  casts: CastLog[];
  lastRun: LastRun | null;

  setSelected(spell: Spell | null): void;
  setPage(page: Page): void;
  setPracticing(on: boolean): void;
  togglePause(): void;
  endPause(now: number): void;
  setMode(mode: ModeId): void;
  setLength(mode: ModeId, value: number): void;
  setSpellTimeout(mode: ModeId, value: number): void;
  setFocusWeak(on: boolean): void;
  spellTimedOut(): void;
  start(): void;
  /**
   * End the run. `abandoned` means you stopped it yourself rather than playing
   * it out — the clock running down, or a mode ending on your mistake.
   */
  finish(abandoned?: boolean): void;
  /** Close the results without clearing `lastRun` — the stats page still wants it. */
  dismissResult(): void;
  toggleRun(): void;
  castOrb(orb: Orb): void;
  invoke(): void;
  castSlot(slot: SlotIndex): void;
  clearOrbs(): void;
  markFlash(action: Action): void;
  beginCapture(action: Action): void;
  cancelCapture(): void;
  bindKey(action: Action, code: string): void;
  commitCapture(code: string): void;
  applyPreset(id: string): void;
  resetStats(): void;
}

const IDLE: Verdict = { text: '', tone: 'idle' };

export const useStore = create<State>()((set, get) => {
  const storedBindings = readJSON<Bindings>(BINDINGS_KEY, presetBindings(DEFAULT_PRESET_ID));

  /** Price the route to the spell now in front of you, from wherever you stand. */
  const aim = (
    combo: Spell[],
    step: number,
    orbs: readonly Orb[],
    slots: Slots,
    timeoutMs: number,
  ): Pick<State, 'combo' | 'step' | 'par' | 'shownAt' | 'presses' | 'spellEndsAt'> => {
    const target = combo[step];
    const now = performance.now();
    return {
      combo,
      step,
      par: target ? parFor(orbs, slots, target) : null,
      shownAt: now,
      presses: 0,
      spellEndsAt: timeoutMs > 0 ? now + timeoutMs : 0,
    };
  };

  /**
   * Open a new chain: aim at its first spell and price the whole sequence from
   * here, so pre-invoking and orb carry-over are counted as the advantages they
   * actually are rather than charged to whichever spell was next.
   */
  const beginChain = (
    combo: Spell[],
    orbs: readonly Orb[],
    slots: Slots,
    timeoutMs: number,
    sizes: readonly number[],
    pool: readonly Spell[],
  ): Pick<
    State,
    | 'combo'
    | 'step'
    | 'par'
    | 'shownAt'
    | 'presses'
    | 'spellEndsAt'
    | 'chainPar'
    | 'chainPresses'
    | 'nextCombo'
  > => ({
    ...aim(combo, 0, orbs, slots, timeoutMs),
    chainPar: optimalChainCost(combo, orbs, slots),
    chainPresses: 0,
    // Drawn now rather than when it is needed, so the board can show you what
    // is coming and you can stack for it while the current spell is still up.
    nextCombo: drawCombo(sizes, combo[combo.length - 1] ?? null, pool),
  });

  /** Whatever was shown as coming next, or a fresh draw if nothing was. */
  const takeNext = (queued: Spell[], sizes: readonly number[], prev: Spell | null, pool: Spell[]): Spell[] =>
    queued.length ? queued : drawCombo(sizes, prev, pool);

  /** Narrowed to your weakest spells when the filter is on, otherwise everything. */
  const drawPool = (focusWeak: boolean, stats: Stats): Spell[] =>
    focusWeak ? weakestSpells(stats, WEAK_POOL_SIZE) : [...SPELLS];

  return {
    bindings: storedBindings,
    presetId: matchesPreset(storedBindings),
    capturing: null,

    mode: 'rapid',
    lengths: readJSON<PerMode>(LENGTHS_KEY, defaultLengths()),
    timeouts: readJSON<PerMode>(TIMEOUTS_KEY, defaultTimeouts()),
    prefs: readJSON<Prefs>(PREFS_KEY, { focusWeak: false }),
    running: false,
    endsAt: 0,
    runDurationMs: 0,

    orbs: [],
    slots: EMPTY_SLOTS,
    pool: [...SPELLS],

    combo: [],
    step: 0,
    par: null,
    shownAt: 0,
    presses: 0,
    chainPar: 0,
    chainPresses: 0,
    nextCombo: [],
    spellEndsAt: 0,
    spellTimeoutMs: 0,

    hits: 0,
    misses: 0,
    combos: 0,
    streak: 0,
    bestStreak: 0,
    timeTotal: 0,
    optimalChains: 0,
    judgedChains: 0,
    optimalSpells: 0,

    verdict: IDLE,
    result: null,
    stats: loadStats(),
    sessionSpells: {},
    sessionMode: null,

    celebration: null,
    shake: 0,
    flash: null,

    selected: null,
    kbOpen: false,
    statsOpen: false,
    masteryOpen: false,
    practicing: false,
    paused: false,
    starting: false,
    pausedAt: 0,
    resumeUntil: 0,
    pausesLeft: PAUSE_MAX,
    casts: [],
    lastRun: null,

    setSelected(spell) {
      if (get().selected?.id !== spell?.id) set({ selected: spell });
    },

    /** Only one full-screen surface at a time, so they cannot stack. */
    setPage(page) {
      set({
        kbOpen: page === 'keyboard',
        statsOpen: page === 'stats',
        masteryOpen: page === 'mastery',
        selected: null,
      });
    },

    /**
     * Entering clears the board so the sandbox starts from nothing; leaving
     * clears it again so the mode you return to cannot be begun with reagents
     * already in hand.
     */
    setPracticing(on) {
      set({ practicing: on, orbs: [], slots: EMPTY_SLOTS, verdict: IDLE, selected: null });
    },

    /**
     * F9 holds the drill. The first press freezes, the second starts the count;
     * the board is hidden rather than frozen-and-readable, so a pause buys time
     * away rather than time to plan.
     */
    togglePause() {
      const s = get();
      if (!s.running || s.result) return;
      if (!s.paused) {
        if (s.pausesLeft <= 0) {
          set({ verdict: { text: 'No pauses left this run.', tone: 'bad' } });
          return;
        }
        set({ paused: true, pausedAt: performance.now(), resumeUntil: 0, pausesLeft: s.pausesLeft - 1 });
      } else if (!s.resumeUntil) {
        set({ resumeUntil: performance.now() + 3000 });
      }
    },

    /**
     * Every clock here is an absolute timestamp, so resuming pushes them all
     * forward by however long we were held, the countdown included. `shownAt` is
     * in that list on purpose: leave it behind and the pause is recorded as
     * reaction time, which would poison that spell's average permanently.
     */
    endPause(at) {
      const s = get();
      if (!s.paused) return;
      const delta = at - s.pausedAt;
      set({
        endsAt: s.endsAt ? s.endsAt + delta : 0,
        spellEndsAt: s.spellEndsAt ? s.spellEndsAt + delta : 0,
        shownAt: s.shownAt ? s.shownAt + delta : 0,
        paused: false,
        starting: false,
        pausedAt: 0,
        resumeUntil: 0,
      });
    },

    setMode(mode) {
      set({
        mode,
        running: false,
        practicing: false,
        result: null,
        combo: [],
        step: 0,
        par: null,
        nextCombo: [],
        hits: 0,
        misses: 0,
        combos: 0,
        streak: 0,
        bestStreak: 0,
        timeTotal: 0,
        optimalChains: 0,
        judgedChains: 0,
        optimalSpells: 0,
        verdict: IDLE,
        celebration: null,
        spellEndsAt: 0,
        // sessionSpells deliberately survives a mode change: a finished run is
        // still worth reading after wandering off to look at another mode.
      });
    },

    setLength(mode, value) {
      const lengths: PerMode = { ...get().lengths, [mode]: value };
      writeJSON(LENGTHS_KEY, lengths);
      set({ lengths });
    },

    setSpellTimeout(mode, value) {
      const timeouts: PerMode = { ...get().timeouts, [mode]: value };
      writeJSON(TIMEOUTS_KEY, timeouts);
      set({ timeouts });
    },

    setFocusWeak(on) {
      const prefs: Prefs = { ...get().prefs, focusWeak: on };
      writeJSON(PREFS_KEY, prefs);
      set({ prefs });
    },

    start() {
      const s = get();
      const config = MODES[s.mode];
      if (config.comboSizes.length === 0) return;
      const chosen = s.lengths[s.mode] || config.defaultDuration;
      const timed = isTimed(config);
      /* A mode with no shot-clock choices can still have one — Dare Devil's
         second is the mode, not a setting. Only a default of 0 means none. */
      const timeoutMs = config.spellTimeoutOptions.length
        ? s.timeouts[s.mode] || config.defaultSpellTimeout
        : config.defaultSpellTimeout;
      const pool = drawPool(s.prefs.focusWeak, s.stats);
      set({
        running: true,
        practicing: false,
        result: null,
        orbs: [],
        slots: EMPTY_SLOTS,
        pool,
        spellTimeoutMs: timeoutMs,
        hits: 0,
        misses: 0,
        combos: 0,
        streak: 0,
        bestStreak: 0,
        timeTotal: 0,
        optimalChains: 0,
        judgedChains: 0,
        optimalSpells: 0,
        endsAt: timed ? performance.now() + chosen : 0,
        runDurationMs: timed ? chosen : 0,
        sessionSpells: {},
        sessionMode: s.mode,
        casts: [],
        /* Opened on a three count. The hardest modes give you one second a
           spell from the first frame, and starting cold means the first spell
           is lost before your hands are on the keys. */
        paused: true,
        starting: true,
        pausedAt: performance.now(),
        resumeUntil: performance.now() + COUNT_IN_MS,
        pausesLeft: PAUSE_MAX,
        verdict: IDLE,
        celebration: null,
        ...beginChain(drawCombo(config.comboSizes, null, pool), [], EMPTY_SLOTS, timeoutMs, config.comboSizes, pool),
      });
    },

    /**
     * The spell time ran out. Counts against the spell exactly like a wrong
     * cast, then moves on — the pressure is the point.
     */
    spellTimedOut() {
      const s = get();
      if (!s.running) return;
      const target = s.combo[s.step];
      if (!target) return;
      const config = MODES[s.mode];
      const missed: CastOutcome = { landed: false };
      const stats = recordCast(s.stats, target.id, missed);
      queueStats(stats);
      set({
        stats,
        sessionSpells: foldCast(s.sessionSpells, target.id, missed),
        casts: [...s.casts, { id: target.id, ok: false, ms: s.spellTimeoutMs }],
        misses: s.misses + 1,
        streak: 0,
        shake: s.shake + 1,
        verdict: { text: `Out of time on ${target.name}.`, tone: 'bad' },
        ...beginChain(takeNext(s.nextCombo, config.comboSizes, target, s.pool), s.orbs, s.slots, s.spellTimeoutMs, config.comboSizes, s.pool),
      });
      if (config.endOnMiss) get().finish();
    },

    finish(abandoned = false) {
      const s = get();
      if (!s.running) return;
      const config = MODES[s.mode];
      const avgMs = s.hits > 0 ? s.timeTotal / s.hits : null;
      const previousBest = s.stats.modes[s.mode] ?? 0;
      /* Each mode keeps the number it is actually about: Rapid Fire lives or
         dies on the unbroken run, Professional on how it routed, everything
         else on how much it landed. Comparing a run against its own mode's
         record only means something if they measure the same thing. */
      const score =
        config.scoreBy === 'streak'
          ? s.bestStreak
          : config.scoreBy === 'efficientSpells'
            ? s.optimalSpells
            : s.hits;
      /* A run you stopped yourself sets nothing.
       *
       * Not only the leaderboard: the local record and the run history go
       * untouched too. Letting an abandoned run take the local best would be
       * worse than pointless — it would raise the bar that later, honestly
       * completed runs have to clear before they are ever submitted, and a
       * player could strand their own leaderboard entry by quitting well.
       * Per-spell accuracy still counts; that is practice, not a result. */
      const isRecord = !abandoned && score > previousBest;

      const stats: Stats = abandoned
        ? s.stats
        : {
            ...s.stats,
            drills: s.stats.drills + 1,
            modes: isRecord ? { ...s.stats.modes, [s.mode]: score } : s.stats.modes,
            logs: {
              ...s.stats.logs,
              [s.mode]: [...(s.stats.logs[s.mode] ?? []), score].slice(-LOG_CAP),
            },
          };
      if (!abandoned) {
        pendingStats = stats;
        flushStats();
      }

      set({
        running: false,
        combo: [],
        step: 0,
        par: null,
        nextCombo: [],
        spellEndsAt: 0,
        stats,
        celebration: null,
        paused: false,
        starting: false,
        resumeUntil: 0,
        /* Kept whole so the results view and the stats page can show that run
           after it has ended, without the live counters having to survive. */
        lastRun: {
          mode: s.mode,
          casts: [...s.casts],
          score,
          hits: s.hits,
          misses: s.misses,
          bestStreak: s.bestStreak,
          avgMs,
          optimalChains: s.optimalChains,
          judgedChains: s.judgedChains,
        },
        result: {
          score,
          scoreBy: config.scoreBy,
          completed: !abandoned,
          hits: s.hits,
          misses: s.misses,
          combos: s.combos,
          bestStreak: s.bestStreak,
          avgMs,
          efficient: s.optimalChains,
          judged: s.judgedChains,
          previousBest,
          isRecord,
          tracksEfficiency: config.trackEfficiency,
        },
      });
    },

    dismissResult() {
      set({ result: null, verdict: IDLE });
    },

    toggleRun() {
      const s = get();
      // The sandbox has nothing to start or stop; leave it first.
      if (s.practicing) return;
      // Space and the End drill button are the only manual stop there is.
      if (s.running) s.finish(true);
      else s.start();
    },

    castOrb(orb) {
      const s = get();
      set({
        orbs: pushOrb(s.orbs, orb),
        presses: s.running ? s.presses + 1 : s.presses,
        chainPresses: s.running ? s.chainPresses + 1 : s.chainPresses,
      });
    },

    invoke() {
      const s = get();
      const spell = spellFor(s.orbs);
      if (!spell) {
        set({ shake: s.shake + 1, verdict: { text: 'Three reagents first.', tone: 'bad' } });
        return;
      }
      set({
        slots: invokeInto(s.slots, spell),
        presses: s.running ? s.presses + 1 : s.presses,
        chainPresses: s.running ? s.chainPresses + 1 : s.chainPresses,
        verdict: { text: `${spell.name} loaded into slot 1.`, tone: 'idle' },
      });
    },

    castSlot(slot) {
      const s = get();
      const spell = s.slots[slot];
      if (!spell) {
        set({ shake: s.shake + 1, verdict: { text: `Slot ${slot + 1} is empty.`, tone: 'bad' } });
        return;
      }
      const presses = s.running ? s.presses + 1 : s.presses;
      const chainPresses = s.running ? s.chainPresses + 1 : s.chainPresses;
      const config = MODES[s.mode];

      // The sandbox is never recorded — that is the whole point of it.
      if (!s.running) {
        set({
          presses,
          celebration: { id: performance.now(), kind: 'spell', text: '', hex: spellHex(spell), spellId: spell.id },
          verdict: {
            text: `${spell.name} — ${spell.orbs.map((o) => ORB_INFO[o].name).join(' · ')}`,
            tone: 'good',
          },
        });
        return;
      }

      const target = s.combo[s.step];
      if (!target) return;

      if (spell.id !== target.id) {
        const missed: CastOutcome = { landed: false };
        const stats = recordCast(s.stats, target.id, missed);
        queueStats(stats);
        const penalty = {
          stats,
          sessionSpells: foldCast(s.sessionSpells, target.id, missed),
          casts: [...s.casts, { id: target.id, ok: false, ms: performance.now() - s.shownAt }],
          presses,
          misses: s.misses + 1,
          streak: 0,
          shake: s.shake + 1,
        };
        // Under a spell time there is no second chance — the next spell is
        // already up. Everywhere else you stay on it until you get it right.
        // A mode that ends on a miss has nothing to draw next; it just stops.
        if (config.endOnMiss) {
          set({ ...penalty, verdict: { text: `${spell.name}, not ${target.name}. Run over.`, tone: 'bad' } });
          get().finish();
          return;
        }
        if (config.advanceOnMiss) {
          set({
            ...penalty,
            verdict: { text: `Wrong — that was ${spell.name}, not ${target.name}.`, tone: 'bad' },
            ...beginChain(takeNext(s.nextCombo, config.comboSizes, target, s.pool), s.orbs, s.slots, s.spellTimeoutMs, config.comboSizes, s.pool),
          });
          return;
        }
        set({
          ...penalty,
          par: parFor(s.orbs, s.slots, target),
          verdict: {
            text: `You cast ${spell.name}. Next in the chain is ${target.name}.`,
            tone: 'bad',
          },
        });
        return;
      }

      // Landed. Slots and orbs persist — casting never clears a slot.
      const ms = performance.now() - s.shownAt;
      const streak = s.streak + 1;
      const nextStep = s.step + 1;
      const comboDone = nextStep >= s.combo.length;
      const isChain = s.combo.length > 1;

      // Routing is never judged per cast: pre-invoking deliberately moves work
      // between steps, so a single cast's press count means nothing on its own.
      const landed: CastOutcome = { landed: true, ms, efficient: null };
      let stats = recordCast(s.stats, target.id, landed);
      let sessionSpells = foldCast(s.sessionSpells, target.id, landed);

      const base = {
        casts: [...s.casts, { id: target.id, ok: true, ms }],
        hits: s.hits + 1,
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        timeTotal: s.timeTotal + ms,
        // The clock never moves once a run starts: a minute means a minute.
        endsAt: s.endsAt,
      };

      if (!comboDone) {
        queueStats(stats);
        set({
          ...base,
          stats,
          sessionSpells,
          verdict: { text: `${target.name} — ${(ms / 1000).toFixed(2)}s`, tone: 'good' },
          celebration: { id: performance.now(), kind: 'spell', text: '', hex: spellHex(target), spellId: target.id },
          ...aim(s.combo, nextStep, s.orbs, s.slots, s.spellTimeoutMs),
        });
        return;
      }

      // Chain complete: price what it actually took against the best possible
      // route through the whole sequence.
      const optimal = chainPresses <= s.chainPar;
      const wasted = chainPresses - s.chainPar;
      let verdict: Verdict;

      if (config.trackEfficiency) {
        const ids = s.combo.map((spell) => spell.id);
        stats = {
          ...stats,
          spells: creditChain(stats.spells, ids, optimal),
          chains: s.stats.chains + 1,
          chainsOptimal: s.stats.chainsOptimal + (optimal ? 1 : 0),
        };
        sessionSpells = creditChain(sessionSpells, ids, optimal);
        // A chain is judged as a chain; a lone spell is still judged, but it
        // reads as a cast with a note rather than as a route.
        const time = `${(ms / 1000).toFixed(2)}s`;
        if (optimal) {
          verdict = {
            text: isChain
              ? `Chain routed in ${chainPresses} keys — the shortest there is.`
              : `${target.name} — ${time}, at par.`,
            tone: 'good',
          };
        } else {
          verdict = {
            text: isChain
              ? `Chain took ${chainPresses} keys against ${s.chainPar} — ${wasted} wasted.`
              : `${target.name} — ${time}, but ${chainPresses} keys against ${s.chainPar}.`,
            tone: 'bad',
          };
        }
      } else {
        verdict = { text: `${target.name} — ${(ms / 1000).toFixed(2)}s`, tone: 'good' };
      }
      queueStats(stats);

      set({
        ...base,
        stats,
        sessionSpells,
        verdict,
        combos: s.combos + 1,
        optimalChains: s.optimalChains + (config.trackEfficiency && optimal ? 1 : 0),
        judgedChains: s.judgedChains + (config.trackEfficiency ? 1 : 0),
        optimalSpells: s.optimalSpells + (config.trackEfficiency && optimal ? s.combo.length : 0),
        celebration: {
          id: performance.now(),
          kind: isChain ? 'combo' : 'spell',
          text: isChain ? `${s.combo.length}-spell chain` : '',
          hex: spellHex(target),
          spellId: target.id,
        },
        ...beginChain(
          takeNext(s.nextCombo, config.comboSizes, target, s.pool),
          s.orbs,
          s.slots,
          s.spellTimeoutMs,
          config.comboSizes,
          s.pool,
        ),
      });
      // Landed, but over par — in a mode that allows no waste, that ends it too.
      if (config.endOnWaste && config.trackEfficiency && !optimal) get().finish();
    },

    clearOrbs() {
      set({ orbs: [], verdict: IDLE });
    },

    markFlash(action) {
      set({ flash: { action, id: performance.now() } });
    },

    beginCapture(action) {
      set({ capturing: action });
    },

    cancelCapture() {
      set({ capturing: null });
    },

    /** The drag-and-drop route, which never arms a capture in the first place. */
    bindKey(action, code) {
      const bindings = rebind(get().bindings, action, code);
      writeJSON(BINDINGS_KEY, bindings);
      set({ bindings, presetId: matchesPreset(bindings), capturing: null });
    },

    commitCapture(code) {
      const s = get();
      if (!s.capturing) return;
      s.bindKey(s.capturing, code);
    },

    applyPreset(id) {
      const bindings = presetBindings(id);
      writeJSON(BINDINGS_KEY, bindings);
      set({ bindings, presetId: id, capturing: null });
    },

    /** Wipes lifetime history. Bindings are deliberately left alone. */
    resetStats() {
      pendingStats = EMPTY_STATS;
      flushStats();
      set({ stats: EMPTY_STATS, result: null });
    },
  };
});

/* Console access in dev only, for inspecting live drill state. Stripped from
   production builds. */
if (import.meta.env.DEV) {
  (window as unknown as { __game?: unknown }).__game = useStore;
}
