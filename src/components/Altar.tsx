import { useEffect, useRef, type CSSProperties } from 'react';
import { keyLabel } from '../engine/bindings';
import { orbIcon } from '../engine/icons';
import { MAX_ORBS } from '../engine/orbs';
import { ORB_INFO } from '../engine/spells';
import { useHotAction } from '../hooks/useHotAction';
import { useStore } from '../store';
import { Sigil } from './Sigil';
import { SpellIcon } from './SpellIcon';

const SOCKETS = Array.from({ length: MAX_ORBS }, (_, i) => i);

const RING_RADIUS = 27;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function Altar(): JSX.Element {
  const orbs = useStore((s) => s.orbs);
  const slots = useStore((s) => s.slots);
  const shake = useStore((s) => s.shake);
  const celebration = useStore((s) => s.celebration);
  const bindings = useStore((s) => s.bindings);
  const castSlot = useStore((s) => s.castSlot);
  const markFlash = useStore((s) => s.markFlash);
  const hot = useHotAction();

  const altarRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLSpanElement>(null);

  // Restart the CSS animations by forcing a reflow between remove and add.
  useEffect(() => {
    const el = altarRef.current;
    if (!el || shake === 0) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }, [shake]);

  useEffect(() => {
    const el = waveRef.current;
    if (!el || !celebration) return;
    el.style.borderColor = celebration.hex;
    el.classList.remove('fire');
    void el.offsetWidth;
    el.classList.add('fire');
  }, [celebration]);

  const charge = orbs.length / MAX_ORBS;
  const ready = orbs.length === MAX_ORBS;
  const newest = orbs[orbs.length - 1];

  return (
    <div className="altar-group">
      <div className="mechanism" ref={altarRef}>
        <div className="altar">
          {/* Conduit runs through the sockets, behind them, filling as reagents stack. */}
          <span className="conduit" aria-hidden="true">
            <span
              className="conduit-fill"
              style={
                {
                  scale: `${charge} 1`,
                  '--lead': newest ? ORB_INFO[newest].hex : 'transparent',
                } as CSSProperties
              }
            />
          </span>
          <span className="wave" ref={waveRef} />
          {SOCKETS.map((i) => {
            const orb = orbs[i];
            const art = orb ? orbIcon(orb) : null;
            return (
              <div
                key={i}
                className={`socket${orb ? ' filled' : ''}${art ? ' has-art' : ''}`}
                style={orb ? ({ '--oc': ORB_INFO[orb].hex } as CSSProperties) : undefined}
                title={orb ? ORB_INFO[orb].name : 'Empty'}
              >
                {!orb && <span>empty</span>}
                {orb && art && <img className="orb-art" src={art} alt="" />}
              </div>
            );
          })}
        </div>

        {/* Invoke sigil: charges with the queue, ignites at three. */}
        <div className={`sigil-core${ready ? ' ready' : ''}`} title={ready ? 'Ready to invoke' : 'Stack three reagents'}>
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle className="sigil-track" cx="32" cy="32" r={RING_RADIUS} />
            <circle
              className="sigil-charge"
              cx="32"
              cy="32"
              r={RING_RADIUS}
              strokeDasharray={`${charge * RING_LENGTH} ${RING_LENGTH}`}
            />
            <path className="sigil-mark" d="M32 18 L43 38 H21 Z" />
            <circle className="sigil-pip" cx="32" cy="32" r="2.4" />
          </svg>
          <span className="sigil-key">{keyLabel(bindings.invoke)}</span>
        </div>
      </div>

      {/* The plates are the slot controls. Drawing a separate pair of keycaps
          below would just repeat the letter next to the same spell. */}
      <div className="slots">
        {([0, 1] as const).map((i) => {
          const spell = slots[i];
          const action = i === 0 ? 'slot1' : 'slot2';
          const code = i === 0 ? bindings.slot1 : bindings.slot2;
          return (
            <button
              key={i}
              type="button"
              className={`slot${spell ? ' loaded' : ''}${hot === action ? ' hit' : ''}`}
              disabled={!spell}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                markFlash(action);
                castSlot(i);
              }}
              aria-label={
                spell ? `Cast ${spell.name} from slot ${i + 1}, bound to ${keyLabel(code)}` : `Slot ${i + 1} empty`
              }
            >
              <span className="slot-key">{keyLabel(code)}</span>
              {spell ? (
                <>
                  <span className="slot-glyph">
                    <SpellIcon spell={spell} size={22} />
                  </span>
                  <span className="slot-name">{spell.name}</span>
                  <Sigil orbs={spell.orbs} />
                </>
              ) : (
                <span className="slot-empty">Nothing invoked</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
