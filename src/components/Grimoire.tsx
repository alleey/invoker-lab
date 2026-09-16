import { useEffect, useState, type CSSProperties } from 'react';
import { keyLabel, keySequence } from '../engine/bindings';
import { MODES } from '../engine/modes';
import { dominantOrb, ORB_INFO, SPELLS } from '../engine/spells';
import {
  accuracy,
  attempts,
  averageMs,
  efficiency,
  EMPTY_SPELL_STAT,
  highlights,
  summarise,
  type SpellStats,
} from '../engine/stats';
import { orbCostFrom, useStore } from '../store';
import { Sigil } from './Sigil';
import { SpellIcon } from './SpellIcon';

type View = 'cost' | 'stats';
type Scope = 'run' | 'all';

const tier = (acc: number): string => (acc >= 0.9 ? 'solid' : acc >= 0.7 ? 'ok' : 'weak');
const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;
const percent = (v: number): string => `${Math.round(v * 100)}%`;

/** The rail takes the reagent a spell leans on; brass when it leans on none. */
const railColour = (orbs: Parameters<typeof dominantOrb>[0]): string => {
  const orb = dominantOrb(orbs);
  return orb ? ORB_INFO[orb].hex : 'var(--brass)';
};

export function Grimoire(): JSX.Element {
  const mode = useStore((s) => s.mode);
  const orbs = useStore((s) => s.orbs);
  const slots = useStore((s) => s.slots);
  const combo = useStore((s) => s.combo);
  const step = useStore((s) => s.step);
  const stats = useStore((s) => s.stats);
  const sessionSpells = useStore((s) => s.sessionSpells);
  const sessionMode = useStore((s) => s.sessionMode);
  const bindings = useStore((s) => s.bindings);
  const result = useStore((s) => s.result);
  const resetStats = useStore((s) => s.resetStats);

  const [view, setView] = useState<View>('cost');
  const [scope, setScope] = useState<Scope>('all');
  const [armed, setArmed] = useState(false);

  const runHasData = Object.keys(sessionSpells).length > 0;
  /** Practice hands out no targets, so it can never produce run stats. */
  const scored = MODES[mode].comboSizes.length > 0;

  // A drill just ended: put the breakdown for that run in front of them.
  useEffect(() => {
    if (!result) return;
    setView('stats');
    setScope('run');
    setArmed(false);
  }, [result]);

  // A run's stats stop being meaningful once the next run clears them.
  useEffect(() => {
    if (!runHasData && scope === 'run') setScope('all');
  }, [runHasData, scope]);

  const targetId = combo[step]?.id ?? null;
  const source: SpellStats = scope === 'run' ? sessionSpells : stats.spells;
  const run = summarise(sessionSpells);
  const { weakest, strongest, judged } = highlights(stats);

  const note = (): JSX.Element | string => {
    if (view === 'cost') {
      return 'Orb presses to reach each spell from the reagents you are holding now.';
    }
    if (scope === 'run') {
      return (
        <>
          {sessionMode && <b>{MODES[sessionMode].label}</b>} · <b>{run.hits}</b> landed,{' '}
          <b>{run.misses}</b> missed across <b>{run.spellsSeen}</b> spells
          {run.accuracy !== null && <> · {percent(run.accuracy)} accuracy</>}
          {run.efficiency !== null && <> · {percent(run.efficiency)} efficient</>}
        </>
      );
    }
    if (!scored) {
      return 'Practice has no targets, so nothing here is recorded. These are your lifetime numbers from the scored modes.';
    }

    const lifetime =
      judged >= 2 && weakest && strongest ? (
        <>
          Strongest <b>{strongest.spell.name}</b> at {percent(strongest.accuracy)} · weakest{' '}
          <b>{weakest.spell.name}</b> at {percent(weakest.accuracy)}
        </>
      ) : (
        'A spell is judged once you have attempted it three times.'
      );

    // Say why the other tab is unavailable, here where it can actually be read.
    return (
      <>
        {lifetime}
        {!runHasData && <> · finish a drill to see just that run</>}
      </>
    );
  };

  return (
    <aside className="grimoire">
      <div className="gr-head">
        <h2>Grimoire</h2>
        <div className="seg" role="group" aria-label="Grimoire view">
          <button type="button" aria-pressed={view === 'cost'} onClick={() => setView('cost')}>
            Cost
          </button>
          <button type="button" aria-pressed={view === 'stats'} onClick={() => setView('stats')}>
            Stats
          </button>
        </div>
      </div>

      {/* Offered whenever there is a run worth reading, or a mode that could
          produce one. Practice with no run behind it gets no tabs at all,
          since a permanently disabled one is worse than none. */}
      {view === 'stats' && (scored || runHasData) && (
        <div className="scope">
          <div className="seg" role="group" aria-label="Stats scope">
            <button
              type="button"
              aria-pressed={scope === 'run'}
              disabled={!runHasData}
              onClick={() => setScope('run')}
            >
              This run
            </button>
            <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
              Overall
            </button>
          </div>
        </div>
      )}

      <p className="gr-note">{note()}</p>

      <ul className="rows">
        {SPELLS.map((spell) => {
          const stat = source[spell.id] ?? EMPTY_SPELL_STAT;
          const acc = accuracy(stat);
          const avg = averageMs(stat);
          const eff = efficiency(stat);
          const loadedIn = slots[0]?.id === spell.id ? 0 : slots[1]?.id === spell.id ? 1 : null;
          const cost = orbCostFrom(orbs, spell.orbs);

          return (
            <li
              key={spell.id}
              className={`row${view === 'stats' ? ' statrow' : ''}${targetId === spell.id ? ' active' : ''}`}
              style={{ '--rail': railColour(spell.orbs) } as CSSProperties}
            >
              <span className="gl">
                <SpellIcon spell={spell} />
              </span>
              <span className="nm">
                {spell.name}
                <small>
                  {keySequence(spell.orbs, bindings)}
                  {view === 'stats' && stat.bestMs > 0 && ` · best ${seconds(stat.bestMs)}`}
                  {view === 'stats' && stat.bestMs === 0 && (scope === 'run' ? ' · not seen' : ' · never cast')}
                  {view === 'stats' && eff !== null && ` · ${percent(eff)} eff`}
                </small>
              </span>

              {view === 'cost' ? (
                <>
                  <Sigil orbs={spell.orbs} />
                  {loadedIn === null ? (
                    <span className="cost" title={`${cost} orb press${cost === 1 ? '' : 'es'} away`}>
                      {cost}
                    </span>
                  ) : (
                    <span className="cost ready" title="Already invoked — one press to cast">
                      {keyLabel(loadedIn === 0 ? bindings.slot1 : bindings.slot2)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="avg" title={`${attempts(stat)} attempts`}>
                    {avg === null ? '—' : seconds(avg)}
                  </span>
                  <span className={`acc ${acc === null ? 'none' : tier(acc)}`}>
                    {acc === null ? '—' : percent(acc)}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {view === 'stats' && scope === 'all' && (
        <div className="gr-foot">
          <span>
            {stats.drills} drill{stats.drills === 1 ? '' : 's'} recorded
          </span>
          {armed ? (
            <span className="confirm">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  resetStats();
                  setArmed(false);
                }}
              >
                Erase everything
              </button>
              <button type="button" onClick={() => setArmed(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setArmed(true)}>
              Reset stats
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
