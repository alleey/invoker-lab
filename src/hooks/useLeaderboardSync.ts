import { useEffect, useRef } from 'react';
import { useLeaderboard } from '../leaderboardStore';
import { useStore } from '../store';

/**
 * The single seam between the drill and the leaderboard.
 *
 * `finish()` already decides what a run scored and whether it beat your record;
 * this watches for that and forwards it. The game store gains nothing, knows
 * nothing, and behaves identically with this hook deleted.
 *
 * Submitting only on a personal best is not just tidiness — it means the client
 * and the server agree on what is worth storing, and it keeps writes down to a
 * handful per player rather than one per run.
 */
export function useLeaderboardSync(): void {
  const result = useStore((s) => s.result);
  const mode = useStore((s) => s.mode);
  const record = useLeaderboard((s) => s.record);
  const clearSync = useLeaderboard((s) => s.clearSync);
  const restoreSession = useLeaderboard((s) => s.restoreSession);
  const entered = useLeaderboard((s) => s.entered);

  // Once past the landing screen: refresh a stale token if Google will give one
  // quietly, send anything still queued, and pull the boards.
  useEffect(() => {
    if (entered) restoreSession();
  }, [entered, restoreSession]);

  /* A result object stays on screen while the player reads it, so it must only
     ever be forwarded once. Keyed by the run, not by the score. */
  const sent = useRef<unknown>(null);
  useEffect(() => {
    if (!result || sent.current === result) return;
    sent.current = result;
    // A run that set no record must not inherit the last one's status line —
    // "saved to the leaderboard" about a run that was never sent is a lie.
    /* Offered on every completed run, not only on a local personal best.
       Whether it is worth sending is the leaderboard's decision, made against
       what the server holds — the local record is a different number that can
       drift from it. Abandoned runs are still never offered. */
    if (result.completed && result.score > 0) record(mode, result.score);
    else clearSync();
  }, [result, mode, record, clearSync]);
}
