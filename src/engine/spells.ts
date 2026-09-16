/**
 * Reagents are named, never keyed. The three orbs are `quas | wex | exort`
 * throughout the engine — what key produces them is a binding concern and
 * lives entirely in `bindings.ts`.
 */
export type Orb = 'quas' | 'wex' | 'exort';

export interface OrbInfo {
  name: string;
  hex: string;
  element: string;
}

export const ORB_INFO: Record<Orb, OrbInfo> = {
  quas: { name: 'Quas', hex: '#5ad1ff', element: 'Ice' },
  wex: { name: 'Wex', hex: '#b476ff', element: 'Storm' },
  exort: { name: 'Exort', hex: '#ff7d3a', element: 'Fire' },
};

export const ALL_ORBS: readonly Orb[] = ['quas', 'wex', 'exort'];

export type GlyphName =
  | 'snap' | 'ghost' | 'wall' | 'emp' | 'tornado'
  | 'alacrity' | 'sun' | 'forge' | 'meteor' | 'blast';

export interface Spell {
  id: string;
  name: string;
  orbs: readonly [Orb, Orb, Orb];
  tag: string;
  glyph: GlyphName;
}

const q: Orb = 'quas';
const w: Orb = 'wex';
const e: Orb = 'exort';

export const SPELLS: readonly Spell[] = [
  { id: 'coldsnap', name: 'Cold Snap', orbs: [q, q, q], tag: 'Damage re-applies a mini-stun', glyph: 'snap' },
  { id: 'ghostwalk', name: 'Ghost Walk', orbs: [q, q, w], tag: 'Invisibility, you slow, they slow', glyph: 'ghost' },
  { id: 'icewall', name: 'Ice Wall', orbs: [q, q, e], tag: 'A wall of shards that grips and burns', glyph: 'wall' },
  { id: 'emp', name: 'EMP', orbs: [w, w, w], tag: 'Delayed blast, drinks mana', glyph: 'emp' },
  { id: 'tornado', name: 'Tornado', orbs: [q, w, w], tag: 'Lifts everything in the lane', glyph: 'tornado' },
  { id: 'alacrity', name: 'Alacrity', orbs: [w, w, e], tag: 'Attack speed and damage, on an ally', glyph: 'alacrity' },
  { id: 'sunstrike', name: 'Sun Strike', orbs: [e, e, e], tag: 'Global, delayed, unforgiving', glyph: 'sun' },
  { id: 'forge', name: 'Forge Spirit', orbs: [q, e, e], tag: 'Two spirits that melt armour', glyph: 'forge' },
  { id: 'meteor', name: 'Chaos Meteor', orbs: [w, e, e], tag: 'Rolls, burns, keeps rolling', glyph: 'meteor' },
  { id: 'blast', name: 'Deafening Blast', orbs: [q, w, e], tag: 'Knockback, damage and disarm in a line', glyph: 'blast' },
];

export const SPELL_BY_ID: ReadonlyMap<string, Spell> = new Map(SPELLS.map((s) => [s.id, s]));

/** The orb a spell leans on, used to tint its glyph. `null` when all three differ. */
export function dominantOrb(orbs: readonly Orb[]): Orb | null {
  const counts = new Map<Orb, number>();
  for (const o of orbs) counts.set(o, (counts.get(o) ?? 0) + 1);
  for (const [orb, n] of counts) if (n >= 2) return orb;
  return null;
}
