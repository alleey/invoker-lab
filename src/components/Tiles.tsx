import { MODES } from '../engine/modes';
import { useStore } from '../store';

const pct = (part: number, whole: number): string => `${Math.round((part / whole) * 100)}`;

export function Tiles(): JSX.Element {
  const mode = useStore((s) => s.mode);
  const hits = useStore((s) => s.hits);
  const misses = useStore((s) => s.misses);
  const combos = useStore((s) => s.combos);
  const streak = useStore((s) => s.streak);
  const bestStreak = useStore((s) => s.bestStreak);
  const timeTotal = useStore((s) => s.timeTotal);
  const optimalChains = useStore((s) => s.optimalChains);
  const judgedChains = useStore((s) => s.judgedChains);

  const config = MODES[mode];
  const chains = config.comboSizes.some((n) => n > 1);
  const avg = hits > 0 ? timeTotal / hits / 1000 : null;
  const attempts = hits + misses;

  return (
    <dl className="tiles">
      <div className="tile">
        <dt>{chains ? 'Chains' : 'Casts'}</dt>
        <dd>
          {chains ? combos : hits}
          {chains && hits > 0 && <small>{hits} spells</small>}
        </dd>
      </div>
      <div className="tile">
        <dt>Streak</dt>
        <dd className="gold">
          {streak}
          {bestStreak > streak && <small>best {bestStreak}</small>}
        </dd>
      </div>
      <div className="tile">
        <dt>Avg chain</dt>
        <dd>{avg === null ? '—' : <>{avg.toFixed(2)}<small>s</small></>}</dd>
      </div>
      {config.trackEfficiency ? (
        <div className="tile">
          <dt>Efficient</dt>
          <dd className={judgedChains === 0 ? '' : optimalChains === judgedChains ? 'even' : 'over'}>
            {judgedChains === 0 ? '—' : <>{pct(optimalChains, judgedChains)}<small>%</small></>}
          </dd>
        </div>
      ) : (
        <div className="tile">
          <dt>Accuracy</dt>
          <dd className={attempts === 0 ? '' : misses === 0 ? 'even' : 'over'}>
            {attempts === 0 ? '—' : <>{pct(hits, attempts)}<small>%</small></>}
          </dd>
        </div>
      )}
    </dl>
  );
}
