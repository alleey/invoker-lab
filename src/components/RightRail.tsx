import { type CSSProperties } from 'react';
import { ACTION_HEX, ACTION_LABEL, ACTIONS, keyLabel, PRESETS } from '../engine/bindings';
import { pct } from '../engine/format';
import { MODES } from '../engine/modes';
import { highlights, summarise } from '../engine/stats';
import { useStore } from '../store';

/**
 * Two read-outs stacked bottom right, each a button onto its own full page.
 * They are summaries, not controls — everything you can change lives behind them.
 */
export function RightRail(): JSX.Element | null {
  const stats = useStore((s) => s.stats);
  const lastRun = useStore((s) => s.lastRun);
  const bindings = useStore((s) => s.bindings);
  const presetId = useStore((s) => s.presetId);
  const setPage = useStore((s) => s.setPage);
  /**
   * Gone the moment you commit to anything. Two of these three panels are
   * mastery by another name, so leaving them clickable mid-drill would be a
   * back door to the readout the drill deliberately withholds — and the run
   * clock would keep going while you read it.
   */
  const away = useStore(
    (s) => s.kbOpen || s.statsOpen || s.masteryOpen || !!s.result || s.paused || s.practicing || s.running,
  );
  if (away) return null;

  const life = summarise(stats.spells);
  const weakest = highlights(stats).weakest;
  const preset = PRESETS.find((p) => p.id === presetId);
  const attempted = life.hits + life.misses;
  const seen = life.spellsSeen;

  return (
    <div className="rail-r">
      <button
        className="stats-ro"
        type="button"
        aria-label="Mastery — click for the star chart"
        onClick={() => setPage('mastery')}
      >
        <p className="lb">
          Mastery <i>click for the chart</i>
        </p>
        <p>
          <span>Spells</span>
          <span>
            <b>{seen}</b> of 10 cast
            {seen > 0 && life.accuracy !== null ? (
              <>
                {' '}
                · <b>{pct(life.accuracy)}</b> overall
              </>
            ) : null}
          </span>
        </p>
      </button>

      <button className="stats-ro" type="button" aria-label="Stats — click for detail" onClick={() => setPage('stats')}>
        <p className="lb">
          Stats <i>click for detail</i>
        </p>
        <p>
          <span>Last run</span>
          <span>
            {lastRun ? (
              <>
                <b>{MODES[lastRun.mode].label}</b> ·{' '}
                <b>
                  {lastRun.score}
                  {MODES[lastRun.mode].scoreBy === 'efficiency' ? '%' : ''}
                </b>{' '}
                · {lastRun.hits} of {lastRun.hits + lastRun.misses} landed
              </>
            ) : (
              'none yet'
            )}
          </span>
        </p>
        <p>
          <span>Overall</span>
          <span>
            <b>{attempted}</b> casts · <b>{life.accuracy === null ? '—' : pct(life.accuracy)}</b>
            {weakest ? (
              <>
                {' '}
                · weakest <b>{weakest.spell.name}</b>
              </>
            ) : null}
          </span>
        </p>
      </button>

      <button className="binds" type="button" aria-label="Bindings — click to change" onClick={() => setPage('keyboard')}>
        <p className="lb">
          Bindings <i>{preset ? preset.label : 'custom'} · click to change</i>
        </p>
        <ul>
          {ACTIONS.map((a) => (
            <li key={a}>
              <span>
                <i style={{ '--c': ACTION_HEX[a] } as CSSProperties} />
                {ACTION_LABEL[a]}
              </span>
              <b>{keyLabel(bindings[a])}</b>
            </li>
          ))}
        </ul>
      </button>
    </div>
  );
}
