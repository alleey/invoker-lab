import { SPELLS, type Spell } from './spells';

/**
 * One challenge: a sequence of distinct spells to cast in order.
 *
 * Distinct is not a nicety — a real Invoker cannot cast the same spell twice in
 * a row because it is on cooldown, so a combination that repeated one would be
 * training something you can never do.
 */
export type Combo = readonly Spell[];

function shuffled(pool: readonly Spell[]): Spell[] {
  const out = [...pool];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as Spell, out[i] as Spell];
  }
  return out;
}

/**
 * Draw a combination of one of `sizes` spells from `pool`.
 *
 * `avoid` is the spell that ended the previous combination — it is kept out of
 * the first position so nothing repeats back to back across the seam either.
 * With a pool of one that is impossible, so the constraint is dropped rather
 * than looped on forever.
 */
export function drawCombo(
  sizes: readonly number[],
  avoid?: Spell | null,
  pool: readonly Spell[] = SPELLS,
): Spell[] {
  if (sizes.length === 0) return [];
  const source = pool.length > 0 ? pool : SPELLS;
  const size = Math.min(sizes[Math.floor(Math.random() * sizes.length)] ?? 1, source.length);

  // The shuffle already guarantees no repeats inside the combination; the only
  // thing worth retrying is an unlucky first pick.
  if (avoid && source.length > 1) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const combo = shuffled(source).slice(0, size);
      if (combo[0]?.id !== avoid.id) return combo;
    }
  }
  return shuffled(source).slice(0, size);
}
