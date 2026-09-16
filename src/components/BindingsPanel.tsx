import { ACTION_LABEL, ACTIONS, keyLabel, PRESETS } from '../engine/bindings';
import { useStore } from '../store';

export function BindingsPanel(): JSX.Element {
  const bindings = useStore((s) => s.bindings);
  const presetId = useStore((s) => s.presetId);
  const capturing = useStore((s) => s.capturing);
  const beginCapture = useStore((s) => s.beginCapture);
  const cancelCapture = useStore((s) => s.cancelCapture);
  const applyPreset = useStore((s) => s.applyPreset);

  return (
    <section className="binds" aria-label="Key bindings">
      <div className="gr-head">
        <h2>Bindings</h2>
        <span>{capturing ? 'Press any key' : 'Click to rebind'}</span>
      </div>

      <div className="presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset"
            aria-pressed={presetId === preset.id}
            onClick={() => applyPreset(preset.id)}
            title={preset.hint}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <ul className="bindlist">
        {ACTIONS.map((action) => (
          <li key={action}>
            <span>{ACTION_LABEL[action]}</span>
            <button
              type="button"
              className={`keybtn${capturing === action ? ' capturing' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (capturing === action ? cancelCapture() : beginCapture(action))}
            >
              {capturing === action ? 'Press…' : keyLabel(bindings[action])}
            </button>
          </li>
        ))}
      </ul>

      <p className="bindnote">
        Bindings are stored by physical key position, so they follow your layout. Mouse 3, 4 and 5
        work too — click a key, then press the button. Escape cancels.
      </p>
    </section>
  );
}
