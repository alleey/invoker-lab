import { MODES } from '../engine/modes';
import { parFor } from '../engine/slots';
import { useStore } from '../store';
import { Kbd } from './Kbd';
import { SpellIcon } from './SpellIcon';

/**
 * The spell you owe and the cheapest way to it. Only ever shown mid-drill —
 * the brief that used to live here now sits centre stage, where there is room
 * for it. What you need *during* a cast (the chain, the spell time) is under
 * the stars instead, because a rail on a wide screen is too far from where you
 * are looking to read in the two seconds you have.
 */
export function LeftRail(): JSX.Element | null {
  const s = useStore();
  const overlay = s.kbOpen || s.statsOpen || s.masteryOpen || !!s.result || s.paused;
  const target = s.running && !overlay ? s.combo[s.step] : null;
  if (!target) return null;

  const c = MODES[s.mode];
  const par = parFor(s.orbs, s.slots, target);

  return (
    <aside className="left">
      <p className="eb">{s.combo.length > 1 ? `Spell ${s.step + 1} of ${s.combo.length}` : 'Invoke and cast'}</p>
      <h2 className="in">
        <SpellIcon spell={target} size={34} />
        <span>{target.name}</span>
      </h2>
      <p className="tag">{target.tag}</p>
      <div className="route">
        {par.needsInvoke ? (
          <>
            {par.route.map((o, i) => (
              <Kbd key={i} code={s.bindings[o]} />
            ))}
            {par.route.length ? `${par.route.length} press${par.route.length === 1 ? '' : 'es'} · ` : 'reagents in hand · '}
            <Kbd code={s.bindings.invoke} gold />
            <Kbd code={s.bindings.slot1} gold />
            <b>par {par.total}</b>
          </>
        ) : (
          <>
            Already in slot {par.slot + 1} — <Kbd code={s.bindings[par.slot === 0 ? 'slot1' : 'slot2']} gold /> cast,{' '}
            <b>par 1</b>
          </>
        )}
      </div>
      {c.trackEfficiency && s.chainPar > 0 && (
        <p className="tag">
          {s.combo.length > 1 ? 'Chain par' : 'Par'} <b>{s.chainPar}</b> keys · used <b>{s.chainPresses}</b>
        </p>
      )}
      <button className="begin end" type="button" onClick={() => s.toggleRun()}>
        End drill · Space
      </button>
    </aside>
  );
}
