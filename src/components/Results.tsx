import { useStore } from '../store';

export function Results(): JSX.Element | null {
  const result = useStore((s) => s.result);
  const start = useStore((s) => s.start);
  if (!result) return null;

  const { score, hits, misses, combos, bestStreak, avgMs, efficient, judged, previousBest, isRecord } =
    result;
  const headline =
    result.tracksEfficiency && judged > 0 ? Math.round((efficient / judged) * 100) : score;

  return (
    <div className="results">
      <h3>{isRecord ? 'New personal best' : 'Drill complete'}</h3>
      <p className="score">
        {headline}
        {result.tracksEfficiency && judged > 0 && <span className="score-unit">%</span>}
      </p>
      <p className="line">
        {result.tracksEfficiency && judged > 0 ? (
          <>
            <b>{efficient}</b> of <b>{judged}</b> casts took the shortest route
          </>
        ) : result.scoresByStreak ? (
          <>
            longest unbroken run · <b>{hits}</b> landed, <b>{misses}</b> lost
          </>
        ) : (
          <>
            longest streak <b>{bestStreak}</b> · {misses} miss{misses === 1 ? '' : 'es'}
          </>
        )}
      </p>
      <p className="line">
        {combos > 0 && (
          <>
            <b>{combos}</b> chain{combos === 1 ? '' : 's'} · <b>{hits}</b> spells ·{' '}
          </>
        )}
        average <b>{avgMs === null ? '—' : `${(avgMs / 1000).toFixed(2)}s`}</b> per spell
      </p>
      {!isRecord && previousBest > 0 && (
        <p className="line">
          best in this mode: <b>{previousBest}</b>
        </p>
      )}
      <p className="results-hint">Per-spell breakdown for this run is in the Grimoire →</p>
      <button type="button" className="btn primary" onClick={() => start()}>
        Run it back
      </button>
    </div>
  );
}
