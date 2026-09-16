/**
 * Live DOM handles for things the render loop writes every frame.
 *
 * A deliberate escape hatch from React. The session bar, the shot clock and the
 * countdown change sixty times a second; routing that through state would
 * re-render the whole tree for a stripe. Components register their node on
 * mount, the loop writes to it directly, and React never hears about it.
 */
export interface Bars {
  tbar: HTMLElement | null;
  shot: HTMLElement | null;
  clock: HTMLElement | null;
  pzNum: HTMLElement | null;
  pzRing: SVGCircleElement | null;
}

export const bars: Bars = { tbar: null, shot: null, clock: null, pzNum: null, pzRing: null };

export const mmss = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
