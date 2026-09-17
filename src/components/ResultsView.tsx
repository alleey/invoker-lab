import { type CSSProperties } from 'react';
import { mins, scoreUnit, sec, tier } from '../engine/format';
import { MODES } from '../engine/modes';
import { SPELL_BY_ID, type Spell } from '../engine/spells';
import { useStore, type CastLog } from '../store';
import { Sigil } from './Sigil';

interface Per {
  spell: Spell;
  hits: number;
  misses: number;
  totalMs: number;
  /** Time spent on the attempts that failed — what the misses actually cost. */
  lostMs: number;
}

const accOf = (p: Per): number => p.hits / (p.hits + p.misses);
const avgOf = (p: Per): number => p.totalMs / p.hits;

/** Each spell once: landed of drawn, and the average — the same shape at 5 casts or 500. */
function perSpell(casts: readonly CastLog[]): Per[] {
  const per = new Map<string, Per>();
  for (const c of casts) {
    const spell = SPELL_BY_ID.get(c.id);
    if (!spell) continue;
    const p = per.get(c.id) ?? { spell, hits: 0, misses: 0, totalMs: 0, lostMs: 0 };
    if (c.ok) {
      p.hits++;
      p.totalMs += c.ms;
    } else {
      p.misses++;
      p.lostMs += c.ms;
    }
    per.set(c.id, p);
  }
  return [...per.values()];
}

export function ResultsView(): JSX.Element {
  const result = useStore((s) => s.result);
  const lastRun = useStore((s) => s.lastRun);
  const logs = useStore((s) => s.stats.logs);
  const mode = useStore((s) => s.mode);
  const runDurationMs = useStore((s) => s.runDurationMs);
  const start = useStore((s) => s.start);
  const setPage = useStore((s) => s.setPage);
  const dismissResult = useStore((s) => s.dismissResult);

  if (!result || !lastRun) return <section className="results" aria-hidden="true" />;

  const c = MODES[mode];
  const rows = perSpell(lastRun.casts);

  // The fastest spell you never dropped, and the one you dropped most.
  const sharp = rows.filter((p) => p.hits > 0 && p.misses === 0).sort((a, b) => avgOf(a) - avgOf(b))[0];
  const weak = rows.filter((p) => p.misses > 0).sort((a, b) => accOf(a) - accOf(b))[0];

  const chains = c.comboSizes.some((n) => n > 1);
  const unit = scoreUnit(c.scoreBy);
  const log = logs[mode] ?? [];
  const peak = Math.max(1, ...log);

  return (
    <section className="results on">
      <div className="res-left">
        <p className="eb">
          Drill complete · {c.label}
          {runDurationMs ? ` · ${mins(runDurationMs)}` : ''}
        </p>
        <div className="score">
          {result.score}
          <small>{unit}</small>
        </div>
        <p className="res-line">
          <b>{result.hits}</b> landed · <b>{result.misses}</b> missed · best streak <b>{result.bestStreak}</b>
          {result.avgMs !== null && (
            <>
              {' '}
              · avg <b>{sec(result.avgMs)}</b>
            </>
          )}
          {c.bonusMs > 0 && result.hits > 0 && (
            <>
              {' '}
              · <b>{(result.hits * c.bonusMs) / 1000}s</b> earned back
            </>
          )}
          {result.tracksEfficiency && result.judged > 0 && (
            <>
              {' '}
              · <b>{result.efficient}</b> of <b>{result.judged}</b> {chains ? 'chains' : 'casts'} at par
            </>
          )}
        </p>
        <span className={`record${result.isRecord ? '' : ' plain'}`}>
          {result.isRecord
            ? `New record · previous best ${result.previousBest}`
            : `Best in this mode is ${result.previousBest}`}
        </span>
        <div className="res-btns">
          <button className="btn primary" type="button" onClick={() => start()}>
            Run it again · Space
          </button>
          <button className="btn" type="button" onClick={() => setPage('stats')}>
            Full stats
          </button>
          <button className="btn" type="button" onClick={() => dismissResult()}>
            Back · Esc
          </button>
        </div>
      </div>

      <div className="callout sharp">
        {sharp && (
          <>
            <p className="lb">Sharpest tonight</p>
            <b>{sharp.spell.name}</b>
            <p>
              {sharp.hits} of {sharp.hits} · {sec(avgOf(sharp))} average
            </p>
          </>
        )}
      </div>
      <div className="callout weak">
        {weak && (
          <>
            <p className="lb">Weakest tonight</p>
            <b>{weak.spell.name}</b>
            <p>
              {weak.hits} of {weak.hits + weak.misses} · {sec(weak.lostMs)} lost to misses
            </p>
          </>
        )}
      </div>

      <div className="perspell">
        <p className="lb">
          <span>Spells this run</span>
          <i>
            {lastRun.casts.length
              ? `${lastRun.casts.length} attempt${lastRun.casts.length === 1 ? '' : 's'} · landed of drawn · average time`
              : 'no casts this run'}
          </i>
        </p>
        <div className="chips">
          {rows.map((p) => (
            <span className="chip" key={p.spell.id}>
              <Sigil orbs={p.spell.orbs} />
              <b>{p.spell.name}</b>
              <span className={`acc ${tier(accOf(p))}`}>
                {p.hits}/{p.hits + p.misses}
              </span>
              {p.hits > 0 && <em>{sec(avgOf(p))}</em>}
            </span>
          ))}
        </div>
        <div className="log">
          <span className="lb">Past drills</span>
          {log.map((v, i) => (
            <span
              key={i}
              className={`bar${i === log.length - 1 ? ' now' : ''}`}
              style={{ '--h': `${Math.round((v / peak) * 40) + 4}px` } as CSSProperties}
            >
              <em />
              <i />
              <b>{v}</b>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
