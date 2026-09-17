import { useEffect, useRef, useState } from 'react';
import { renderSignInButton } from '../engine/auth';
import { leaderboardConfigured } from '../engine/leaderboard';
import { useLeaderboard } from '../leaderboardStore';

/**
 * The first screen. Its whole job is to make clear that signing in is optional.
 *
 * Anonymous is a first-class way to play, not a downgrade — every drill, every
 * stat and every record works signed out. Signing in adds exactly one thing,
 * and the copy says so rather than implying an account is the way in.
 */
export function Landing(): JSX.Element | null {
  const entered = useLeaderboard((s) => s.entered);
  const identity = useLeaderboard((s) => s.identity);
  const enter = useLeaderboard((s) => s.enter);
  const setIdentity = useLeaderboard((s) => s.setIdentity);
  const btnRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const configured = leaderboardConfigured();

  useEffect(() => {
    if (entered || !configured || !btnRef.current) return;
    let cancelled = false;
    renderSignInButton(btnRef.current, (id) => {
      setIdentity(id);
      enter();
    }).catch(() => {
      // Offline, blocked, or no client id — the page still works, minus one button.
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [entered, configured, setIdentity, enter]);

  if (entered) return null;

  return (
    <section className="landing">
      <div className="landing-in">
        <p className="eb">Invoker Lab</p>
        <h1>Arsenal Magus is hard to learn, harder still to master.</h1>
        <p className="landing-lead">
          Four drills and a sandbox for Invoker&rsquo;s ten spells — the orb queue, the two slots, and the shortest
          route between them.
        </p>

        <div className="landing-ways">
          <div className="way">
            <p className="lb">Play</p>
            <p>
              Every mode, every statistic and every personal record works without an account. Nothing is held back.
            </p>
            <button className="begin" type="button" onClick={() => enter()}>
              Play anonymously
            </button>
          </div>

          <div className="way">
            <p className="lb">Play &amp; compete</p>
            <p>
              Signing in with Google adds one thing: your best in each mode can go on the leaderboard. Your email is
              never shown and the game never asks for access to anything in your account.
            </p>
            {configured && !failed ? (
              <div className="gbtn" ref={btnRef} />
            ) : (
              <p className="landing-off">
                {configured ? 'Sign-in is unavailable right now.' : 'Leaderboards are not configured on this build.'}
              </p>
            )}
            <p className="n">
              You can sign in later from the leaderboard panel — scores you set before then are kept and sent when you
              do.
            </p>
          </div>
        </div>

        {identity && <p className="landing-who">Signed in as {identity.name}</p>}
      </div>
    </section>
  );
}
