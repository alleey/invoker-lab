import { SPELL_BY_ID, SPELLS, type Spell } from './spells';

/**
 * Lifetime record for one spell, accumulated across every drill.
 * `bestMs` of 0 means "never landed", so it reads as absent rather than instant.
 */
export interface SpellStat {
  hits: number;
  misses: number;
  totalMs: number;
  bestMs: number;
  /** Chains routed by the shortest possible path. Only Professional judges these. */
  efficient: number;
  /** Casts that were judged either way, and so the denominator for efficiency. */
  judged: number;
}

export type SpellStats = Record<string, SpellStat>;

export interface Stats {
  spells: SpellStats;
  /** Best score per mode. */
  modes: Record<string, number>;
  drills: number;
  /** Chains judged for routing, and how many took the shortest route.
   *  Efficiency belongs to a chain, not a spell — see engine/planner.ts. */
  chains: number;
  chainsOptimal: number;
}

export const EMPTY_SPELL_STAT: SpellStat = {
  hits: 0,
  misses: 0,
  totalMs: 0,
  bestMs: 0,
  efficient: 0,
  judged: 0,
};

export const EMPTY_STATS: Stats = { spells: {}, modes: {}, drills: 0, chains: 0, chainsOptimal: 0 };

export function statFor(stats: Stats, spellId: string): SpellStat {
  return stats.spells[spellId] ?? EMPTY_SPELL_STAT;
}

export interface CastOutcome {
  landed: boolean;
  ms?: number;
  /** null when this mode does not judge routes, so the denominator stays honest. */
  efficient?: boolean | null;
}

/**
 * Fold one cast into a spell table. Shared so the lifetime record and the
 * current run accumulate through exactly the same arithmetic — a run that
 * disagreed with the total would be worse than no run stats at all.
 */
export function foldCast(spells: SpellStats, spellId: string, outcome: CastOutcome): SpellStats {
  const next: SpellStat = { ...EMPTY_SPELL_STAT, ...(spells[spellId] ?? EMPTY_SPELL_STAT) };
  if (outcome.landed) {
    const ms = Math.round(outcome.ms ?? 0);
    next.hits += 1;
    next.totalMs += ms;
    next.bestMs = next.bestMs === 0 ? ms : Math.min(next.bestMs, ms);
    if (outcome.efficient !== null && outcome.efficient !== undefined) {
      next.judged += 1;
      if (outcome.efficient) next.efficient += 1;
    }
  } else {
    next.misses += 1;
  }
  return { ...spells, [spellId]: next };
}

/**
 * Credit one chain's routing verdict to every spell that took part in it.
 *
 * Routing is a property of the sequence, so each member spell records "was in a
 * chain that routed optimally" rather than a verdict of its own — which is the
 * only honest per-spell reading once pre-invoking moves work between steps.
 */
export function creditChain(
  spells: SpellStats,
  spellIds: readonly string[],
  optimal: boolean,
): SpellStats {
  const next = { ...spells };
  for (const id of new Set(spellIds)) {
    const stat = { ...EMPTY_SPELL_STAT, ...(next[id] ?? EMPTY_SPELL_STAT) };
    stat.judged += 1;
    if (optimal) stat.efficient += 1;
    next[id] = stat;
  }
  return next;
}

export interface Summary {
  hits: number;
  misses: number;
  spellsSeen: number;
  accuracy: number | null;
  efficiency: number | null;
}

/** Totals across a spell table, for the line above the list. */
export function summarise(spells: SpellStats): Summary {
  let hits = 0;
  let misses = 0;
  let efficient = 0;
  let judged = 0;
  let spellsSeen = 0;
  for (const stat of Object.values(spells)) {
    if (stat.hits + stat.misses > 0) spellsSeen++;
    hits += stat.hits;
    misses += stat.misses;
    efficient += stat.efficient;
    judged += stat.judged;
  }
  const attempted = hits + misses;
  return {
    hits,
    misses,
    spellsSeen,
    accuracy: attempted === 0 ? null : hits / attempted,
    efficiency: judged === 0 ? null : efficient / judged,
  };
}

export const attempts = (stat: SpellStat): number => stat.hits + stat.misses;

/** 0..1, or null when the spell has never come up. */
export function accuracy(stat: SpellStat): number | null {
  const total = attempts(stat);
  return total === 0 ? null : stat.hits / total;
}

/** 0..1, or null when no cast of this spell has ever been judged for route. */
export function efficiency(stat: SpellStat): number | null {
  return stat.judged === 0 ? null : stat.efficient / stat.judged;
}

/** Mean time for the full chain, or null when it has never landed. */
export function averageMs(stat: SpellStat): number | null {
  return stat.hits === 0 ? null : stat.totalMs / stat.hits;
}

/** Share of judged chains routed optimally, or null when none have been. */
export function overallEfficiency(stats: Stats): number | null {
  return stats.chains === 0 ? null : stats.chainsOptimal / stats.chains;
}

export interface Ranked {
  spell: Spell;
  stat: SpellStat;
  accuracy: number;
  averageMs: number;
}

/**
 * Spells with enough history to judge, worst first.
 *
 * Ordered by accuracy, then by speed — a spell you always get right but slowly
 * is a different problem from one you fumble, and accuracy is the worse of the
 * two, so it leads.
 */
export function ranked(stats: Stats, minAttempts = 3): Ranked[] {
  const rows: Ranked[] = [];
  for (const [id, stat] of Object.entries(stats.spells)) {
    const spell = SPELL_BY_ID.get(id);
    const acc = accuracy(stat);
    const avg = averageMs(stat);
    if (!spell || acc === null || avg === null) continue;
    if (attempts(stat) < minAttempts) continue;
    rows.push({ spell, stat, accuracy: acc, averageMs: avg });
  }
  rows.sort((a, b) => a.accuracy - b.accuracy || b.averageMs - a.averageMs);
  return rows;
}

/**
 * The `size` spells most worth drilling, worst first.
 *
 * A spell you have never cast outranks every spell you have, however badly:
 * untested is exactly the gap a weakness drill exists to close, and ranking it
 * by an accuracy it does not have would bury it forever. After that it is
 * accuracy first, then slowness.
 */
export function weakestSpells(stats: Stats, size: number): Spell[] {
  const scored = SPELLS.map((spell) => {
    const stat = statFor(stats, spell.id);
    return {
      spell,
      untested: attempts(stat) === 0,
      accuracy: accuracy(stat) ?? 0,
      averageMs: averageMs(stat) ?? 0,
    };
  });

  scored.sort((a, b) => {
    if (a.untested !== b.untested) return a.untested ? -1 : 1;
    return a.accuracy - b.accuracy || b.averageMs - a.averageMs;
  });

  return scored.slice(0, Math.max(1, size)).map((row) => row.spell);
}

export interface Highlights {
  weakest: Ranked | null;
  strongest: Ranked | null;
  /** How many spells have cleared `minAttempts`. Below two, a comparison is noise. */
  judged: number;
}

export function highlights(stats: Stats, minAttempts = 3): Highlights {
  const rows = ranked(stats, minAttempts);
  if (rows.length < 2) return { weakest: null, strongest: null, judged: rows.length };
  return {
    weakest: rows[0] ?? null,
    strongest: rows[rows.length - 1] ?? null,
    judged: rows.length,
  };
}
