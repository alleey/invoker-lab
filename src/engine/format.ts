/** Numbers as the interface says them. One place, so every panel agrees. */

/** Cast times are always two decimals — "1.2s" and "1.24s" in one column jitter. */
export const sec = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * A session length, in minutes. Session clocks are whole minutes, so "3 min"
 * reads at a glance where "180s" has to be divided first. Anything shorter than
 * a minute — a spell time — stays in seconds, where it belongs.
 */
export const mins = (ms: number): string => (ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000} min`);

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

/** What a mode's score counts, in the player's words. */
export const scoreUnit = (by: 'casts' | 'streak' | 'efficientSpells'): string =>
  by === 'streak' ? 'longest streak' : by === 'efficientSpells' ? 'spells at par' : 'spells landed';

/**
 * How long ago, in the coarsest unit that is still true.
 *
 * A record that has stood for a month reads differently from one set an hour
 * ago, and that context is the whole reason the board carries a timestamp.
 */
export function ago(at: number | undefined, now: number = Date.now()): string {
  if (!at || !Number.isFinite(at)) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.round(mo / 12)}y ago`;
}
