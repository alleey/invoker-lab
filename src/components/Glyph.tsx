import type { GlyphName } from '../engine/spells';

/**
 * Original geometric marks, not Valve's icons — the real spell art is
 * copyrighted and can't ship here.
 */
const PATHS: Record<GlyphName, JSX.Element> = {
  snap: (
    <>
      <path d="M12 3v18M4.3 7.5l15.4 9M4.3 16.5l15.4-9" />
      <path d="M9 4.6l3 2 3-2M9 19.4l3-2 3 2" />
    </>
  ),
  ghost: (
    <>
      <path d="M12 3.2c3.1 0 5.3 2.3 5.3 5.4v11l-2.2-1.6L13 19.6l-1-1.6-1 1.6-2.1-1.6-2.2 1.6v-11C6.7 5.5 8.9 3.2 12 3.2z" />
      <path d="M10 9.5h.01M14 9.5h.01" />
    </>
  ),
  wall: <path d="M3 20h18M5 20l1.8-8L8.6 20M10.2 20L12 5l1.8 15M15.4 20l1.8-9 1.8 9" />,
  emp: (
    <>
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="5.6" opacity="0.6" />
      <circle cx="12" cy="12" r="9.2" opacity="0.32" />
    </>
  ),
  tornado: <path d="M4 5.5h16M6 9.2h12M8.4 13h7.2M10.2 16.6h3.6M11 20h2" />,
  alacrity: <path d="M5 5.5l6.2 6.5L5 18.5M12.5 5.5l6.2 6.5-6.2 6.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.6M12 19v2.6M2.4 12h2.6M19 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" />
    </>
  ),
  forge: (
    <>
      <path d="M12 2.8s4.4 4.3 4.4 7.6a4.4 4.4 0 11-8.8 0C7.6 7.1 12 2.8 12 2.8z" />
      <path d="M12 21v-3.4M9 21h6" />
    </>
  ),
  meteor: (
    <>
      <circle cx="15" cy="9" r="4.2" />
      <path d="M8.4 12.6L2.6 18.4M11.6 16.4l-3.2 3.2M4.4 9.6L2.6 11.4" />
    </>
  ),
  blast: <path d="M8 3.6a13 13 0 010 16.8M13 6a9 9 0 010 12M18 8.4a5.6 5.6 0 010 7.2" />,
};

interface Props {
  name: GlyphName;
  size?: number;
}

export function Glyph({ name, size = 21 }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
