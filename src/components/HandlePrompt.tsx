import { useEffect, useRef, useState } from 'react';
import { HANDLE_MAX, suggestHandle, useLeaderboard } from '../leaderboardStore';

/**
 * Asked once, before anything of yours reaches a public board.
 *
 * The Google profile name is offered as a starting point and nothing more —
 * it is a real name for most people, and a scoreboard is a poor place to
 * publish one by default. Nothing is submitted until this is answered.
 */
export function HandlePrompt(): JSX.Element | null {
  const needs = useLeaderboard((s) => s.needsHandle);
  const identity = useLeaderboard((s) => s.identity);
  const current = useLeaderboard((s) => s.handle);
  const setHandle = useLeaderboard((s) => s.setHandle);
  const dismiss = useLeaderboard((s) => s.dismissHandle);

  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!needs) return;
    setValue(current ?? suggestHandle(identity?.name ?? ''));
    // Focus late enough that the field exists, so the first keystroke lands.
    const t = setTimeout(() => input.current?.select(), 30);
    return () => clearTimeout(t);
  }, [needs, current, identity]);

  if (!needs) return null;

  const clean = value.trim().slice(0, HANDLE_MAX);

  return (
    <section className="handle" role="dialog" aria-modal="true" aria-label="Choose a leaderboard name">
      <form
        className="handle-in"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) setHandle(clean);
        }}
      >
        <p className="eb">Leaderboard name</p>
        <h2>What should the board call you?</h2>
        <p className="handle-note">
          This is the only thing other players see. Your email is never shown, and you can change this later from the
          leaderboard panel.
        </p>

        <input
          ref={input}
          className="handle-field"
          value={value}
          maxLength={HANDLE_MAX}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Leaderboard name"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="handle-count">
          {clean.length}/{HANDLE_MAX}
          {identity ? <span> · signed in as {identity.name}</span> : null}
        </p>

        <div className="handle-btns">
          <button className="begin" type="submit" disabled={!clean}>
            Use this name
          </button>
          <button className="begin alt" type="button" onClick={() => dismiss()}>
            Not now
          </button>
        </div>
        <p className="n">Nothing is sent until you choose. Your scores keep waiting either way.</p>
      </form>
    </section>
  );
}
