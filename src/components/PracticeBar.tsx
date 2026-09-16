import { MODES, PRACTICE } from '../engine/modes';
import { spellFor } from '../engine/orbs';
import { ORB_INFO } from '../engine/spells';
import { useStore } from '../store';
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

  if (!practicing || overlay) return null;

  const live = spellFor(orbs);

  return (
    <>
      <div className="kb-head">
        <p className="eb">{PRACTICE.label}</p>
        <h2>{PRACTICE.goal}</h2>
        <p>
          Not {MODES[mode].label} practice — that mode is played differently. Nothing is drawn for you, nothing is
          timed and nothing is recorded. Stack three reagents and see what they make.
        </p>
      </div>
      <button className="btn kb-done" type="button" onClick={() => setPracticing(false)}>
        Done · Esc
      </button>

      <div className="stagebar">
        {live ? (
          <div className="practice-live">
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
