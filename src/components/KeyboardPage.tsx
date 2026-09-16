import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ACTION_HEX,
  ACTION_LABEL,
  ACTIONS,
  isOrbAction,
  keyLabel,
  PRESETS,
  RESERVED_CODES,
  type Action,
  type Bindings,
} from '../engine/bindings';
import { dark } from '../engine/format';
import { useHotAction } from '../hooks/useHotAction';
import { useStore } from '../store';

/** The board, by physical position. `off` is the row's stagger in pixels. */
const ROWS: { off: number; keys: readonly string[] }[] = [
  { off: 0, keys: ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'] },
  { off: 30, keys: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'] },
  { off: 46, keys: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'] },
  { off: 76, keys: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'] },
  { off: 136, keys: ['Space'] },
];

const MINI_ROWS = ['QWERTYUIOP', 'ASDFGHJKL;', 'ZXCVBNM,./'];
const MINI_CODE = (ch: string): string =>
  /[A-Z]/.test(ch)
    ? `Key${ch}`
    : ch === ';'
      ? 'Semicolon'
      : ch === ','
        ? 'Comma'
        : ch === '.'
          ? 'Period'
          : 'Slash';

const MOUSE_BUTTONS = [
  { code: 'Mouse3', x: 39, y: 18, w: 14, h: 26, r: 6, tx: 46, ty: 54, label: 'M3' },
  { code: 'Mouse4', x: 2, y: 66, w: 10, h: 22, r: 3, tx: 7, ty: 100, label: 'M4' },
  { code: 'Mouse5', x: 2, y: 94, w: 10, h: 22, r: 3, tx: 7, ty: 128, label: 'M5' },
];

const actionFor = (bindings: Bindings, code: string | null): Action | null =>
  code ? (ACTIONS.find((a) => bindings[a] === code) ?? null) : null;

interface Drag {
  action: Action;
  x0: number;
  y0: number;
  moved: boolean;
}

/** The pill in the tray: an orb for a reagent, a sigil for invoke and the slots. */
function TokenFace({ action }: { action: Action }): JSX.Element {
  if (isOrbAction(action)) return <span className="orb" />;
  if (action === 'invoke') {
    return (
      <span className="sigil">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.5 20.5 19.5H3.5Z" />
          <circle cx="12" cy="14.2" r="1.7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="sigil">
      <b>{action === 'slot1' ? '1' : '2'}</b>
    </span>
  );
}

/**
 * Binding by position rather than by letter. Drag a reagent onto a key, or click
 * it and press the key you want — the second way is the only one that can reach
 * a mouse button, so both exist.
 */
export function KeyboardPage(): JSX.Element {
  const open = useStore((s) => s.kbOpen);
  const bindings = useStore((s) => s.bindings);
  const presetId = useStore((s) => s.presetId);
  const capturing = useStore((s) => s.capturing);
  const hot = useHotAction();

  const [over, setOver] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ action: Action; x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const ghostEl = useRef<HTMLSpanElement>(null);
  const overRef = useRef<string | null>(null);

  /**
   * Move and release are on the window, not the token: a drag that leaves the
   * pill — which every useful drag does — would otherwise stop getting events.
   * They stay attached for as long as the page is open rather than for the
   * duration of a drag, because a pointerdown sets a ref, and a ref change is
   * not something an effect can wait for.
   */
  useEffect(() => {
    if (!open) return;

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) <= 6) return;
        d.moved = true;
        setGhost({ action: d.action, x: e.clientX, y: e.clientY });
      }
      // Written straight to the node: a ghost that re-rendered on every pointer
      // move would re-render the whole board with it.
      const node = ghostEl.current;
      if (node) {
        node.style.left = `${e.clientX}px`;
        node.style.top = `${e.clientY}px`;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const key = el?.closest('[data-code]') as HTMLElement | null;
      const code = key?.dataset.code ?? null;
      if (code !== overRef.current) {
        overRef.current = code;
        setOver(code);
      }
    };

    const onUp = () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const store = useStore.getState();
      if (d.moved) {
        const code = overRef.current;
        if (code && !RESERVED_CODES.includes(code)) store.bindKey(d.action, code);
        else store.cancelCapture();
      } else {
        // A click without a drag arms the key-press route instead.
        if (store.capturing === d.action) store.cancelCapture();
        else store.beginCapture(d.action);
      }
      overRef.current = null;
      setOver(null);
      setGhost(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [open]);

  // Closing mid-drag would leave a ghost pinned to the page.
  useEffect(() => {
    if (!open) {
      drag.current = null;
      overRef.current = null;
      setOver(null);
      setGhost(null);
    }
  }, [open]);

  if (!open) return <section className="kbpage" aria-hidden="true" />;

  const startDrag = (action: Action) => (e: ReactPointerEvent) => {
    e.preventDefault();
    drag.current = { action, x0: e.clientX, y0: e.clientY, moved: false };
  };

  const keyClass = (code: string): string => {
    const a = actionFor(bindings, code);
    return [
      'kk',
      code === 'Space' ? 'space' : '',
      a ? 'bound' : '',
      a && hot === a ? 'hit' : '',
      over === code ? 'drop' : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  const onKeyPick = (code: string) => {
    if (RESERVED_CODES.includes(code)) return;
    const store = useStore.getState();
    if (store.capturing) store.commitCapture(code);
  };

  return (
    <section className="kbpage on">
      <div className="kb-head">
        <p className="eb">Bindings</p>
        <h2>Drop a reagent on a key</h2>
        <p>
          Or click one, then press the key you want. Taking a key that is already in use swaps the two. Mouse 3, 4 and
          5 work the same way.
        </p>
      </div>
      <button className="btn kb-done" type="button" onClick={() => useStore.getState().setPage(null)}>
        Done · Esc
      </button>

      <div className="kb-wrap">
        <div>
          <p className="lb" style={{ marginBottom: 8 }}>
            Presets
          </p>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className="preset"
                type="button"
                aria-pressed={presetId === p.id}
                onClick={() => useStore.getState().applyPreset(p.id)}
              >
                <span className="mini">
                  {MINI_ROWS.flatMap((row, r) =>
                    [...row].map((ch, i) => {
                      const a = ACTIONS.find((x) => p.bindings[x] === MINI_CODE(ch));
                      return (
                        <i
                          key={`${r}-${i}`}
                          className={a ? 'on' : ''}
                          style={{ '--c': a ? ACTION_HEX[a] : '' } as CSSProperties}
                        />
                      );
                    }),
                  )}
                  <i
                    className={`sp${p.bindings.invoke === 'Space' ? ' on' : ''}`}
                    style={{ '--c': '#ffd76a' } as CSSProperties}
                  />
                </span>
                <span className="txt">
                  <b>{p.label}</b>
                  <span>{p.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="tray">
            {ACTIONS.map((a) => (
              <button
                key={a}
                className={`token${capturing === a ? ' capturing' : ''}`}
                type="button"
                style={{ '--c': ACTION_HEX[a], '--cd': dark(ACTION_HEX[a]) } as CSSProperties}
                aria-label={`${ACTION_LABEL[a]}, bound to ${keyLabel(bindings[a])}`}
                onPointerDown={startDrag(a)}
              >
                <TokenFace action={a} />
                <span className="nm">{ACTION_LABEL[a]}</span>
                <span className="cur">{keyLabel(bindings[a])}</span>
              </button>
            ))}
          </div>

          <div className="keyboard">
            {ROWS.map((row, r) => (
              <div className="krow" key={r} style={{ marginLeft: row.off }}>
                {row.keys.map((code) => {
                  const a = actionFor(bindings, code);
                  return (
                    <button
                      key={code}
                      className={keyClass(code)}
                      data-code={code}
                      type="button"
                      style={{ '--c': a ? ACTION_HEX[a] : '' } as CSSProperties}
                      onClick={() => onKeyPick(code)}
                    >
                      <span>{keyLabel(code)}</span>
                      <small>{a ? ACTION_LABEL[a] : ''}</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mouse">
          <p className="lb">Mouse</p>
          <svg viewBox="0 0 92 140" aria-hidden="true">
            <path
              d="M46 6c-22 0-36 16-36 40v50c0 22 14 38 36 38s36-16 36-38V46C82 22 68 6 46 6z"
              fill="rgba(7,5,4,.5)"
              stroke="rgba(184,147,74,.35)"
            />
            <path d="M46 6v52M10 58h72" stroke="rgba(184,147,74,.25)" fill="none" />
            {MOUSE_BUTTONS.map((b) => {
              const a = actionFor(bindings, b.code);
              return (
                <g key={b.code}>
                  <rect
                    className={`mb${a ? ' bound' : ''}${over === b.code ? ' drop' : ''}`}
                    data-code={b.code}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx={b.r}
                    style={
                      { '--c': a ? ACTION_HEX[a] : '', '--cd': a ? dark(ACTION_HEX[a]) : '' } as CSSProperties
                    }
                    onClick={() => onKeyPick(b.code)}
                  />
                  <text x={b.tx} y={b.ty} textAnchor="middle">
                    {b.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="kb-foot">
        <span>
          <b>Binds follow the key, not the letter.</b> Change your keyboard layout and your binds stay where your
          fingers are.
        </span>
      </div>

      {ghost && (
        <span
          className="ghost"
          ref={ghostEl}
          style={
            {
              '--c': ACTION_HEX[ghost.action],
              '--cd': dark(ACTION_HEX[ghost.action]),
              left: ghost.x,
              top: ghost.y,
            } as CSSProperties
          }
        />
      )}
    </section>
  );
}
