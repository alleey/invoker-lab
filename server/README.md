# Leaderboard backend

A Google Apps Script Web App in front of a private Google Sheet. No server, no
database, no cost. The game stays a static site.

```
React game  ──HTTPS──>  Apps Script Web App  ──>  private Google Sheet
   (public)               (runs as you)              (never shared)
```

Nothing here is wired into the game yet. Get this working on its own first.

| file | what it is |
| --- | --- |
| `leaderboard.gs` | the whole backend — paste into Apps Script |
| `test-logic.mjs` | proves the ranking rules under Node, no Google needed |
| `smoke.mjs` | proves a *deployed* endpoint works |

---

## 1. Verify the rules before deploying anything

```bash
node server/test-logic.mjs
```

This loads the real `leaderboard.gs` and exercises its pure half: sorting,
qualification, personal-best semantics, both ranking directions, top-X
truncation, score validation and what the client is allowed to see. 90 checks,
no network, no account. If this fails, don't deploy.

---

## 2. Create the Sheet

1. New Google Sheet, name it whatever you like (`Invoker Lab Leaderboard`).
2. Rename the first tab to exactly **`Leaderboard`**.
3. Put these headers in row 1:

   | A | B | C | D | E |
   | --- | --- | --- | --- | --- |
   | Category | UserId | DisplayName | Score | Timestamp |

4. Copy the Sheet ID from the URL — the long string between `/d/` and `/edit`.

**Leave the Sheet private.** Do not share it. The script reaches it with your
permissions; players never do.

---

## 3. Create the OAuth client

Google Cloud Console → **APIs & Services → Credentials → Create credentials →
OAuth client ID**.

- Application type: **Web application**
- **Authorized JavaScript origins** — add both:
  - `http://localhost:5173` (Vite dev)
  - `https://<your-user>.github.io` (origin only, no path, if you deploy to Pages)
- **Authorized redirect URIs**: leave empty. Google Identity Services returns the
  credential to a JavaScript callback; there is no redirect.
- Scopes: none beyond the implicit `openid email profile`. **Never** request
  Drive or Sheets scope — players have no business touching the Sheet.

Copy the **Client ID** (ends `.apps.googleusercontent.com`).

You'll also need the OAuth consent screen configured once (External, app name,
your email). While it's in "Testing" only accounts you list can sign in — move it
to "In production" when you want it open. No verification review is needed for
`openid email profile`.

---

## 4. Deploy the script

1. From the Sheet: **Extensions → Apps Script**.
2. Delete the stub `Code.gs` content and paste all of `leaderboard.gs`.
3. Fill in the two constants at the top:

   ```js
   var SHEET_ID = '...';            // from step 2
   var OAUTH_CLIENT_ID = '...';     // from step 3
   ```

4. **Deploy → New deployment → Web app**:
   - **Execute as:** *Me* — this is what lets the script write to a Sheet the
     player cannot see.
   - **Who has access:** *Anyone* — this means anyone may call the URL, not that
     anyone may write. Every write still requires a valid Google ID token.
5. Authorise when prompted (it wants Sheets + external fetch, as you, once).
6. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).

> Re-deploying: use **Manage deployments → edit → Version: New version**, not a
> new deployment, or the URL changes and the game points at the old code.

---

## 5. Verify the deployment

```bash
node server/smoke.mjs "https://script.google.com/macros/s/.../exec"
```

Checks reachability, JSON shape, every category, and that submissions without a
valid token are refused. If it reports HTML instead of JSON, access isn't set to
"Anyone".

To test the signed-in path, sign in on a page using your client ID, grab the
credential from the browser console, and:

```bash
node server/smoke.mjs "https://script.google.com/macros/s/.../exec" "eyJhbGciOi..."
```

That runs a real submit and proves personal-best behaviour end to end. Point it
at a throwaway sheet first — it writes `SmokeTest` rows you'll want to delete.

---

## API

**`GET ?action=boards`** — every category at once. This is the one call the game
makes at start-up.

```json
{ "ok": true, "size": 25,
  "categories": {
    "rapid": { "label": "Streak", "direction": "desc", "cutoff": 31,
               "entries": [ { "rank": 1, "displayName": "Alice", "score": 52 } ] }
  } }
```

**`GET ?action=leaderboard&category=rapid`** — one category.

**`POST`** — body is JSON sent as `Content-Type: text/plain` (see below):

```json
{ "idToken": "eyJ...", "category": "rapid", "score": 52, "displayName": "Alice" }
```

```json
{ "ok": true, "status": "ranked", "rank": 3, "best": 52, "cutoff": 31,
  "entries": [ … ] }
```

`status` is one of:

| status | meaning | what to tell the player |
| --- | --- | --- |
| `ranked` | on the board | "#3 — new personal best" |
| `no_improvement` | didn't beat your own entry | say nothing, or show their best |
| `not_ranked` | didn't make the top 25 | "Not in the top 25" |

The response always carries the refreshed board, so a submit doubles as a
refresh and the client never needs a second round trip.

Errors are `{ "ok": false, "error": "..." }` with `unknown_category`,
`invalid_score`, `unauthenticated`, `bad_request`, `busy`, `server_error`. None
of them leak an internal message.

---

## Design notes

**Why `text/plain` on POST.** A browser sending `Content-Type: application/json`
triggers a CORS preflight `OPTIONS`, and Apps Script Web Apps do not answer
`OPTIONS`. Sending the same JSON as `text/plain` makes it a "simple request" with
no preflight. This weakens nothing — the credential is the ID token in the body,
not the content type. It is the single most common way this integration fails, so
the smoke test sends exactly what the browser will.

**Identity.** The client sends a Google ID token. The script verifies it against
`oauth2.googleapis.com/tokeninfo`, checks `aud` matches its own client ID, and
takes `sub` from *Google's* response — never from the request body, which the
player controls. `displayName` is presentation only. Verified tokens are cached
for their remaining lifetime so a burst of submits doesn't burn fetch quota.

**One entry per player per category.** Submitting worse than your own entry
returns `no_improvement` and writes nothing. Ties don't displace an existing
holder — first to reach a score keeps the higher rank.

**Locking.** Read → modify → sort → truncate → write happens inside a
`LockService` script lock, so two submissions arriving together can't each write
a board that never saw the other. Reads take no lock; a reader catching a write
mid-flight sees stale rows, not corrupt ones.

**Writes never blank the sheet.** The new rows are written over the top and only
surplus rows below are cleared, so there's no window where a dying script leaves
an empty leaderboard.

---

## Limits, stated plainly

**Scores are not verifiable.** The KPI is computed in the player's own browser.
Anyone who opens devtools can call the submit path with any number they like.
The bounds in `CATEGORIES` reject the absurd — they do not make this cheat-proof,
and no client-side game can be. Treat the board as a friendly scoreboard, not a
record of fact.

If you later want the cheap 80% mitigation: submit a small run receipt (cast
count, duration, average cast time) and have the script reject internally
inconsistent claims — a streak of 400 in a 60-second run is not physically
possible. That stops casual tampering and nothing more.

**Quotas.** Consumer Google accounts get ~20k `UrlFetchApp` calls and 90 minutes
of script runtime a day. One submit costs at most one fetch (token validation,
cached afterwards). Reads are served from a 45-second cache. For a small game
this is nowhere near the ceiling.

**Google's rules apply.** Sheets caps at 10M cells; at ~125 rows this is
irrelevant. Apps Script Web Apps can be slow to cold-start — the first call after
idle may take a second or two, which is why the game must never block on it.
