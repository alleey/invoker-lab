import { useEffect, useRef, useState } from 'react';
import { renderSignInButton } from '../engine/auth';
import { leaderboardConfigured } from '../engine/leaderboard';
import { MODE_ORDER, MODES, type ModeId } from '../engine/modes';
import { ago, scoreUnit } from '../engine/format';
import { useLeaderboard } from '../leaderboardStore';
import { useStore } from '../store';

/** Google's button, wherever one is needed. */
function SignInButton(): JSX.Element {
  const setIdentity = useLeaderboard((s) => s.setIdentity);
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    renderSignInButton(ref.current, setIdentity).catch(() => setFailed(true));
  }, [setIdentity]);

  if (failed) return <p className="landing-off">Sign-in is unavailable right now.</p>;
  return <div className="gbtn" ref={ref} />;
}

/**
 * One mode at a time, in full.
 *
 * Five boards side by side left room for about seven names each and nothing
 * else. A tab spends the whole width on one mode, which is what buys the full
 * twenty-five, the date, and somewhere for the top three to be treated as the
 * top three.
 */
export function LeaderboardPage(): JSX.Element {
  const open = useLeaderboard((s) => s.open);
  const boards = useLeaderboard((s) => s.boards);
  const outbox = useLeaderboard((s) => s.outbox);
  const identity = useLeaderboard((s) => s.identity);
  const loading = useLeaderboard((s) => s.boardsLoading);
  const failed = useLeaderboard((s) => s.boardsFailed);
  const setOpen = useLeaderboard((s) => s.setOpen);
  const signOut = useLeaderboard((s) => s.signOut);
  const handle = useLeaderboard((s) => s.handle);
  const askHandle = useLeaderboard((s) => s.askHandle);
  const myBests = useStore((s) => s.stats.modes);
  const gameMode = useStore((s) => s.mode);

  // Opens on the mode you were last playing — the one you probably came to check.
  const [tab, setTab] = useState<ModeId>(gameMode);
  useEffect(() => {
    if (open) setTab(gameMode);
  }, [open, gameMode]);

  if (!open) return <section className="lbpage" aria-hidden="true" />;

  const queued = Object.keys(outbox).length;
  const board = boards[tab];
  const mine = myBests[tab] ?? 0;
  const pending = outbox[tab];
  const entries = board?.entries ?? [];

  return (
    <section className="lbpage on">
      <div className="kb-head">
        <p className="eb">Leaderboard</p>
        <h2>Best in each mode</h2>
      </div>
      <button className="btn kb-done" type="button" onClick={() => setOpen(false)}>
        Done · Esc
      </button>

      <div className="lb-wrap">
        <div className="lb-who">
          {identity ? (
            <>
              <span>
                On the board as <b>{handle ?? identity.name}</b>
                <i className="lb-sub"> · signed in as {identity.name}</i>
              </span>
              <button className="btn" type="button" onClick={() => askHandle()}>
                Change name
              </button>
              <button className="btn" type="button" onClick={() => signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span>
                Playing anonymously.
                {queued > 0
                  ? ` ${queued} personal best${queued === 1 ? '' : 's'} waiting to be sent.`
                  : ' Sign in to put your bests on the board.'}
              </span>
              {leaderboardConfigured() && <SignInButton />}
            </>
          )}
        </div>

        <nav className="lb-tabs" aria-label="Leaderboard mode">
          {MODE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="lb-tab"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {MODES[id].label}
            </button>
          ))}
        </nav>

        <div className="lb-panel">
          <div className="lb-head">
            <p className="lb-unit">{scoreUnit(MODES[tab].scoreBy)}</p>
            <p className="lb-status">
              {failed
                ? 'Could not reach the leaderboard — showing the last boards loaded.'
                : loading
                  ? 'Refreshing…'
                  : mine > 0
                    ? `Your best ${mine}${pending ? ' · not sent yet' : ''}`
                    : 'No record here yet.'}
            </p>
          </div>

          {entries.length === 0 ? (
            <p className="lb-empty">{loading ? 'Loading…' : 'Nobody has set one yet. It could be you.'}</p>
          ) : (
            <ol className="lb-rows">
              {entries.map((e) => {
                const isMine = !!handle && e.displayName === handle;
                const podium = e.rank <= 3 ? ` p${e.rank}` : '';
                return (
                  <li key={`${e.rank}-${e.displayName}`} className={`lb-row${podium}${isMine ? ' mine' : ''}`}>
                    <b className="lb-rank">{e.rank}</b>
                    <span className="lb-name">{e.displayName}</span>
                    <time className="lb-when">{ago(e.at)}</time>
                    <em className="lb-score">{e.score}</em>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="lb-foot">
          Scores are calculated in your own browser, so treat this as a friendly scoreboard rather than a verified
          record. Only your display name and score are shown — never your email.
        </p>
      </div>
    </section>
  );
}
