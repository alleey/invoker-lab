import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Aether } from './components/Aether';
import { Altar } from './components/Altar';
import { BindingsPanel } from './components/BindingsPanel';
import { Burst } from './components/Burst';
import { CrashNotice } from './components/CrashNotice';
import { Cue } from './components/Cue';
import { Grimoire } from './components/Grimoire';
import { Keycaps } from './components/Keycaps';
import { Results } from './components/Results';
import { Tiles } from './components/Tiles';
import { keyLabel, loadKeyboardLayout } from './engine/bindings';
import { startBlackBox } from './engine/blackbox';
import { MODE_ORDER, MODES } from './engine/modes';
import { ORB_INFO } from './engine/spells';
import { useInput } from './hooks/useInput';
import { useStore } from './store';

/**
 * Escape hatch for isolating GPU trouble: load with `?noaether` to drop the
 * particle canvas. If a crash stops happening with it off, the compositor is
 * the culprit rather than anything in the game logic.
 */
const NO_AETHER =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noaether');

export function App(): JSX.Element {
  useInput();

  const mode = useStore((s) => s.mode);
  const running = useStore((s) => s.running);
  const orbs = useStore((s) => s.orbs);
  const bindings = useStore((s) => s.bindings);
  const setMode = useStore((s) => s.setMode);
  const toggleRun = useStore((s) => s.toggleRun);
  const clearOrbs = useStore((s) => s.clearOrbs);

  const fillRef = useRef<HTMLSpanElement>(null);
  const shotRef = useRef<HTMLSpanElement>(null);
  const [, bumpLayout] = useState(0);

  // Chromium can tell us the real cap legend; re-render once it answers.
  useEffect(() => {
    void loadKeyboardLayout().then(() => bumpLayout((n) => n + 1));
  }, []);

  // Records the last second before a crash. Reads the store directly so it
  // never re-subscribes and never re-renders anything.
  useEffect(
    () =>
      startBlackBox(() => {
        const s = useStore.getState();
        return { mode: s.mode, running: s.running, casts: s.hits, orbs: s.orbs.length };
      }),
    [],
  );

  // The countdown bar is driven straight off the DOM node. Routing it through
  // the store would re-render the whole tree sixty times a second for a stripe.
  useEffect(() => {
    const bar = fillRef.current;
    if (!bar) return;
    const duration = useStore.getState().runDurationMs;
    if (!running) {
      bar.style.scale = '0 1';
      return;
    }
    if (!duration) bar.style.scale = '1 1';

    let frame = 0;
    const tick = () => {
      const st = useStore.getState();
      const now = performance.now();

      if (duration) {
        const left = st.endsAt - now;
        bar.style.scale = `${Math.max(0, Math.min(1, left / duration))} 1`;
        if (left <= 0) {
          st.finish();
          return;
        }
      }

      // The per-spell shot clock, when the mode has one.
      const shot = shotRef.current;
      if (shot && st.spellTimeoutMs > 0 && st.spellEndsAt > 0) {
        const left = st.spellEndsAt - now;
        shot.style.scale = `${Math.max(0, Math.min(1, left / st.spellTimeoutMs))} 1`;
        if (left <= 0) st.spellTimedOut();
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, mode]);

  const untargeted = MODES[mode].comboSizes.length === 0;
  const newest = orbs[orbs.length - 1];
  const oldest = orbs[0];
  const ambient = {
    '--amb-a': newest ? ORB_INFO[newest].hex : ORB_INFO.quas.hex,
    '--amb-b': oldest ? ORB_INFO[oldest].hex : ORB_INFO.exort.hex,
  } as CSSProperties;

  return (
    <>
      <div className="ambient" style={ambient}>
        {!NO_AETHER && <Aether />}
      </div>

      <div className="shell">
        <header className="top">
          <div className="brand">
            {/* Same file the browser uses as the favicon, so the mark can only
                ever be changed in one place. */}
            <img className="seal" src={`${import.meta.env.BASE_URL}seal.svg`} alt="" width={46} height={46} />
            <div>
              <h1>Invoker Lab</h1>
              <p className="sub">Reagent drill</p>
            </div>
          </div>
          <div className="legend">
            {(['quas', 'wex', 'exort'] as const).map((orb) => (
              <span key={orb} style={{ color: ORB_INFO[orb].hex }}>
                <b>{keyLabel(bindings[orb])}</b>
                <span>
                  {ORB_INFO[orb].name} · {ORB_INFO[orb].element.toLowerCase()}
                </span>
              </span>
            ))}
          </div>
        </header>

        <nav className="modes" aria-label="Practice mode">
          {MODE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="mode"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              {MODES[id].label}
            </button>
          ))}
        </nav>
        <CrashNotice />

        <Tiles />

        <div className="stage">
          <section className="arena">
            <Burst />
            <Cue />
            {running && MODES[mode].spellTimeoutOptions.length > 0 && (
              <div className="shotbar" aria-hidden="true">
                <span ref={shotRef} />
              </div>
            )}
            <div className="timerbar">
              <span ref={fillRef} />
            </div>
            <Altar />
            <Keycaps />
            <div className="controls">
              <button
                type="button"
                className="btn primary"
                disabled={untargeted}
                onClick={() => toggleRun()}
              >
                {running ? 'End drill' : untargeted ? 'Practice active' : 'Begin drill'}
              </button>
              <button type="button" className="btn" onClick={() => clearOrbs()}>
                Clear orbs
              </button>
            </div>
            <Results />
          </section>

          <div className="rail">
            <Grimoire />
            <BindingsPanel />
          </div>
        </div>

        <p className="foot">
          <span>
            <kbd>{keyLabel(bindings.quas)}</kbd> <kbd>{keyLabel(bindings.wex)}</kbd>{' '}
            <kbd>{keyLabel(bindings.exort)}</kbd> stack orbs — a fourth pushes the oldest out
          </span>
          <span>
            <kbd>{keyLabel(bindings.invoke)}</kbd> invokes into slot 1, then{' '}
            <kbd>{keyLabel(bindings.slot1)}</kbd> or <kbd>{keyLabel(bindings.slot2)}</kbd> casts
          </span>
          <span>
            <kbd>Space</kbd> start and stop · <kbd>Esc</kbd> clear orbs
          </span>
        </p>
      </div>
    </>
  );
}
