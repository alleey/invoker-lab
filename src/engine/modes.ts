import type { Orb } from './spells';

export type ModeId = 'rapid' | 'combo' | 'efficient' | 'crucible' | 'daredevil' | 'practice';

/** What the drill tells you about the spell you owe it. */
export type Reveal = 'name' | 'sigil' | 'none';

/**
 * A worked example, rendered in the player's own keys. Prose can describe a
 * rule; only a concrete case shows it.
 */
export interface ModeExample {
  setup: string;
  ask: string;
  efficient: { orbs: readonly Orb[]; note: string };
  wasteful: { orbs: readonly Orb[]; note: string };
}

/**
 * What a mode's score actually is — the one number its record is kept on.
 * Each mode keeps the number it is really about, so a personal best means
 * something specific rather than "you played for longer".
 */
export type ScoreBy = 'casts' | 'streak' | 'efficientSpells';

export interface Mode {
  id: ModeId;
  label: string;
  /** What you are trying to do, in the second person. */
  goal: string;
  /** The loop, in order. Three steps or fewer — this is read while impatient. */
  steps: readonly string[];
  scoring: string;
  ends: string;
  reveal: Reveal;
  /**
   * How many spells make up one challenge. `[1]` is a single spell; `[2, 3, 4]`
   * draws a combination of that many, never repeating one inside it.
   * Empty means the mode hands out no targets at all.
   */
  comboSizes: readonly number[];
  /** Selectable clock lengths in ms. Empty means untimed. */
  durationOptions: readonly number[];
  defaultDuration: number;
  /**
   * Judge each challenge against its shortest possible route and report the
   * share. True everywhere a target is handed out — routing is the skill, and
   * it is worth knowing in a streak drill as much as in Professional.
   */
  trackEfficiency: boolean;
  /**
   * Seconds-per-spell limit. Empty means a spell waits for you forever.
   * When set, running out is a failure exactly like casting the wrong thing.
   */
  spellTimeoutOptions: readonly number[];
  defaultSpellTimeout: number;
  /** Move on after a failure instead of making you fix it. */
  advanceOnMiss: boolean;
  /** A single miss ends the run outright. */
  endOnMiss: boolean;
  /** A single wasted keypress ends the run outright. */
  endOnWaste: boolean;
  /** Nothing is configurable — the constraints are the mode. */
  fixed: boolean;
  /** Which of the run's numbers is the headline on the results page. */
  scoreBy: ScoreBy;
  example?: ModeExample;
}

const CLOCKS = [60_000, 120_000, 180_000] as const;

export const MODES: Record<ModeId, Mode> = {
  rapid: {
    id: 'rapid',
    label: 'Streak',
    goal: 'Turn a spell name into a cast before you have to think about it.',
    steps: [
      'A spell name appears. The same one never comes up twice running.',
      'Stack its three reagents with your orb keys.',
      'Invoke, then cast from the slot it lands in.',
    ],
    scoring: 'Each clean cast counts one. The clock does not stop or stretch.',
    ends: 'When the clock runs out.',
    reveal: 'name',
    comboSizes: [1],
    durationOptions: CLOCKS,
    defaultDuration: 60_000,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'streak',
    endOnMiss: false,
    endOnWaste: false,
    fixed: false,
  },
  combo: {
    id: 'combo',
    label: 'Combos',
    goal: 'Chain spells in sequence, the way an actual fight asks you to.',
    steps: [
      'A combination of two to four spells appears, in cast order.',
      'Work through it left to right, one spell at a time.',
      'The combination only counts once every spell in it has landed.',
    ],
    scoring: 'No spell repeats inside a combination — it would be on cooldown.',
    ends: 'When the clock runs out.',
    reveal: 'name',
    comboSizes: [2, 3, 4],
    durationOptions: CLOCKS,
    defaultDuration: 60_000,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'streak',
    endOnMiss: false,
    endOnWaste: false,
    fixed: false,
  },
  efficient: {
    id: 'efficient',
    label: 'PRO',
    goal: 'Route a whole combination in the fewest keys it can possibly take.',
    steps: [
      'The same chains as Combos, drawn the same way.',
      'Load two spells before you cast anything, and stack the third’s reagents while the first two are still going out.',
      'The whole chain is judged against its shortest possible route — not each spell on its own.',
    ],
    scoring:
      'Par covers the entire chain, so pre-invoking and orb carry-over count as the savings they are. Your score is how many spells you landed by the shortest route.',
    ends: 'When the clock runs out.',
    reveal: 'name',
    comboSizes: [2, 3, 4],
    durationOptions: CLOCKS,
    defaultDuration: 120_000,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'efficientSpells',
    endOnMiss: false,
    endOnWaste: false,
    fixed: false,
    example: {
      setup: 'You have just cast Chaos Meteor, so you are still holding Wex, Exort, Exort.',
      ask: 'Next in the chain is Sun Strike — three Exort.',
      efficient: {
        orbs: ['exort'],
        note: 'One Exort pushes the Wex out of the queue and leaves three Exort behind. You already had two of them.',
      },
      wasteful: {
        orbs: ['exort', 'exort', 'exort'],
        note: 'Stacking all three from scratch reaches exactly the same place, two keys later.',
      },
    },
  },
  crucible: {
    id: 'crucible',
    label: 'Rapid Fire',
    goal: 'Land a spell inside a few seconds, over and over, without breaking the run.',
    steps: [
      'A spell appears with its own countdown — one, two or three seconds.',
      'Cast it before the bar empties.',
      'Running out of time or casting the wrong spell both break the streak, and the next spell comes straight away.',
    ],
    scoring: 'Your score is the longest unbroken streak, not the total.',
    ends: 'When the session clock runs out.',
    reveal: 'name',
    comboSizes: [1],
    durationOptions: CLOCKS,
    defaultDuration: 60_000,
    trackEfficiency: true,
    spellTimeoutOptions: [1_000, 2_000, 3_000],
    defaultSpellTimeout: 2_000,
    advanceOnMiss: true,
    scoreBy: 'casts',
    endOnMiss: false,
    endOnWaste: false,
    fixed: false,
  },
  daredevil: {
    id: 'daredevil',
    label: 'Dare Devil',
    goal: 'Keep a perfect run alive. A second and a half a spell, and one mistake of any kind ends it.',
    steps: [
      'A spell appears with a second and a half on it. No settings, no session clock.',
      'Land it — and land it by the shortest route from where you stand.',
      'A wrong cast, a wasted keypress or the time running out all end the run there.',
    ],
    scoring: 'Your score is how many you landed before it ended.',
    ends: 'On your first mistake. Nothing else stops it.',
    reveal: 'name',
    comboSizes: [1],
    durationOptions: [],
    defaultDuration: 0,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 1_500,
    advanceOnMiss: false,
    scoreBy: 'streak',
    endOnMiss: true,
    endOnWaste: true,
    fixed: true,
  },
  practice: {
    id: 'practice',
    label: 'Practice',
    goal: 'Cast anything you like, with nothing on the line.',
    steps: [
      'Stack any three reagents. A fourth pushes the oldest one out.',
      'Invoke to see what they make.',
      'Cast from either slot.',
    ],
    scoring: 'Nothing is scored and nothing is recorded here.',
    ends: 'Never. Press Done when you have had enough.',
    reveal: 'none',
    comboSizes: [],
    durationOptions: [],
    defaultDuration: 0,
    trackEfficiency: false,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'casts',
    endOnMiss: false,
    endOnWaste: false,
    fixed: false,
  },
};

/**
 * Ordered by what each one asks of you: learn the spells, chain them, do it
 * under a clock, then do it by the shortest possible route.
 *
 * `practice` is deliberately absent. It is not a fifth way to play — it is the
 * free-casting sandbox, reachable from inside any mode, and listing it beside
 * the four drills said the opposite.
 */
export const MODE_ORDER: readonly ModeId[] = ['rapid', 'combo', 'crucible', 'efficient', 'daredevil'];

/** The sandbox's copy. Not a mode you can select — see MODE_ORDER. */
export const PRACTICE = MODES.practice;

export const isTimed = (mode: Mode): boolean => mode.durationOptions.length > 0;
