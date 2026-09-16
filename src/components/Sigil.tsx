import { ORB_INFO, type Orb } from '../engine/spells';

interface Props {
  orbs: readonly Orb[];
  size?: 'sm' | 'lg';
}

/** The three reagent dots that stand in for a spell's name. */
export function Sigil({ orbs, size = 'sm' }: Props): JSX.Element {
  return (
    <span className={`sigil ${size === 'lg' ? 'sigil-lg' : ''}`}>
      {orbs.map((orb, i) => (
        <i key={i} style={{ color: ORB_INFO[orb].hex }} />
      ))}
    </span>
  );
}
