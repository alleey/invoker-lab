import { useEffect, useRef } from 'react';
import { bars } from '../engine/bars';
import { useStore } from '../store';

/**
 * Opaque on purpose. A frozen board you can still read is a planning aid, so the
 * stage goes away entirely and resuming costs a three count.
 */
export function PausePage(): JSX.Element {
  const paused = useStore((s) => s.paused);
  const resumeUntil = useStore((s) => s.resumeUntil);
  const pausesLeft = useStore((s) => s.pausesLeft);
  const numRef = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    bars.pzNum = numRef.current;
    bars.pzRing = ringRef.current;
    return () => {
      bars.pzNum = null;
      bars.pzRing = null;
    };
  });

  const counting = resumeUntil > 0;
  const left =
    pausesLeft === 0 ? 'Last pause of this run' : pausesLeft === 1 ? '1 pause left' : `${pausesLeft} pauses left`;

  return (
    <section className={`pausepage${paused ? ' on' : ''}`}>
      <div className="pz">
        <h2>Paused</h2>
        <p className="pz-sub">{left}</p>

        <div className={`pz-held${counting ? ' off' : ''}`}>
          <i>
            <span />
            <span />
          </i>
        </div>

        <div className={`pz-count${counting ? ' on' : ''}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="pz-tr" cx="60" cy="60" r="54" />
            <circle className="pz-ar" cx="60" cy="60" r="54" ref={ringRef} />
          </svg>
          <b ref={numRef}>3</b>
        </div>

        <p className="pz-keys">
          <kbd>F9</kbd> or <kbd>Esc</kbd> to resume
        </p>
      </div>
    </section>
  );
}
