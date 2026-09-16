import { useEffect, useRef } from 'react';
import { bars } from '../engine/bars';
import { useStore } from '../store';
import { SpellIcon } from './SpellIcon';

/**
 * Chain and shot clock, centred on the constellation via --cx. They used to live
 * in the left rail, which on a wide screen sits so far from where you are looking
 * that it may as well not be there.
 */
export function StageBar(): JSX.Element | null {
  const running = useStore((s) => s.running);
  const combo = useStore((s) => s.combo);
  const step = useStore((s) => s.step);
  const spellTimeoutMs = useStore((s) => s.spellTimeoutMs);
  const shotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    bars.shot = shotRef.current;
    return () => {
      bars.shot = null;
    };
  });

  if (!running) return null;

  return (
    <div className="stagebar">
      {combo.length > 1 && (
        <div className="chain">
          {combo.map((s, i) => (
            <span key={`${s.id}-${i}`} className={i < step ? 'done' : i === step ? 'now' : ''}>
              <SpellIcon spell={s} size={20} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {spellTimeoutMs > 0 && (
        <div className="shot">
          <span ref={shotRef} />
        </div>
      )}
    </div>
  );
}
