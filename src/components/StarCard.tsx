import { pct, sec, tier } from '../engine/format';
import { parFor } from '../engine/slots';
import { ORB_INFO } from '../engine/spells';
import { accuracy, attempts, averageMs, statFor, weakestSpells } from '../engine/stats';
import { PRACTICE_CHAIN_MAX, useStore, WEAK_POOL_SIZE } from '../store';
import { Kbd } from './Kbd';
import { Sigil } from './Sigil';

const CIRC = 2 * Math.PI * 30;
const SPARK_W = 268;
const SPARK_H = 40;

/** Twelve attempts plotted fastest-at-the-bottom, with the lifetime mean behind them. */
function Spark({ times, avg }: { times: readonly number[]; avg: number }): JSX.Element {
  const hi = Math.max(...times) * 1.05;
  const lo = Math.min(...times) * 0.9;
  const span = hi - lo || 1;
  const y = (v: number) => SPARK_H - ((v - lo) / span) * (SPARK_H - 6) - 3;
  // Spaced for a full twelve however few there are, so the line grows rightward
  // across sessions instead of redrawing itself at a new scale every cast.
  const pts = times.map((v, i) => [i * (SPARK_W / 11), y(v)] as const);
  return (
    <>
      <svg className="spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true">
        <line className="avg" x1="0" x2={SPARK_W} y1={y(avg)} y2={y(avg)} />
        <polyline points={pts.map((p) => p.join(',')).join(' ')} />
        {pts.map((p, i) => (
          <circle key={i} className="pt" cx={p[0]} cy={p[1]} r="1.8" />
        ))}
      </svg>
      <p className="foot">
        Last {times.length === 1 ? 'attempt' : `${times.length} attempts`}, fastest at the bottom. Dashed line is your
        lifetime average.
      </p>
    </>
  );
}

/**
 * The page behind a star: what it costs you from here, and how good you are
 * at it. Opened by clicking a node, closed by clicking open space.
 */
export function StarCard(): JSX.Element {
  const spell = useStore((s) => s.selected);
  // Welcome on the mastery chart and in the sandbox; never mid-drill.
  const welcome = useStore((s) => (s.masteryOpen || s.practicing) && !s.paused && !s.kbOpen && !s.statsOpen);
  const orbs = useStore((s) => s.orbs);
  const slots = useStore((s) => s.slots);
  const bindings = useStore((s) => s.bindings);
  const stats = useStore((s) => s.stats);
  const practicing = useStore((s) => s.practicing);
  const chain = useStore((s) => s.practiceChain);
  const pin = useStore((s) => s.togglePracticeSpell);

  if (!spell || !welcome) return <aside className="card" aria-hidden="true" />;

  const stat = statFor(stats, spell.id);
  const acc = accuracy(stat);
  const avg = averageMs(stat);
  const par = parFor(orbs, slots, spell);
  /* Only worth showing when the board actually holds something. With an empty
     queue every spell prices the same — three presses, invoke, cast — so the
     section would repeat one static answer ten times and teach nothing. */
  const live = orbs.length > 0 || slots.some((s) => s !== null);
  const weak = weakestSpells(stats, WEAK_POOL_SIZE).some((s) => s.id === spell.id);

  return (
    <aside className="card on">
      <h3>{spell.name}</h3>
      <div className="sig">
        <Sigil orbs={spell.orbs} />
        <span>{spell.orbs.map((o) => ORB_INFO[o].name).join(' · ')}</span>
        <span>
          {spell.orbs.map((o, i) => (
            <Kbd key={i} code={bindings[o]} />
          ))}
        </span>
      </div>
      <p className="tag">{spell.tag}</p>

      {practicing && (
        <button
          className={`pinbtn${chain.some((c) => c.id === spell.id) ? ' on' : ''}`}
          type="button"
          disabled={!chain.some((c) => c.id === spell.id) && chain.length >= PRACTICE_CHAIN_MAX}
          onClick={() => pin(spell)}
        >
          {chain.some((c) => c.id === spell.id)
            ? 'Remove from chain'
            : chain.length >= PRACTICE_CHAIN_MAX
              ? `Chain is full (${PRACTICE_CHAIN_MAX})`
              : 'Add to chain'}
        </button>
      )}

      {live && (
      <div className="sec">
        <p className="lb">From where you stand</p>
        <div className="from">
          {par.needsInvoke ? (
            <>
              {par.route.map((o, i) => (
                <Kbd key={i} code={bindings[o]} gold />
              ))}
              {par.route.length ? `${par.route.length} press${par.route.length === 1 ? '' : 'es'} · ` : 'in hand · '}
              <Kbd code={bindings.invoke} gold />
              <Kbd code={bindings.slot1} gold />
              <b>par {par.total}</b>
            </>
          ) : (
            <>
              In slot {par.slot + 1} — <Kbd code={bindings[par.slot === 0 ? 'slot1' : 'slot2']} gold /> cast, <b>par 1</b>
            </>
          )}
        </div>
      </div>
      )}

      <div className="sec">
        <p className="lb">Mastery</p>
        <div className="mast">
          <div className="ring">
            <svg viewBox="0 0 72 72" aria-hidden="true">
              <circle className="tr" cx="36" cy="36" r="30" />
              <circle
                className={`ar${acc === null ? '' : ` ${tier(acc)}`}`}
                cx="36"
                cy="36"
                r="30"
                strokeDasharray={`${(acc ?? 0) * CIRC} ${CIRC}`}
              />
            </svg>
            <b>{acc === null ? '—' : pct(acc)}</b>
          </div>
          <dl>
            <dt>attempts</dt>
            <dd>{attempts(stat)}</dd>
            <dt>avg</dt>
            <dd>{avg === null ? '—' : sec(avg)}</dd>
            <dt>best</dt>
            <dd>{stat.bestMs ? sec(stat.bestMs) : '—'}</dd>
          </dl>
        </div>
        {stat.recent.length && avg !== null ? (
          <Spark times={stat.recent} avg={avg} />
        ) : (
          <p className="foot">Never cast. The weakness filter draws this one first.</p>
        )}
      </div>

      {acc === null ? (
        <span className="badge never">Untested · drilled first</span>
      ) : weak ? (
        <span className="badge weak">Weakest {WEAK_POOL_SIZE}</span>
      ) : acc >= 0.9 ? (
        <span className="badge strong">Solid</span>
      ) : null}
    </aside>
  );
}
