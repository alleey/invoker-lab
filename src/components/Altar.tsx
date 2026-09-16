import { type CSSProperties } from 'react';
import { keyLabel, type Action } from '../engine/bindings';
import { dark } from '../engine/format';
import { MAX_ORBS } from '../engine/orbs';
import { ORB_INFO, type Orb } from '../engine/spells';
import { useHotAction } from '../hooks/useHotAction';
import { useStore } from '../store';

const CAPS: { action: Action; hex: string; label: string }[] = [
  { action: 'quas', hex: ORB_INFO.quas.hex, label: 'Quas' },
  { action: 'wex', hex: ORB_INFO.wex.hex, label: 'Wex' },
  { action: 'exort', hex: ORB_INFO.exort.hex, label: 'Exort' },
  { action: 'invoke', hex: '#ffd76a', label: 'Invoke' },
];

const SOCKETS = Array.from({ length: MAX_ORBS }, (_, i) => i);

/**
 * One four-column grid: each socket sits over its keycap, and the two slot
 * plates span two columns each. The columns are wider than the sockets need
 * because the plates have to fit a name like Deafening Blast.
 *
 * The top row holds the three reagents and nothing else. It once ended in an
 * invoke charge ring, but a socket filling up already says how many reagents
 * you hold, and the Invoke keycap below still invokes on click.
 */
export function Altar(): JSX.Element {
  const orbs = useStore((s) => s.orbs);
  const slots = useStore((s) => s.slots);
  const bindings = useStore((s) => s.bindings);
  const castOrb = useStore((s) => s.castOrb);
  const invoke = useStore((s) => s.invoke);
  const castSlot = useStore((s) => s.castSlot);
  const markFlash = useStore((s) => s.markFlash);
  const hot = useHotAction();

  const press = (a: Action) => {
    markFlash(a);
    if (a === 'invoke') invoke();
    else if (a === 'slot1') castSlot(0);
    else if (a === 'slot2') castSlot(1);
    else castOrb(a as Orb);
  };

  return (
    <section className="altar">
      <div className="sockets">
        {SOCKETS.map((i) => {
          const o = orbs[i];
          return (
            <span
              key={i}
              className={`socket${o ? ' f' : ''}`}
              title={o ? ORB_INFO[o].name : 'Empty'}
              style={o ? ({ '--c': ORB_INFO[o].hex, '--cd': dark(ORB_INFO[o].hex) } as CSSProperties) : undefined}
            />
          );
        })}
      </div>

      {([0, 1] as const).map((i) => {
        const sp = slots[i];
        const action: Action = i === 0 ? 'slot1' : 'slot2';
        return (
          <button
            key={i}
            className={`slot${sp ? ' loaded' : ''}${hot === action ? ' hit' : ''}`}
            type="button"
            disabled={!sp}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(action)}
            aria-label={sp ? `Cast ${sp.name} from slot ${i + 1}` : `Slot ${i + 1} empty`}
          >
            <kbd>{keyLabel(bindings[action])}</kbd>
            <span className="nm">{sp ? sp.name : 'Nothing invoked'}</span>
          </button>
        );
      })}

      {CAPS.map(({ action, hex, label }) => (
        <button
          key={action}
          className={`cap${hot === action ? ' hit' : ''}`}
          type="button"
          style={{ '--c': hex } as CSSProperties}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press(action)}
          aria-label={`${label} — ${keyLabel(bindings[action])}`}
        >
          <b>{keyLabel(bindings[action])}</b>
          <i>{label}</i>
        </button>
      ))}
    </section>
  );
}
