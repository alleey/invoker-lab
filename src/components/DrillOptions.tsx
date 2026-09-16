import type { Mode } from '../engine/modes';
import { useStore, WEAK_POOL_SIZE } from '../store';

interface Props {
  mode: Mode;
}

/**
 * Everything you choose before pressing Begin. Absent while a drill runs —
 * changing the clock or the spell pool mid-run would make the score meaningless.
 *
 * The weakness filter is deliberately not a mode: it is orthogonal to all of
 * them, so it lives here and applies to whichever one you are in.
 */
export function DrillOptions({ mode }: Props): JSX.Element | null {
  const lengths = useStore((s) => s.lengths);
  const timeouts = useStore((s) => s.timeouts);
  const focusWeak = useStore((s) => s.prefs.focusWeak);
  const setLength = useStore((s) => s.setLength);
  const setSpellTimeout = useStore((s) => s.setSpellTimeout);
  const setFocusWeak = useStore((s) => s.setFocusWeak);

  const targeted = mode.comboSizes.length > 0;
  if (!targeted) return null;

  const clock = lengths[mode.id] || mode.defaultDuration;
  const shotClock = timeouts[mode.id] || mode.defaultSpellTimeout;

  return (
    <div className="options">
      {mode.durationOptions.length > 0 && (
        <div className="option">
          <span className="option-label">Session</span>
          <div className="seg" role="group" aria-label="Session length">
            {mode.durationOptions.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={clock === value}
                onClick={() => setLength(mode.id, value)}
              >
                {Math.round(value / 1000)}s
              </button>
            ))}
          </div>
        </div>
      )}

      {mode.spellTimeoutOptions.length > 0 && (
        <div className="option">
          <span className="option-label">Per spell</span>
          <div className="seg" role="group" aria-label="Seconds per spell">
            {mode.spellTimeoutOptions.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={shotClock === value}
                onClick={() => setSpellTimeout(mode.id, value)}
              >
                {Math.round(value / 1000)}s
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="option">
        <span className="option-label">Spell pool</span>
        <div className="seg" role="group" aria-label="Spell pool">
          <button type="button" aria-pressed={!focusWeak} onClick={() => setFocusWeak(false)}>
            All 10
          </button>
          <button type="button" aria-pressed={focusWeak} onClick={() => setFocusWeak(true)}>
            Weakest {WEAK_POOL_SIZE}
          </button>
        </div>
      </div>
    </div>
  );
}
