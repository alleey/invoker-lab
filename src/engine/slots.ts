import { optimalRoute } from './orbs';
import type { Orb, Spell } from './spells';

export type SlotIndex = 0 | 1;
export type Slots = readonly [Spell | null, Spell | null];

export const EMPTY_SLOTS: Slots = [null, null];

/**
 * Dota's rule: a newly invoked spell always lands in the first slot, pushing the
 * previous occupant down. Invoking something already sitting in the second slot
 * promotes it instead of duplicating it — the two swap.
 *
 * Casting does NOT clear a slot (the spell just goes on cooldown), which is why
 * a loaded spell is so much cheaper to re-cast than to re-invoke.
 */
export function invokeInto(slots: Slots, spell: Spell): Slots {
  if (slots[0]?.id === spell.id) return slots;
  if (slots[1]?.id === spell.id) return [slots[1], slots[0]];
  return [spell, slots[0]];
}

export interface Par {
  orbPresses: number;
  /** The actual reagents to press, so the drill can show the route you missed. */
  route: readonly Orb[];
  needsInvoke: boolean;
  /** The slot the spell will be castable from once you've paid `orbPresses`. */
  slot: SlotIndex;
  /** orb presses + invoke (if needed) + the one cast press. */
  total: number;
}

/**
 * The cheapest full chain from here to "that spell has been cast".
 *
 * The whole point of the drill: if the target is already loaded, par is 1 press,
 * and re-invoking it is pure waste. Recognising that is the skill.
 */
export function parFor(orbs: readonly Orb[], slots: Slots, target: Spell): Par {
  if (slots[0]?.id === target.id)
    return { orbPresses: 0, route: [], needsInvoke: false, slot: 0, total: 1 };
  if (slots[1]?.id === target.id)
    return { orbPresses: 0, route: [], needsInvoke: false, slot: 1, total: 1 };
  const route = optimalRoute(orbs, target.orbs);
  return { orbPresses: route.length, route, needsInvoke: true, slot: 0, total: route.length + 2 };
}
