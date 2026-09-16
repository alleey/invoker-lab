import { pushOrb, spellFor } from './orbs';
import { invokeInto, type Slots } from './slots';
import { ALL_ORBS, type Orb, type Spell } from './spells';

interface Node {
  orbs: Orb[];
  slots: Slots;
  /** How many spells of the chain have been cast. */
  step: number;
}

const encode = (n: Node): string =>
  `${n.orbs.join(',')}|${n.slots[0]?.id ?? '-'}|${n.slots[1]?.id ?? '-'}|${n.step}`;

/** Nothing sane needs this many keys; it only stops a bug becoming a hang. */
const MAX_DEPTH = 48;

/**
 * Fewest keypresses to cast a whole chain in order, starting from the orbs and
 * slots you currently hold.
 *
 * Judging each spell on its own is wrong, because the real skill is spreading
 * work across the chain: loading two spells before the fight, stacking the
 * third's reagents while the first two are still being cast. Those presses
 * belong to the chain, not to whichever spell happened to be next when you made
 * them. So the whole sequence is priced at once.
 *
 * Breadth-first over (orbs, slots, spells cast) with every action costing one:
 * press a reagent, invoke what the queue currently spells, or cast the spell the
 * chain wants next from either slot. A few thousand states for a four-spell
 * chain, so it runs in well under a millisecond.
 */
export function optimalChainCost(
  combo: readonly Spell[],
  orbs: readonly Orb[],
  slots: Slots,
): number {
  if (combo.length === 0) return 0;

  const start: Node = { orbs: [...orbs], slots, step: 0 };
  let frontier: Node[] = [start];
  const seen = new Set<string>([encode(start)]);
  let depth = 0;

  while (frontier.length > 0 && depth <= MAX_DEPTH) {
    const next: Node[] = [];

    for (const node of frontier) {
      if (node.step === combo.length) return depth;

      for (const orb of ALL_ORBS) {
        const candidate: Node = { orbs: pushOrb(node.orbs, orb), slots: node.slots, step: node.step };
        const key = encode(candidate);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(candidate);
        }
      }

      const ready = spellFor(node.orbs);
      if (ready) {
        const candidate: Node = {
          orbs: node.orbs,
          slots: invokeInto(node.slots, ready),
          step: node.step,
        };
        const key = encode(candidate);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(candidate);
        }
      }

      // Casting a spell the chain does not want next is never part of a
      // shortest solution, so those branches are simply not generated.
      const target = combo[node.step];
      if (target && (node.slots[0]?.id === target.id || node.slots[1]?.id === target.id)) {
        const candidate: Node = { orbs: node.orbs, slots: node.slots, step: node.step + 1 };
        const key = encode(candidate);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(candidate);
        }
      }
    }

    frontier = next;
    depth++;
  }

  return depth;
}
