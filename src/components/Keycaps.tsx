import { type CSSProperties } from 'react';
import { keyLabel, type Action } from '../engine/bindings';
import { iconFor } from '../engine/icons';
import { ORB_INFO } from '../engine/spells';
import { useHotAction } from '../hooks/useHotAction';
import { useStore } from '../store';

/**
 * Only the keys that BUILD a spell live here. The two slot keys are drawn on
 * the slot plates themselves, next to the spell they actually fire.
 */
const BUILD_ROW: { action: Action; tint: string; caption: string }[] = [
  { action: 'quas', tint: ORB_INFO.quas.hex, caption: 'Quas' },
  { action: 'wex', tint: ORB_INFO.wex.hex, caption: 'Wex' },
  { action: 'exort', tint: ORB_INFO.exort.hex, caption: 'Exort' },
  { action: 'invoke', tint: '#ffcf6b', caption: 'Invoke' },
];

export function Keycaps(): JSX.Element {
  const bindings = useStore((s) => s.bindings);
  const castOrb = useStore((s) => s.castOrb);
  const invoke = useStore((s) => s.invoke);
  const markFlash = useStore((s) => s.markFlash);
  const hot = useHotAction();

  const press = (action: Action) => {
    markFlash(action);
    if (action === 'invoke') invoke();
    else if (action === 'quas' || action === 'wex' || action === 'exort') castOrb(action);
  };

  return (
    <div className="keys">
      {BUILD_ROW.map(({ action, tint, caption }) => {
        const art = iconFor(action);
        return (
          <button
            key={action}
            type="button"
            className={`cap${hot === action ? ' hit' : ''}`}
            style={{ '--cc': tint } as CSSProperties}
            // Never take focus on click, or Space would double-fire through the button.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(action)}
            aria-label={`${caption} — bound to ${keyLabel(bindings[action])}`}
          >
            {art && <img className="cap-art" src={art} alt="" />}
            <b>{keyLabel(bindings[action])}</b>
            <i>{caption}</i>
          </button>
        );
      })}
    </div>
  );
}
