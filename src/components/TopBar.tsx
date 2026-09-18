import { useEffect, useRef } from 'react';
import { bars, mmss } from '../engine/bars';
import { MODE_ORDER, MODES } from '../engine/modes';
import { useStore } from '../store';

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const sec = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export function TopBar(): JSX.Element {
  const mode = useStore((s) => s.mode);
  const running = useStore((s) => s.running);
  const hits = useStore((s) => s.hits);
  const misses = useStore((s) => s.misses);
  const combos = useStore((s) => s.combos);
  const streak = useStore((s) => s.streak);
  const bestStreak = useStore((s) => s.bestStreak);
  const timeTotal = useStore((s) => s.timeTotal);
  const optimalChains = useStore((s) => s.optimalChains);
  const judgedChains = useStore((s) => s.judgedChains);
  const lengths = useStore((s) => s.lengths);
  const setMode = useStore((s) => s.setMode);

  const tbarRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLElement>(null);

  // Hand the render loop direct handles; it writes these every frame.
  useEffect(() => {
    bars.tbar = tbarRef.current;
    bars.clock = clockRef.current;
    return () => {
      bars.tbar = null;
      bars.clock = null;
    };
  });

  /*
   * The loop writes this node behind React's back, so when a run ends React
   * sees the same JSX it rendered before and leaves the DOM alone — the tile
   * keeps showing whatever the final frame put there. Put the idle value back
   * by hand, since nothing else can.
   */
  useEffect(() => {
    if (running || !clockRef.current) return;
    const c = MODES[mode];
    clockRef.current.textContent = c.durationOptions.length
      ? mmss(lengths[mode] || c.defaultDuration)
      : '—';
  }, [running, mode, lengths]);

  const c = MODES[mode];
  const chains = c.comboSizes.some((n) => n > 1);
  const avg = hits ? timeTotal / hits : null;
  const attempts = hits + misses;
  const idleClock = lengths[mode] || c.defaultDuration;

  return (
    <>
      <div className="tbar">
        <span ref={tbarRef} />
      </div>
      <header className="top">
        <div className="title">
          <h1>Invoker Lab</h1>
          <p>Arsenal Magus is hard to learn, harder still to master.</p>
          <p className="ver">ver. {__BUILD_ID__}</p>
        </div>

        <nav className="modes" aria-label="Practice mode">
          {MODE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="mode"
              aria-pressed={mode === id}
              disabled={running}
              onClick={() => setMode(id)}
            >
              {MODES[id].label}
            </button>
          ))}
        </nav>

        <div className="tiles">
          <div>
            <span>{chains ? 'Chains' : 'Casts'}</span>
            <b>
              {chains ? combos : hits}
              {chains && hits ? <small>{hits} spells</small> : null}
            </b>
          </div>
          <div>
            <span>Streak</span>
            <b className="gold">
              {streak}
              {bestStreak > streak ? <small>best {bestStreak}</small> : null}
            </b>
          </div>
          <div>
            <span>Avg</span>
            <b>{avg === null ? '—' : sec(avg)}</b>
          </div>
          <div>
            <span>Accuracy</span>
            <b className={attempts ? (misses ? 'bad' : 'good') : ''}>{attempts ? pct(hits / attempts) : '—'}</b>
          </div>
          <div>
            <span>Efficient</span>
            <b className={judgedChains ? (optimalChains === judgedChains ? 'good' : 'bad') : ''}>
              {judgedChains ? pct(optimalChains / judgedChains) : '—'}
            </b>
          </div>
          <div>
            <span>Clock</span>
            <b ref={clockRef}>{c.durationOptions.length ? mmss(idleClock) : '—'}</b>
          </div>
        </div>
      </header>
    </>
  );
}
