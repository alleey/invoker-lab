import type { Spell } from '../engine/spells';
import { Sigil } from './Sigil';
import { SpellIcon } from './SpellIcon';

interface Props {
  combo: readonly Spell[];
  step: number;
}

/**
 * The chain in play, with everything already landed marked off. Only earns its
 * place when there is actually a chain — a one-spell "combination" is just the
 * heading repeated.
 */
export function ComboTrack({ combo, step }: Props): JSX.Element | null {
  if (combo.length < 2) return null;

  return (
    <ol className="track" aria-label={`Chain of ${combo.length} spells`}>
      {combo.map((spell, i) => {
        const state = i < step ? 'done' : i === step ? 'now' : 'next';
        return (
          <li key={`${spell.id}-${i}`} className={`track-step ${state}`} aria-current={state === 'now'}>
            <span className="track-num">{i < step ? '✓' : i + 1}</span>
            <SpellIcon spell={spell} size={15} />
            <span className="track-name">{spell.name}</span>
            <Sigil orbs={spell.orbs} />
          </li>
        );
      })}
    </ol>
  );
}
