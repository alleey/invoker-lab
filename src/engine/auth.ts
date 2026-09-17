/**
 * Google Sign-In, kept to the minimum the leaderboard needs.
 *
 * We ask for nothing beyond the implicit `openid email profile` that a sign-in
 * carries, and we never ask for Drive or Sheets — a player has no business
 * being prompted for access to the game's spreadsheet. What comes back is an ID
 * token; the backend validates it and takes the identity from Google's answer,
 * never from anything this file sends.
 *
 * Signing in is optional everywhere. Nothing here is required to play.
 */
import { CLIENT_ID } from './leaderboard';

export interface Identity {
  /** Google's stable subject id. The only thing that identifies a player. */
  sub: string;
  /** Presentation only, and replaceable by a handle. */
  name: string;
  /** Unix seconds. Past this the token is refused and needs refreshing. */
  exp: number;
  token: string;
}

/**
 * The token lives in localStorage so a reload does not force a fresh prompt.
 *
 * It is a bearer credential, so this is a real if small exposure to XSS — worth
 * accepting here because the token expires within the hour and the only thing
 * it authorises is posting your own score to a game leaderboard. It grants no
 * access to your Google account and none to the Sheet.
 */
const KEY = 'arsenal-magus.identity.v1';

/** Read the claims out of a JWT for display. Verification is the server's job. */
function decode(token: string): { sub?: string; name?: string; given_name?: string; exp?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export const isExpired = (id: Identity | null): boolean =>
  !id || id.exp * 1000 <= Date.now();

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const id = JSON.parse(raw) as Identity;
    return id && id.sub && id.token ? id : null;
  } catch {
    return null;
  }
}

function saveIdentity(id: Identity | null): void {
  try {
    if (id) localStorage.setItem(KEY, JSON.stringify(id));
    else localStorage.removeItem(KEY);
  } catch {
    /* private window — sign-in simply will not persist */
  }
}

export function identityFromCredential(token: string): Identity | null {
  const claims = decode(token);
  if (!claims?.sub || !claims.exp) return null;
  const id: Identity = {
    sub: claims.sub,
    name: claims.name || claims.given_name || 'Player',
    exp: claims.exp,
    token,
  };
  saveIdentity(id);
  return id;
}

export function forgetIdentity(): void {
  saveIdentity(null);
  try {
    window.google?.accounts.id.disableAutoSelect();
  } catch {
    /* the script may never have loaded */
  }
}

/* ──────────────────────────── the Google script ──────────────────────────── */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: Record<string, unknown>): void;
          renderButton(el: HTMLElement, options: Record<string, unknown>): void;
          prompt(listener?: (n: unknown) => void): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<void> | null = null;

/** Loaded once, lazily — a player who never signs in never fetches it. */
export function loadGoogle(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('gsi_failed')));
      return;
    }
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('gsi_failed'));
    document.head.appendChild(el);
  });
  return loading;
}

let initialised = false;
let onCredential: ((id: Identity) => void) | null = null;

/**
 * `auto_select` is what makes a week-later sync invisible: a returning player
 * who is still signed in to Google gets a fresh token without being asked
 * again. When it does not fire — signed out of Google, third-party cookies
 * blocked, consent revoked — nothing breaks; the queued scores simply wait for
 * the next launch.
 */
async function ensureInit(handler: (id: Identity) => void): Promise<void> {
  onCredential = handler;
  if (initialised) return;
  await loadGoogle();
  const gid = window.google?.accounts.id;
  if (!gid) throw new Error('gsi_failed');
  gid.initialize({
    client_id: CLIENT_ID,
    auto_select: true,
    callback: (res: { credential?: string }) => {
      const id = res.credential ? identityFromCredential(res.credential) : null;
      if (id && onCredential) onCredential(id);
    },
  });
  initialised = true;
}

/** Draw Google's own button — its branding rules require theirs, not ours. */
export async function renderSignInButton(
  el: HTMLElement,
  handler: (id: Identity) => void,
): Promise<void> {
  await ensureInit(handler);
  el.innerHTML = '';
  window.google?.accounts.id.renderButton(el, {
    theme: 'filled_black',
    size: 'large',
    shape: 'rectangular',
    text: 'signin_with',
    logo_alignment: 'left',
  });
}

/** Ask for a token without showing anything. Silence is a normal outcome. */
export async function refreshSilently(handler: (id: Identity) => void): Promise<void> {
  await ensureInit(handler);
  window.google?.accounts.id.prompt();
}
