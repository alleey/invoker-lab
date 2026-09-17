import { useEffect, useRef } from 'react';
import { bars } from '../engine/bars';
import { useStore } from '../store';
import { SpellIcon } from './SpellIcon';

/**
 * What you owe and what is coming, on the constellation's centre line.
 *
 * Shown in every mode, not only the chaining ones. A single-spell drill used to
 * put its target in the far-left rail while a chain put it here, so the one
 * thing you read every few seconds moved depending on the mode.
 */
export function StageBar(): JSX.Element | null {
  const running = useStore((s) => s.running);
  const combo = useStore((s) => s.combo);
  const next = useStore((s) => s.nextCombo);
  const step = useStore((s) => s.step);
  const spellTimeoutMs = useStore((s) => s.spellTimeoutMs);
  const shotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    bars.shot = shotRef.current;
    return () => {
      bars.shot = null;
    };
  });

  if (!running || combo.length === 0) return null;

  return (
    <div className="stagebar">
      <div className="chain">
        {combo.map((s, i) => (
          <span key={`${s.id}-${i}`} className={i < step ? 'done' : i === step ? 'now' : ''}>
            <SpellIcon spell={s} size={20} />
            {s.name}
          </span>
        ))}
        {next.length > 0 && (
          <>
            <b className="chain-sep" aria-hidden="true" />
            {next.map((s, i) => (
              <span key={`next-${s.id}-${i}`} className="next" title="Coming next">
                <SpellIcon spell={s} size={20} />
                {s.name}
              </span>
            ))}
          </>
        )}
      </div>
      {spellTimeoutMs > 0 && (
        <div className="shot">
          <span ref={shotRef} />
        </div>
      )}
    </div>
  );
}
