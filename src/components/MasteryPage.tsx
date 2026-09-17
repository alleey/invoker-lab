import { pct, tier } from '../engine/format';
import { SPELLS, type Spell } from '../engine/spells';
import { accuracy, attempts, statFor, summarise } from '../engine/stats';
import { useStore } from '../store';
import { SpellIcon } from './SpellIcon';

interface Bar {
  spell: Spell;
  acc: number | null;
  n: number;
}

/** The accuracy bands, as the chart and the key both read them. */
const BANDS: { cls: string; label: string }[] = [
  { cls: 'solid', label: '90%+' },
  { cls: 'ok', label: '70–89%' },
  { cls: 'weak', label: 'under 70%' },
  { cls: 'none', label: 'never cast' },
];

/**
 * Ten spells, worst first. The stars say where each one sits on the lattice;
 * this says how they compare, which a scatter of rings around a triangle can
 * never show at a glance.
 */
const COL = 38;
const GAP = 8;
const PLOT_H = 88;
/** Room above the highest point for its percentage. */
const PAD_T = 16;
const W = 10 * COL + 9 * GAP;
const H = PLOT_H + PAD_T;
const cxOf = (i: number): number => i * (COL + GAP) + COL / 2;
/** A never-cast spell has no accuracy, so it rides the floor. */
const cyOf = (acc: number | null): number => PAD_T + PLOT_H - (acc ?? 0) * (PLOT_H - 6) - 3;

function AccuracyGraph({ bars }: { bars: Bar[] }): JSX.Element {
  const select = useStore((s) => s.setSelected);
  const selected = useStore((s) => s.selected);

  const pts = bars.map((b, i) => ({ ...b, x: cxOf(i), y: cyOf(b.acc) }));
  /* Two runs, because a spell you have never cast is not a spell you score
     zero on. The untested head of the line is dashed along the floor; the
     solid line starts at the first spell you have actually attempted. */
  const firstReal = pts.findIndex((p) => p.acc !== null);
  const dashed = firstReal < 0 ? pts : pts.slice(0, firstReal + 1);
  const solid = firstReal < 0 ? [] : pts.slice(firstReal);
  const path = (list: typeof pts) => list.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="accg" role="group" aria-label="Accuracy by spell, weakest first">
      <svg className="accl" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        {[0, 0.5, 1].map((g) => (
          <line key={g} className="accl-grid" x1="0" x2={W} y1={cyOf(g)} y2={cyOf(g)} />
        ))}
        {dashed.length > 1 && <polyline className="accl-line dash" points={path(dashed)} />}
        {solid.length > 1 && <polyline className="accl-line" points={path(solid)} />}
        {pts.map((p) => (
          <g key={p.spell.id} className={`accl-pt ${p.acc === null ? 'none' : tier(p.acc)}${selected?.id === p.spell.id ? ' on' : ''}`}>
            <text x={p.x} y={p.y - 9} textAnchor="middle">
              {p.acc === null ? '—' : pct(p.acc)}
            </text>
            <circle cx={p.x} cy={p.y} r={selected?.id === p.spell.id ? 4.5 : 3.2} />
          </g>
        ))}
      </svg>

      <div className="accg-icons">
        {bars.map(({ spell, acc, n }) => (
          <button
            key={spell.id}
            type="button"
            className={`acci${selected?.id === spell.id ? ' on' : ''}`}
            onClick={() => select(spell)}
            title={`${spell.name} — ${acc === null ? 'never cast' : `${pct(acc)} of ${n}`}`}
            aria-label={`${spell.name}, ${acc === null ? 'never cast' : `${pct(acc)} of ${n}`}`}
          >
            <SpellIcon spell={spell} size={22} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MasteryPage(): JSX.Element {
  const open = useStore((s) => s.masteryOpen);
  const stats = useStore((s) => s.stats);
  const setPage = useStore((s) => s.setPage);

  if (!open) return <section className="masterypage" aria-hidden="true" />;

  const life = summarise(stats.spells);
  const bars: Bar[] = SPELLS.map((spell) => {
    const stat = statFor(stats, spell.id);
    return { spell, acc: accuracy(stat), n: attempts(stat) };
  }).sort((a, b) => (a.acc ?? -1) - (b.acc ?? -1) || b.n - a.n);

  return (
    <section className="masterypage on">
      <div className="kb-head">
        <p className="eb">Mastery</p>
        <h2>Every spell, where you stand</h2>
      </div>
      <button className="btn kb-done" type="button" onClick={() => setPage(null)}>
        Done · Esc
      </button>

      <div className="mastery-panel">
        <p className="mastery-hint">Click a star or a bar for its detail</p>
        <AccuracyGraph bars={bars} />
        <div className="mastery-key">
          {BANDS.map((b) => (
            <span key={b.cls} className={`keyi ${b.cls}`}>
              <i />
              {b.label}
            </span>
          ))}
        </div>
      </div>

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
          {' '}
          · <b>{stats.drills}</b> drill{stats.drills === 1 ? '' : 's'}
        </span>
      </div>
    </section>
  );
}
