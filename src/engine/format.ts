/** Numbers as the interface says them. One place, so every panel agrees. */

/** Cast times are always two decimals — "1.2s" and "1.24s" in one column jitter. */
export const sec = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Accuracy bands, shared by the ring, the table cell and the result chips so a
 * spell is never "solid" in one place and "weak" in another.
 */
export const tier = (a: number): 'solid' | 'ok' | 'weak' => (a >= 0.9 ? 'solid' : a >= 0.7 ? 'ok' : 'weak');

/** Deepen a hex for the far side of a sphere's gradient. */
export const dark = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  const d = (v: number) => Math.round(v * 0.3);
  return `rgb(${d((n >> 16) & 255)},${d((n >> 8) & 255)},${d(n & 255)})`;
};
