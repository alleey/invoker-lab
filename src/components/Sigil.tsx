import { type CSSProperties } from 'react';
import { dark } from '../engine/format';
import { ORB_INFO, type Orb } from '../engine/spells';

/**
 * A spell's three reagents as coloured beads, in the order it lists them.
 * Small enough to sit inline in a sentence, which is where it usually is.
 */
export function Sigil({ orbs }: { orbs: readonly Orb[] }): JSX.Element {
  return (
    <span className="sg">
      {orbs.map((o, i) => (
        <i key={i} style={{ '--c': ORB_INFO[o].hex, '--cd': dark(ORB_INFO[o].hex) } as CSSProperties} />
      ))}
    </span>
  );
}
