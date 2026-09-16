import { keyLabel } from '../engine/bindings';
import type { ModeExample as Example } from '../engine/modes';
import type { Orb } from '../engine/spells';
import { useStore } from '../store';

interface Props {
  example: Example;
}

interface RouteProps {
  orbs: readonly Orb[];
  note: string;
  verdict: 'efficient' | 'wasteful';
}

/**
 * The rule made concrete. Rendered in the player's own keys, because "one Exort"
 * lands very differently from seeing `T` sitting where their finger already is.
 */
export function ModeExample({ example }: Props): JSX.Element {
  const bindings = useStore((s) => s.bindings);

  const Route = ({ orbs, note, verdict }: RouteProps): JSX.Element => {
    const keys = [
      ...orbs.map((orb) => keyLabel(bindings[orb])),
      keyLabel(bindings.invoke),
      keyLabel(bindings.slot1),
    ];
    return (
      <div className={`route ${verdict}`}>
        <span className="route-keys">
          {keys.map((key, i) => (
            <kbd key={i}>{key}</kbd>
          ))}
          <em>
            {keys.length} key{keys.length === 1 ? '' : 's'}
          </em>
        </span>
        <span className="route-verdict">{verdict}</span>
        <p className="route-note">{note}</p>
      </div>
    );
  };

  return (
    <section className="example" aria-label="Worked example">
      <p className="example-setup">
        {example.setup} {example.ask}
      </p>
      <Route {...example.efficient} verdict="efficient" />
      <Route {...example.wasteful} verdict="wasteful" />
    </section>
  );
}
