/**
 * Everything competitive, kept out of the game's own store.
 *
 * The drill does not know this exists. `finish()` computes a score and records
 * a personal best exactly as it always has; a single hook watches for that and
 * feeds it here. Delete this file and the game still runs.
 */
import { create } from 'zustand';
import {
  confirm,
  couldRank,
  isBetter,
  fetchBoards,
  leaderboardConfigured,
  queueBest,
  submitScore,
  type Boards,
  type Outbox,
  type SubmitResult,
} from './engine/leaderboard';
import { forgetIdentity, isExpired, loadIdentity, refreshSilently, type Identity } from './engine/auth';
import { MODES, type ModeId } from './engine/modes';

const OUTBOX_KEY = 'arsenal-magus.outbox.v1';
const BOARDS_KEY = 'arsenal-magus.boards.v1';
const ENTRY_KEY = 'arsenal-magus.entered.v1';
const SENT_KEY = 'arsenal-magus.sent.v1';
const HANDLE_KEY = 'arsenal-magus.handle.v1';

/** The server caps this too; matching it here keeps the field honest. */
export const HANDLE_MAX = 24;

/** A first suggestion, never a default that ships without being seen. */
export const suggestHandle = (name: string): string =>
  (name || '').trim().split(/\s+/)[0]?.slice(0, HANDLE_MAX) || 'Player';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window; the outbox degrades to this session only */
  }
}

/** What the results view says about a submission while it is happening. */
export type SyncState =
  | { kind: 'idle' }
  | { kind: 'queued' }
  | { kind: 'sending' }
  | { kind: 'done'; result: SubmitResult }
  | { kind: 'failed' };

interface State {
  /** Null until the player has chosen sign-in or anonymous. */
  entered: boolean;
  identity: Identity | null;
  /**
   * The name shown on the board. Deliberately not the Google profile name:
   * putting someone's real name on a public scoreboard is a disclosure they
   * never asked for, and the ID token's name is only ever a suggestion.
   */
  handle: string | null;
  /** Set when a submission is waiting on the player to choose one. */
  needsHandle: boolean;
  /**
   * The best score the server is known to hold for you, per category.
   *
   * Submission is gated on this rather than on the local record. The two drift
   * — a local best inflated by a bug, a sheet edited by hand, cleared browser
   * storage — and gating on the local one means a single bad local number
   * silently blocks every future submission in that category, forever. The
   * server is the authority on what it already has, so ask it.
   */
  sent: Partial<Record<ModeId, number>>;
  boards: Boards;
  outbox: Outbox;
  sync: SyncState;
  boardsLoading: boolean;
  boardsFailed: boolean;
  open: boolean;

  enter(): void;
  setHandle(handle: string): void;
  /** Re-open the name prompt, for changing it later. */
  askHandle(): void;
  dismissHandle(): void;
  setIdentity(id: Identity): void;
  signOut(): void;
  setOpen(open: boolean): void;
  loadBoards(): Promise<void>;
  /** Called when the game records a personal best. Never throws. */
  record(category: ModeId, score: number): void;
  /** Forget the last submission's outcome, so it cannot describe a later run. */
  clearSync(): void;
  flush(): Promise<void>;
  restoreSession(): void;
}

export const useLeaderboard = create<State>()((set, get) => ({
  entered: read<boolean>(ENTRY_KEY, false),
  identity: loadIdentity(),
  handle: read<string | null>(HANDLE_KEY, null),
  needsHandle: false,
  sent: read<Partial<Record<ModeId, number>>>(SENT_KEY, {}),
  // Painted from the last known board so opening the page is instant. Apps
  // Script takes seconds; an empty box for that long reads as broken.
  boards: read<Boards>(BOARDS_KEY, {}),
  outbox: read<Outbox>(OUTBOX_KEY, {}),
  sync: { kind: 'idle' },
  boardsLoading: false,
  boardsFailed: false,
  open: false,

  enter() {
    write(ENTRY_KEY, true);
    set({ entered: true });
  },

  setIdentity(id) {
    set({ identity: id });
    // Nothing is sent until there is a name to send it under. Signing in is
    // otherwise the moment a week of anonymous bests would all go out at once,
    // under whatever Google happens to call you.
    if (!get().handle) {
      set({ needsHandle: true });
      return;
    }
    void get().flush();
  },

  setHandle(handle) {
    const clean = handle.trim().slice(0, HANDLE_MAX) || 'Player';
    write(HANDLE_KEY, clean);
    set({ handle: clean, needsHandle: false });
    void get().flush();
  },

  askHandle() {
    set({ needsHandle: true });
  },

  /** Chose not to decide. Nothing is sent, and the queue keeps waiting. */
  dismissHandle() {
    set({ needsHandle: false });
  },

  signOut() {
    forgetIdentity();
    // The outbox deliberately survives: those are still your results, and they
    // are still worth sending if you sign in again.
    set({ identity: null, sync: { kind: 'idle' } });
  },

  setOpen(open) {
    set({ open });
    if (open) void get().loadBoards();
  },

  async loadBoards() {
    if (!leaderboardConfigured() || get().boardsLoading) return;
    set({ boardsLoading: true, boardsFailed: false });
    try {
      const boards = await fetchBoards();
      write(BOARDS_KEY, boards);
      set({ boards, boardsLoading: false });
    } catch {
      // Stale boards stay on screen; a failed refresh is not worth a blank page.
      set({ boardsLoading: false, boardsFailed: true });
    }
  },

  clearSync() {
    if (get().sync.kind !== 'idle') set({ sync: { kind: 'idle' } });
  },

  record(category, score) {
    if (!leaderboardConfigured()) return;
    const direction = 'desc';

    // Nothing to say if the server already has this or better from you.
    const already = get().sent[category];
    if (already !== undefined && !isBetter(score, already, direction)) {
      set({ sync: { kind: 'idle' } });
      return;
    }

    const outbox = queueBest(get().outbox, category, score, Date.now(), direction);
    write(OUTBOX_KEY, outbox);

    // A score that cannot reach the board costs nothing to skip, but only when
    // we actually know the cutoff. No board cached means try anyway.
    const board = get().boards[category];
    if (!couldRank(score, board)) {
      set({ outbox, sync: { kind: 'idle' } });
      return;
    }

    set({ outbox, sync: get().identity ? { kind: 'sending' } : { kind: 'queued' } });
    void get().flush();
  },

  /**
   * Send everything unconfirmed.
   *
   * Safe to call at any time and from anywhere — signed out it does nothing,
   * and a result is only cleared once the server has confirmed that exact
   * score, so a better one set mid-flight is never lost.
   */
  async flush() {
    if (!leaderboardConfigured()) return;
    const identity = get().identity;
    const handle = get().handle;
    if (identity && !handle) {
      set({ needsHandle: true, sync: { kind: 'queued' } });
      return;
    }
    if (!identity || isExpired(identity)) {
      if (Object.keys(get().outbox).length > 0) set({ sync: { kind: 'queued' } });
      return;
    }

    const pending = Object.entries(get().outbox) as [ModeId, { score: number }][];
    if (pending.length === 0) return;

    // Apps Script can take ten seconds or more. Say so, or the panel looks
    // frozen for the whole of it.
    set({ sync: { kind: 'sending' } });

    let last: SubmitResult | null = null;
    let failed = false;

    for (const [category, item] of pending) {
      if (!MODES[category]) continue;
      try {
        const result = await submitScore({
          idToken: identity.token,
          category,
          score: item.score,
          displayName: handle ?? identity.name,
        });
        const outbox = confirm(get().outbox, category, item.score);
        write(OUTBOX_KEY, outbox);
        // `best` is what the server says it now holds for you — the only
        // number worth gating the next submission on.
        const sent = { ...get().sent, [category]: result.best };
        write(SENT_KEY, sent);
        set({ sent });
        const boards = { ...get().boards };
        const existing = boards[category];
        if (existing) {
          boards[category] = { ...existing, cutoff: result.cutoff, entries: result.entries };
          write(BOARDS_KEY, boards);
        }
        set({ outbox, boards });
        last = result;
      } catch {
        failed = true;
      }
    }

    if (last) set({ sync: { kind: 'done', result: last } });
    else if (failed) set({ sync: { kind: 'failed' } });
  },

  /**
   * On launch: refresh a stale token if Google will give one quietly, then send
   * anything still queued. Both halves are allowed to fail in silence.
   */
  restoreSession() {
    if (!leaderboardConfigured()) return;
    const id = get().identity;
    if (id && isExpired(id)) {
      void refreshSilently((fresh) => set({ identity: fresh })).catch(() => undefined);
    }
    void get().flush();
    void get().loadBoards();
  },
}));

/* Reachable from the console in dev only, so the sign-in and handle paths can
   be exercised without a live Google round trip. Stripped from production. */
if (import.meta.env.DEV) {
  (window as unknown as { __lb?: unknown }).__lb = useLeaderboard;
}
