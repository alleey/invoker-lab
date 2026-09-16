import { useEffect, useState } from 'react';
import { keyLabel } from '../engine/bindings';
import { pct, sec, tier } from '../engine/format';
import { MODES } from '../engine/modes';
import { SPELLS, type Spell } from '../engine/spells';
import { highlights, statIn, summarise, weakestSpells, type SpellStats } from '../engine/stats';
import { useStore, WEAK_POOL_SIZE, type CastLog } from '../store';
import { SpellIcon } from './SpellIcon';

type Scope = 'run' | 'life';

interface Row {
  spell: Spell;
  hits: number;
  misses: number;
  avg: number | null;
  best: number | null;
  acc: number | null;
}

/** One run's casts, folded per spell. Deliberately separate from the lifetime
 *  table: a run is a list of events, and re-deriving it keeps them from drifting. */
function runRows(casts: readonly CastLog[]): Row[] {
  return SPELLS.map((spell) => {
    const mine = casts.filter((c) => c.id === spell.id);
    const landed = mine.filter((c) => c.ok);
    const hits = landed.length;
    const misses = mine.length - hits;
    return {
      spell,
      hits,
      misses,
      avg: hits ? landed.reduce((a, c) => a + c.ms, 0) / hits : null,
      best: hits ? Math.min(...landed.map((c) => c.ms)) : null,
      acc: mine.length ? hits / mine.length : null,
    };
  });
}

function lifeRows(spells: SpellStats): Row[] {
  return SPELLS.map((spell) => {
    const stat = statIn(spells, spell.id);
    const total = stat.hits + stat.misses;
    return {
      spell,
      hits: stat.hits,
      misses: stat.misses,
      avg: stat.hits ? stat.totalMs / stat.hits : null,
      best: stat.bestMs || null,
      acc: total ? stat.hits / total : null,
    };
  });
}

export function StatsPage(): JSX.Element {
  // The keyboard page wins when both are somehow set — one board at a time.
  const open = useStore((s) => s.statsOpen && !s.kbOpen);
  const stats = useStore((s) => s.stats);
  const lastRun = useStore((s) => s.lastRun);
  const bindings = useStore((s) => s.bindings);
  const setPage = useStore((s) => s.setPage);
  const resetStats = useStore((s) => s.resetStats);

  const [scope, setScope] = useState<Scope>('life');
  const [sortWeak, setSortWeak] = useState(false);
  const [armed, setArmed] = useState(false);

  // Opening on the run you just finished is what you nearly always want; the
  // arm-to-erase state must never survive a close, or a stray second click on
  // reopening would wipe everything.
  useEffect(() => {
    if (open) setScope(useStore.getState().lastRun ? 'run' : 'life');
    else setArmed(false);
  }, [open]);

  if (!open) return <section className="statspage" aria-hidden="true" />;

  const view: Scope = scope === 'run' && lastRun ? 'run' : 'life';
  const rows = view === 'run' && lastRun ? runRows(lastRun.casts) : lifeRows(stats.spells);
  if (sortWeak) {
    rows.sort(
      (a, b) =>
        (a.acc === null ? -1 : b.acc === null ? 1 : a.acc - b.acc) || (b.avg ?? 0) - (a.avg ?? 0),
    );
  }

  const weak = new Set(weakestSpells(stats, WEAK_POOL_SIZE).map((s) => s.id));
  const life = summarise(stats.spells);
  const hl = highlights(stats);

  return (
    <section className="statspage on">
      <div className="kb-head">
        <p className="eb">Stats</p>
        <h2>Every spell, once</h2>
      </div>
      <button className="btn kb-done" type="button" onClick={() => setPage(null)}>
        Done · Esc
      </button>

      <div className="st-wrap">
        <div className="st-head">
          <div className="seg">
            <button type="button" aria-pressed={view === 'run'} disabled={!lastRun} onClick={() => setScope('run')}>
              This run
            </button>
            <button type="button" aria-pressed={view === 'life'} onClick={() => setScope('life')}>
              Overall
            </button>
          </div>
          <button className="btn" type="button" aria-pressed={sortWeak} onClick={() => setSortWeak((v) => !v)}>
            {sortWeak ? 'Sorted weakest first' : 'Sort weakest first'}
          </button>
        </div>

        <p className="st-sum">
          {view === 'run' && lastRun ? (
            <>
              <b>{MODES[lastRun.mode].label}</b> · <b>{lastRun.hits}</b> landed, <b>{lastRun.misses}</b> missed across{' '}
              <b>{new Set(lastRun.casts.map((c) => c.id)).size}</b> spells
              {lastRun.hits + lastRun.misses > 0 && (
                <>
                  {' '}
                  · <b>{pct(lastRun.hits / (lastRun.hits + lastRun.misses))}</b> accuracy
                </>
              )}
              {lastRun.avgMs !== null && (
                <>
                  {' '}
                  · avg <b>{sec(lastRun.avgMs)}</b>
                </>
              )}
              {lastRun.judgedChains > 0 && (
                <>
                  {' '}
                  · <b>{pct(lastRun.optimalChains / lastRun.judgedChains)}</b> routed by the shortest keys
                </>
              )}
            </>
          ) : (
            <>
              <b>{life.hits + life.misses}</b> casts over <b>{stats.drills}</b> drills
              {life.accuracy !== null && (
                <>
                  {' '}
                  · <b>{pct(life.accuracy)}</b> accuracy
                </>
              )}
              {stats.chains > 0 && (
                <>
                  {' '}
                  · <b>{pct(stats.chainsOptimal / stats.chains)}</b> routed by the shortest keys
                </>
              )}
              {hl.strongest && hl.weakest ? (
                <>
                  {' '}
                  · strongest <b>{hl.strongest.spell.name}</b> at {pct(hl.strongest.accuracy)} · weakest{' '}
                  <b>{hl.weakest.spell.name}</b> at {pct(hl.weakest.accuracy)}
                </>
              ) : (
                ' · a spell is judged once you have attempted it three times'
              )}
              {!lastRun && ' · finish a drill to see just that run'}
            </>
          )}
        </p>

        <table className="st">
          <thead>
            <tr>
              <th>Spell</th>
              <th>Keys</th>
              <th>Attempts</th>
              <th>Landed</th>
              <th>Accuracy</th>
              <th>Avg</th>
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.spell.id} className={view === 'life' && weak.has(r.spell.id) ? 'weak6' : ''}>
                <td className="nm">
                  <span className="nmwrap">
                    <SpellIcon spell={r.spell} />
                    {r.spell.name}
                  </span>
                </td>
                <td>{r.spell.orbs.map((o) => keyLabel(bindings[o])).join(' ')}</td>
                <td>{r.hits + r.misses}</td>
                <td>{r.hits}</td>
                <td>
                  <span className={`acc ${r.acc === null ? 'none' : tier(r.acc)}`}>
                    {r.acc === null ? (view === 'run' ? 'not drawn' : 'never cast') : pct(r.acc)}
                  </span>
                </td>
                <td>{r.avg === null ? '—' : sec(r.avg)}</td>
                <td>{r.best === null ? '—' : sec(r.best)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {view === 'life' && (
          <div className="st-foot">
            <span>
              {stats.drills} drill{stats.drills === 1 ? '' : 's'} recorded · a reset never touches bindings
            </span>
            {armed ? (
              <span className="row">
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => {
                    resetStats();
                    setArmed(false);
                  }}
                >
                  Erase everything
                </button>
                <button className="btn" type="button" onClick={() => setArmed(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button className="btn" type="button" onClick={() => setArmed(true)}>
                Reset stats
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
