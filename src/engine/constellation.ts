import { signature } from './orbs';
import { SPELLS, type Orb, type Spell } from './spells';

export type Pt = readonly [number, number];

/**
 * A spell's place on the reagent simplex: how many Quas, Wex and Exort it takes.
 * Every three-reagent combination is one lattice point, which is why the ten
 * spells fall naturally into a triangle rather than a list.
 */
export interface Node {
  q: number;
  w: number;
  e: number;
  spell: Spell;
}

export interface Geo {
  cx: number;
  cy: number;
  R: number;
  Q: Pt;
  W: Pt;
  E: Pt;
  /** Barycentric to screen: weights are reagent counts, not normalised. */
  at(q: number, w: number, e: number): Pt;
}

const BY_SIGNATURE = new Map(SPELLS.map((s) => [signature(s.orbs), s]));

const build = (): Node[] => {
  const out: Node[] = [];
  for (let q = 0; q <= 3; q++) {
    for (let w = 0; w <= 3 - q; w++) {
      const e = 3 - q - w;
      const orbs: Orb[] = [
        ...Array<Orb>(q).fill('quas'),
        ...Array<Orb>(w).fill('wex'),
        ...Array<Orb>(e).fill('exort'),
      ];
      const spell = BY_SIGNATURE.get(signature(orbs));
      if (spell) out.push({ q, w, e, spell });
    }
  }
  return out;
};

export const NODES: readonly Node[] = build();

/**
 * Two spells are neighbours when swapping a single reagent turns one into the
 * other — a Manhattan distance of two on the lattice, since one count drops as
 * another rises. Those are exactly the one-keypress moves.
 */
export const EDGES: readonly (readonly [Node, Node])[] = (() => {
  const out: [Node, Node][] = [];
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const a = NODES[i] as Node;
      const b = NODES[j] as Node;
      if (Math.abs(a.q - b.q) + Math.abs(a.w - b.w) + Math.abs(a.e - b.e) === 2) out.push([a, b]);
    }
  }
  return out;
})();

export const nodeOf = (id: string): Node | undefined => NODES.find((n) => n.spell.id === id);

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/**
 * The triangle is pushed right of centre on wide screens so it sits between the
 * left rail and the right panels rather than under either. Whatever `cx` lands
 * on is published as --cx, and the altar and chain hang off that same value.
 */
export function geom(W: number, H: number): Geo {
  const narrow = W < 760;
  const cx = narrow ? W / 2 : W * 0.53;
  const cy = narrow ? H * 0.38 : H * 0.45;
  const R = narrow ? Math.min(W * 0.42, H * 0.28) : clamp(Math.min(W * 0.215, H * 0.345), 120, 360);
  const Q: Pt = [cx, cy - R];
  const Wc: Pt = [cx - R * 0.866, cy + R * 0.5];
  const E: Pt = [cx + R * 0.866, cy + R * 0.5];
  return {
    cx,
    cy,
    R,
    Q,
    W: Wc,
    E,
    at: (q, w, e) => [(q * Q[0] + w * Wc[0] + e * E[0]) / 3, (q * Q[1] + w * Wc[1] + e * E[1]) / 3],
  };
}

export function counts(orbs: readonly Orb[]): [number, number, number] {
  let q = 0;
  let w = 0;
  let e = 0;
  for (const o of orbs) {
    if (o === 'quas') q++;
    else if (o === 'wex') w++;
    else e++;
  }
  return [q, w, e];
}

/**
 * Where the "you are here" marker belongs. A partial queue is spread evenly
 * across the reagents it has yet to commit to, so the marker drifts in from the
 * middle rather than snapping to a corner on the first keypress.
 */
export function markerTarget(geo: Geo, orbs: readonly Orb[]): Pt {
  const c = counts(orbs);
  const spare = (3 - orbs.length) / 3;
  return geo.at(c[0] + spare, c[1] + spare, c[2] + spare);
}
