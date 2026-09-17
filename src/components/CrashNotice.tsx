import { useState } from 'react';
import { clearCrash, readLastCrash } from '../engine/blackbox';
import { useLeaderboard } from '../leaderboardStore';
import { useStore } from '../store';

/**
 * Shown once after a load that follows an unclean exit. It reports the last
 * second the app saw before it died — which is the only evidence a crash
 * leaves behind.
 */
export function CrashNotice(): JSX.Element | null {
  const [crumb, setCrumb] = useState(() => readLastCrash());
  /**
   * Hidden behind a full-screen page rather than unmounted.
   *
   * This component remembers being dismissed in local state, so unmounting it
   * resurrects the notice: closing the leaderboard would re-read the
   * breadcrumb and show it all over again, every single time.
   */
  const behindPage = useStore((s) => s.kbOpen || s.statsOpen || s.masteryOpen || s.practicing);
  const behindBoard = useLeaderboard((s) => s.open);
  if (!crumb || behindPage || behindBoard) return null;

  const dismiss = () => {
    clearCrash();
    setCrumb(null);
  };

  const heap =
    crumb.heapMB === null
      ? 'not reported'
      : `${crumb.heapMB} MB${crumb.heapLimitMB ? ` of ${crumb.heapLimitMB} MB` : ''}`;

  return (
    <section className="crash" role="status">
      <div className="crash-head">
        <span className="crash-tag">Previous session ended unexpectedly</span>
        <button type="button" onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <dl className="crash-grid">
        <div>
          <dt>Last seen</dt>
          <dd>{new Date(crumb.at).toLocaleTimeString()}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>
            {crumb.mode}
            {crumb.running ? ' · mid-drill' : ' · idle'}
          </dd>
        </div>
        <div>
          <dt>Casts in run</dt>
          <dd>{crumb.casts}</dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd>{crumb.uptimeS}s</dd>
        </div>
        <div>
          <dt>Frames/sec</dt>
          <dd className={crumb.fps < 30 ? 'bad' : ''}>{crumb.fps}</dd>
        </div>
        <div>
          <dt>Worst frame</dt>
          <dd className={crumb.worstFrameMs > 250 ? 'bad' : ''}>{crumb.worstFrameMs} ms</dd>
        </div>
        <div>
          <dt>JS heap</dt>
          <dd
            className={
              crumb.heapMB !== null && crumb.heapLimitMB !== null && crumb.heapMB > crumb.heapLimitMB * 0.8
                ? 'bad'
                : ''
            }
          >
            {heap}
          </dd>
        </div>
      </dl>
      <p className="crash-hint">
        Send these numbers over. A collapsing frame rate points at the compositor, a heap near its
        limit points at memory, and healthy numbers right up to the end point at neither.
      </p>
    </section>
  );
}
