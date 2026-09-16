import { pct } from '../engine/format';
import { SPELLS } from '../engine/spells';
import { accuracy, attempts, statFor, summarise, weakestSpells } from '../engine/stats';
import { useStore, WEAK_POOL_SIZE } from '../store';

/**
 * The star chart as a record of you rather than a board to play on.
 *
 * Deliberately chrome only: the chart itself is the Stage's canvas underneath,
 * so everything here is `pointer-events: none` except the parts you can click.
 * Let this section eat pointer events and hover stops reaching the stars, which
 * is the entire point of the page.
 */
export function MasteryPage(): JSX.Element {
  const open = useStore((s) => s.masteryOpen);
  const stats = useStore((s) => s.stats);
  const setPage = useStore((s) => s.setPage);

  if (!open) return <section className="masterypage" aria-hidden="true" />;

  const life = summarise(stats.spells);
  const weak = new Set(weakestSpells(stats, WEAK_POOL_SIZE).map((s) => s.id));
  const untested = SPELLS.filter((s) => attempts(statFor(stats, s.id)) === 0);
  const solid = SPELLS.filter((s) => {
    const a = accuracy(statFor(stats, s.id));
    return a !== null && a >= 0.9;
  });

  return (
    <section className="masterypage on">
      <div className="kb-head">
        <p className="eb">Mastery</p>
        <h2>Every spell, where you stand</h2>
        <p>Hover a star for its detail.</p>
      </div>
      <button className="btn kb-done" type="button" onClick={() => setPage(null)}>
        Done · Esc
      </button>

      <div className="mastery-foot">
        <span>
          <b>{life.spellsSeen}</b> of 10 cast
          {life.accuracy !== null && (
            <>
              {' '}
              · <b>{pct(life.accuracy)}</b> overall
            </>
          )}
          {stats.chains > 0 && (
            <>
              {' '}
              · <b>{pct(stats.chainsOptimal / stats.chains)}</b> routed by the shortest keys
            </>
          )}
        </span>
        <span className="mastery-key">
          <i className="solid" /> 90%+ <i className="ok" /> 70%+ <i className="weak" /> under 70% <i className="none" />{' '}
          never cast
        </span>
      </div>

      <div className="mastery-notes">
        {untested.length > 0 && (
          <p>
            <b>{untested.length} never cast.</b> {untested.map((s) => s.name).join(', ')}.
          </p>
        )}
        {weak.size > 0 && (
          <p>
            <b>Weakest {WEAK_POOL_SIZE}</b> {SPELLS.filter((s) => weak.has(s.id)).map((s) => s.name).join(', ')}.
          </p>
        )}
        {solid.length > 0 && (
          <p>
            <b>Solid at 90%+</b> {solid.map((s) => s.name).join(', ')}.
          </p>
        )}
      </div>
    </section>
  );
}
