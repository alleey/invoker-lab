import type { Orb } from './spells';

export type ModeId = 'rapid' | 'combo' | 'efficient' | 'crucible' | 'practice';

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

/** What a mode's score actually is. Professional is scored on its routing. */
export type ScoreBy = 'casts' | 'streak' | 'efficiency';

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
  /** Time added per landed spell, so a good run extends itself. */
  bonusMs: number;
  /**
   * Judge each challenge against its shortest possible route and report the
   * share. True everywhere a target is handed out — routing is the skill, and
   * it is worth knowing in a streak drill as much as in Professional.
   */
  trackEfficiency: boolean;
  /**
   * Seconds-per-spell shot clock. Empty means a spell waits for you forever.
   * When set, running out is a failure exactly like casting the wrong thing.
   */
  spellTimeoutOptions: readonly number[];
  defaultSpellTimeout: number;
  /** Move on after a failure instead of making you fix it. */
  advanceOnMiss: boolean;
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
    scoring: 'Each clean cast counts one and adds two seconds back to the clock.',
    ends: 'When the clock runs out.',
    reveal: 'name',
    comboSizes: [1],
    durationOptions: CLOCKS,
    defaultDuration: 60_000,
    bonusMs: 2_000,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'casts',
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
    scoring:
      'Each landed spell adds two seconds. No spell repeats inside a combination — it would be on cooldown.',
    ends: 'When the clock runs out.',
    reveal: 'name',
    comboSizes: [2, 3, 4],
    durationOptions: CLOCKS,
    defaultDuration: 60_000,
    bonusMs: 2_000,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'casts',
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
      'Par covers the entire chain, so pre-invoking and orb carry-over count as the savings they are. Your score is the share of chains you routed perfectly.',
    ends: 'When the clock runs out.',
    reveal: 'name',
    comboSizes: [2, 3, 4],
    durationOptions: CLOCKS,
    defaultDuration: 120_000,
    bonusMs: 2_000,
    trackEfficiency: true,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'efficiency',
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
    bonusMs: 0,
    trackEfficiency: true,
    spellTimeoutOptions: [1_000, 2_000, 3_000],
    defaultSpellTimeout: 2_000,
    advanceOnMiss: true,
    scoreBy: 'streak',
  },
  practice: {
    id: 'practice',
    label: 'Free casting',
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
    bonusMs: 0,
    trackEfficiency: false,
    spellTimeoutOptions: [],
    defaultSpellTimeout: 0,
    advanceOnMiss: false,
    scoreBy: 'casts',
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
export const MODE_ORDER: readonly ModeId[] = ['rapid', 'combo', 'crucible', 'efficient'];

/** The sandbox's copy. Not a mode you can select — see MODE_ORDER. */
export const PRACTICE = MODES.practice;

export const isTimed = (mode: Mode): boolean => mode.durationOptions.length > 0;
