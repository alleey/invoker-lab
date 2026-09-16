import { ALL_ORBS, SPELLS, type Orb, type Spell } from './spells';

export const MAX_ORBS = 3;

/**
 * Orb order never matters in Dota — only the multiset does. Sorting the reagent
 * names gives a stable key, so quas/quas/wex and wex/quas/quas both resolve to
 * Ghost Walk.
 */
export function signature(orbs: readonly Orb[]): string {
  return [...orbs].sort().join('|');
}

const BY_SIGNATURE: ReadonlyMap<string, Spell> = new Map(SPELLS.map((s) => [signature(s.orbs), s]));

/** Orbs are a FIFO of three: a fourth pushes the oldest out. */
export function pushOrb(queue: readonly Orb[], orb: Orb): Orb[] {
  return [...queue, orb].slice(-MAX_ORBS);
}

export function spellFor(orbs: readonly Orb[]): Spell | null {
  if (orbs.length !== MAX_ORBS) return null;
  return BY_SIGNATURE.get(signature(orbs)) ?? null;
}

/**
 * The shortest run of orb presses that turns `current` into `target`'s reagent
 * set, given the FIFO. Brute force over every sequence of length 0..3 — at most
 * 40 candidates, so this is cheaper than memoising it.
 *
 * Holding [quas, quas, exort] and needing Ice Wall returns []. Needing EMP
 * returns three Wex. Returning the sequence and not just its length is what
 * lets the drill show you the route you missed.
 */
export function optimalRoute(current: readonly Orb[], target: readonly Orb[]): Orb[] {
  const want = signature(target);
  for (let length = 0; length <= MAX_ORBS; length++) {
    const candidates = 3 ** length;
    for (let n = 0; n < candidates; n++) {
      const seq: Orb[] = [];
      for (let i = 0, x = n; i < length; i++, x = Math.floor(x / 3)) {
        seq.push(ALL_ORBS[x % 3] as Orb);
      }
      const next = [...current, ...seq].slice(-MAX_ORBS);
      if (next.length === MAX_ORBS && signature(next) === want) return seq;
    }
  }
  return [...target].slice(0, MAX_ORBS);
}

export function minOrbPresses(current: readonly Orb[], target: readonly Orb[]): number {
  return optimalRoute(current, target).length;
}
