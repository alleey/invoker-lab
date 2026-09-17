/**
 * Talking to the leaderboard, and remembering what still needs saying.
 *
 * Two rules shape everything here:
 *
 *  - The leaderboard may never affect play. Every call is optional, every
 *    failure is silent to the drill, and the game works with the whole service
 *    switched off or misconfigured.
 *  - A result is never lost to a closed tab. Scores go into an outbox before
 *    they go on the wire, and anything unconfirmed is retried at next launch —
 *    including scores set while signed out, which flush whenever you do sign in.
 *
 * The pure half (outbox arithmetic, qualification) is exported for tests and
 * knows nothing about fetch, storage or auth.
 */
import type { ModeId } from './modes';

export interface Entry {
  rank: number;
  displayName: string;
  score: number;
  /** When it was set, in epoch ms. Absent on boards cached before this existed. */
  at?: number;
}

export interface Board {
  label: string;
  direction: 'asc' | 'desc';
  /** The score a newcomer must beat, or null while the board has room. */
  cutoff: number | null;
  entries: Entry[];
}

export type Boards = Partial<Record<ModeId, Board>>;

/** What the server made of a submission. */
export type SubmitStatus = 'ranked' | 'not_ranked' | 'no_improvement';

export interface SubmitResult {
  status: SubmitStatus;
  category: ModeId;
  rank: number;
  best: number;
  cutoff: number | null;
  entries: Entry[];
}

/** One unconfirmed personal best, waiting for a chance to reach the server. */
export interface Pending {
  score: number;
  /** When it was set, so a stale queue can be reasoned about. */
  at: number;
}

/** At most one per category: only your best is ever worth sending. */
export type Outbox = Partial<Record<ModeId, Pending>>;

/* ════════════════════════ pure ════════════════════════ */

export const isBetter = (a: number, b: number, direction: 'asc' | 'desc'): boolean =>
  direction === 'asc' ? a < b : a > b;

/**
 * Would this score make the board?
 *
 * Answered locally so a score that cannot possibly rank never costs a request.
 * The cached cutoff is allowed to be stale because it can only ever be *too
 * low*: entries improve or are replaced by better ones, so the real cutoff only
 * rises. A stale cutoff therefore lets through a submission the server will
 * reject — harmless — and can never block one that would have qualified.
 *
 * With no board cached at all the answer is yes. Never let a failed fetch
 * quietly disable submitting.
 */
export function couldRank(score: number, board: Board | undefined): boolean {
  if (!board) return true;
  if (board.cutoff === null) return true;
  return isBetter(score, board.cutoff, board.direction);
}

/**
 * Fold a personal best into the outbox.
 *
 * Only the better score survives per category, so a session that sets five
 * bests queues one submission rather than five. Direction matters: in a
 * lower-is-better category the smaller number is the one worth keeping.
 */
export function queueBest(
  outbox: Outbox,
  category: ModeId,
  score: number,
  at: number,
  direction: 'asc' | 'desc' = 'desc',
): Outbox {
  const held = outbox[category];
  if (held && !isBetter(score, held.score, direction)) return outbox;
  return { ...outbox, [category]: { score, at } };
}

/**
 * Drop an entry once the server has it — but only if it still holds the score
 * that was sent. A better result set while the request was in flight must not
 * be thrown away by its response landing afterwards.
 */
export function confirm(outbox: Outbox, category: ModeId, score: number): Outbox {
  const held = outbox[category];
  if (!held || held.score !== score) return outbox;
  const next = { ...outbox };
  delete next[category];
  return next;
}

/* ════════════════════════ wire ════════════════════════ */

const URL_BASE: string = (import.meta.env.VITE_LEADERBOARD_URL ?? '').replace(/\/+$/, '');
export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** With either half missing the feature simply is not there. */
export const leaderboardConfigured = (): boolean => !!URL_BASE && !!CLIENT_ID;

/**
 * Apps Script is slow and erratic — measured between 1.7s and 13.4s for the
 * same cached read, with the occasional bogus 404 from its redirect hop. So:
 * a generous timeout, and one retry before believing a failure.
 */
const TIMEOUT_MS = 20000;

async function call(init: RequestInit & { query?: string }, attempt = 0): Promise<unknown> {
  const { query, ...rest } = init;
  const url = query ? `${URL_BASE}?${query}` : URL_BASE;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...rest, signal: abort.signal, redirect: 'follow' });
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 800));
      return call(init, 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

interface BoardsResponse {
  ok?: boolean;
  categories?: Record<string, Board>;
}

export async function fetchBoards(): Promise<Boards> {
  if (!leaderboardConfigured()) return {};
  const body = (await call({ method: 'GET', query: 'action=boards' })) as BoardsResponse;
  if (!body || body.ok !== true || !body.categories) throw new Error('bad_response');
  return body.categories as Boards;
}

interface SubmitResponse extends Partial<SubmitResult> {
  ok?: boolean;
  error?: string;
}

/**
 * Send one result.
 *
 * `keepalive` hands the request to the browser so it completes even if the tab
 * closes on the way out. It is an optimisation, not the guarantee — the outbox
 * is what actually makes a result durable, and it covers the cases keepalive
 * does not: offline, a dead endpoint, or a browser that drops the request
 * across Apps Script's cross-origin redirect.
 *
 * text/plain is deliberate: an application/json body would trigger a CORS
 * preflight, and Apps Script Web Apps do not answer OPTIONS.
 */
export async function submitScore(args: {
  idToken: string;
  category: ModeId;
  score: number;
  displayName: string;
}): Promise<SubmitResult> {
  if (!leaderboardConfigured()) throw new Error('not_configured');
  const body = (await call({
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(args),
  })) as SubmitResponse;

  if (!body || body.ok !== true) throw new Error(body?.error || 'bad_response');
  return {
    status: (body.status ?? 'not_ranked') as SubmitStatus,
    category: args.category,
    rank: body.rank ?? 0,
    best: body.best ?? args.score,
    cutoff: body.cutoff ?? null,
    entries: body.entries ?? [],
  };
}
