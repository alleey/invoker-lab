import { MODES, PRACTICE } from '../engine/modes';
import { spellFor } from '../engine/orbs';
import { ORB_INFO } from '../engine/spells';
import { PRACTICE_CHAIN_MAX, useStore } from '../store';
import { Kbd } from './Kbd';
import { Sigil } from './Sigil';
import { SpellIcon } from './SpellIcon';

/**
 * The sandbox's header and its way out.
 *
 * It names itself against the mode you came from on purpose: this is not a
 * gentler Streak or an untimed Professional, it is the orb queue with nothing
 * attached, and a player who thinks otherwise is practising the wrong thing.
 */
export function PracticeBar(): JSX.Element | null {
  const practicing = useStore((s) => s.practicing);
  const mode = useStore((s) => s.mode);
  const orbs = useStore((s) => s.orbs);
  const bindings = useStore((s) => s.bindings);
  const overlay = useStore((s) => s.kbOpen || s.statsOpen || s.masteryOpen);
  const setPracticing = useStore((s) => s.setPracticing);
  const chain = useStore((s) => s.practiceChain);
  const step = useStore((s) => s.practiceStep);
  const clearChain = useStore((s) => s.clearPracticeChain);
  const tempo = useStore((s) => s.tempo);
  const dragging = useStore((s) => s.dragging);

  if (!practicing || overlay) return null;

  const live = spellFor(orbs);

  return (
    <>
      <div className="kb-head">
        <p className="eb">{PRACTICE.label}</p>
        <h2>{PRACTICE.goal}</h2>
        <p>
          Not {MODES[mode].label} practice — that mode is played differently. Nothing is drawn for you and nothing is
          recorded. Click a star to pin up to {PRACTICE_CHAIN_MAX} spells and drill them in order.
        </p>
      </div>
      <button className="btn kb-done" type="button" onClick={() => setPracticing(false)}>
        Done · Esc
      </button>

      <div className="stagebar">
        <div className={`chain tray${dragging ? ' armed' : ''}`} data-chain-drop>
          {chain.length === 0 ? (
            <p className="tray-empty">
              {dragging ? `Drop ${dragging.name} here` : `Drag a star here to drill up to ${PRACTICE_CHAIN_MAX} in order`}
            </p>
          ) : (
            <>
              {chain.map((sp, i) => (
                <span key={sp.id} className={i === step ? 'now' : ''}>
                  <SpellIcon spell={sp} size={20} />
                  {sp.name}
                </span>
              ))}
              {chain.length < PRACTICE_CHAIN_MAX && <span className="tray-slot">＋</span>}
              <button className="chain-clear" type="button" onClick={() => clearChain()}>
                Clear
              </button>
            </>
          )}
        </div>
        {live ? (
          <div className={`practice-live${tempo ? ` t-${tempo}` : ''}`}>
            <SpellIcon spell={live} size={26} />
            <b>{live.name}</b>
            <Sigil orbs={live.orbs} />
            <span>{live.orbs.map((o) => ORB_INFO[o].name).join(' · ')}</span>
            <span>
              <Kbd code={bindings.invoke} gold /> to load it
            </span>
          </div>
        ) : (
          <p className="practice-hint">
            {orbs.length === 0
              ? 'Three reagents make a spell.'
              : `${3 - orbs.length} more reagent${orbs.length === 2 ? '' : 's'}.`}
          </p>
        )}
      </div>
    </>
  );
}
