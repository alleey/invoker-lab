/**
 * Invoker Lab — leaderboard backend (Google Apps Script Web App).
 *
 * Deployed as a Web App running as the SHEET OWNER, accessible to "Anyone".
 * The player never touches the Sheet: they send a Google ID token, this script
 * validates it and writes on their behalf with the owner's permissions.
 *
 * Everything above the "Google-facing" divider is pure — no SpreadsheetApp, no
 * UrlFetchApp, no globals — so `server/test-logic.mjs` can run it under Node
 * and prove the ranking rules before any of this is deployed.
 */

/* ════════════════════════ configuration ════════════════════════ */

/** Fill both in before deploying. See server/README.md. */
var SHEET_ID = 'PUT_YOUR_SHEET_ID_HERE';
var OAUTH_CLIENT_ID = 'PUT_YOUR_OAUTH_CLIENT_ID_HERE';

var SHEET_NAME = 'Leaderboard';
var HEADERS = ['Category', 'UserId', 'DisplayName', 'Score', 'Timestamp'];

/** How many entries each category keeps. */
var LEADERBOARD_SIZE = 25;

/** Longest a display name may be, and what it may contain. */
var NAME_MAX = 24;

/**
 * One entry per mode the game scores.
 *
 * `direction` drives sorting, qualification and rank in one place — there is no
 * per-category ranking code anywhere else.
 *
 * `max` is a sanity bound, not anti-cheat. The four clocked modes cap at a
 * 180-second session; even at an inhuman four casts a second that is ~720, so
 * 1000 rejects the absurd without ever rejecting a real run. Dare Devil has no
 * session clock, so its ceiling is looser.
 */
var CATEGORIES = {
  rapid: { label: 'Streak', direction: 'desc', max: 1000 },
  combo: { label: 'Combos', direction: 'desc', max: 1000 },
  crucible: { label: 'Rapid Fire', direction: 'desc', max: 1000 },
  efficient: { label: 'PRO', direction: 'desc', max: 1000 },
  daredevil: { label: 'Dare Devil', direction: 'desc', max: 5000 },
};

/* ════════════════════════ pure ranking logic ════════════════════════ */

function isKnownCategory(category) {
  return typeof category === 'string' && Object.prototype.hasOwnProperty.call(CATEGORIES, category);
}

/**
 * A score is valid when it is a finite whole number within the category's
 * bounds. Rejecting NaN/Infinity/strings matters more than the ceiling does:
 * one of those reaching the Sheet corrupts every later sort.
 */
function isValidScore(category, score) {
  var cfg = CATEGORIES[category];
  if (!cfg) return false;
  if (typeof score !== 'number' || !isFinite(score)) return false;
  if (Math.floor(score) !== score) return false;
  return score >= 0 && score <= cfg.max;
}

/** True when `a` beats `b` outright for this direction. Ties do not count. */
function isBetter(a, b, direction) {
  return direction === 'asc' ? a < b : a > b;
}

/**
 * Best first. Ties break on who got there first, so an existing holder is
 * never displaced by someone merely equalling them.
 */
function sortEntries(entries, direction) {
  return entries.slice().sort(function (x, y) {
    if (x.score !== y.score) return direction === 'asc' ? x.score - y.score : y.score - x.score;
    return x.ts - y.ts;
  });
}

/** 1-based position, or 0 when absent. */
function rankOf(sorted, userId) {
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].userId === userId) return i + 1;
  }
  return 0;
}

/**
 * The score a newcomer must beat. `null` while the board has room, which the
 * client reads as "anything qualifies".
 */
function cutoffOf(sorted, size) {
  return sorted.length < size ? null : sorted[size - 1].score;
}

/**
 * Fold one result into a category's board.
 *
 * Personal-best semantics: a player holds at most one entry per category, and
 * a submission that does not beat their own entry leaves the board untouched.
 * That is reported as `no_improvement` rather than `not_ranked` — failing to
 * beat your own 52 is a different thing from missing the cut, and telling a
 * player the wrong one of those is worse than saying nothing.
 */
function applyScore(entries, entry, direction, size) {
  var existing = -1;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].userId === entry.userId) {
      existing = i;
      break;
    }
  }

  if (existing >= 0 && !isBetter(entry.score, entries[existing].score, direction)) {
    var held = sortEntries(entries, direction).slice(0, size);
    return {
      status: 'no_improvement',
      rank: rankOf(held, entry.userId),
      best: entries[existing].score,
      entries: held,
      changed: false,
    };
  }

  var next = entries.slice();
  if (existing >= 0) next[existing] = entry;
  else next.push(entry);

  var sorted = sortEntries(next, direction).slice(0, size);
  var rank = rankOf(sorted, entry.userId);

  return {
    status: rank > 0 ? 'ranked' : 'not_ranked',
    rank: rank,
    best: entry.score,
    entries: sorted,
    // Nothing was kept, so nothing needs writing back.
    changed: rank > 0,
  };
}

/** Trim a Google profile name to something safe to show publicly. */
function cleanName(name) {
  if (typeof name !== 'string') return 'Anonymous';
  var out = name.replace(new RegExp('[\u0000-\u001f\u007f]', 'g'), '').trim().slice(0, NAME_MAX);
  return out.length ? out : 'Anonymous';
}

/**
 * Rows as the client sees them — no user ids, no identities.
 *
 * The timestamp is included on purpose: a record that has stood for a month
 * reads differently from one set an hour ago, and it is the only context a
 * bare number has. It says when someone played, nothing about who they are.
 */
function publicEntries(sorted) {
  return sorted.map(function (e, i) {
    return { rank: i + 1, displayName: e.displayName, score: e.score, at: e.ts };
  });
}

/* ════════════════════════ Google-facing ════════════════════════ */

/**
 * Failures here are nearly always setup mistakes, so they get their own codes
 * instead of collapsing into a generic error. Neither code reveals anything
 * about the sheet; they only say which step went wrong.
 */
function sheet_() {
  if (!SHEET_ID || SHEET_ID.indexOf('PUT_YOUR') === 0) throw new Error('sheet_id_not_set');
  var ss;
  try {
    ss = SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    throw new Error('cannot_open_sheet');
  }
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('missing_tab');
  return sh;
}

/** Setup codes pass through; anything unexpected stays opaque. */
function errorCode_(err) {
  var known = { sheet_id_not_set: 1, cannot_open_sheet: 1, missing_tab: 1 };
  var code = err && err.message;
  return known[code] ? code : 'server_error';
}

/**
 * Setup diagnostics. Reports which step of the configuration is wrong without
 * echoing the sheet id, the client id or any row content. Safe to leave
 * deployed; it says nothing a caller could not learn by trying the real
 * endpoints, only faster.
 */
function diag_() {
  var out = {
    ok: true,
    sheetIdSet: !!SHEET_ID && SHEET_ID.indexOf('PUT_YOUR') !== 0,
    clientIdSet: !!OAUTH_CLIENT_ID && OAUTH_CLIENT_ID.indexOf('PUT_YOUR') !== 0,
    clientIdLooksRight: /\.apps\.googleusercontent\.com$/.test(String(OAUTH_CLIENT_ID)),
    expectedTab: SHEET_NAME,
    sheetOpens: false,
    tabFound: false,
    tabsPresent: [],
    headerRow: [],
    dataRows: 0,
    categories: Object.keys(CATEGORIES),
    size: LEADERBOARD_SIZE,
  };

  var ss;
  try {
    ss = SpreadsheetApp.openById(SHEET_ID);
    out.sheetOpens = true;
  } catch (e) {
    out.problem = out.sheetIdSet ? 'cannot_open_sheet' : 'sheet_id_not_set';
    return out;
  }

  var tabs = ss.getSheets();
  for (var i = 0; i < tabs.length; i++) out.tabsPresent.push(tabs[i].getName());

  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    out.problem = 'missing_tab';
    return out;
  }
  out.tabFound = true;

  var values = sh.getDataRange().getValues();
  out.headerRow = (values[0] || []).map(String);
  out.dataRows = Math.max(0, values.length - 1);
  if (out.headerRow.join('|') !== HEADERS.join('|')) out.problem = 'unexpected_headers';
  return out;
}

/**
 * The whole board, grouped by category.
 *
 * One read for every category rather than one per category: at five categories
 * of twenty-five this is ~125 rows, small enough that reading it whole is
 * cheaper than any cleverness.
 */
function readAll_() {
  var values = sheet_().getDataRange().getValues();
  var out = {};
  for (var c in CATEGORIES) out[c] = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var category = String(row[0]);
    if (!out[category]) continue;
    out[category].push({
      userId: String(row[1]),
      displayName: String(row[2]),
      score: Number(row[3]),
      ts: Number(row[4]),
    });
  }
  for (var k in out) out[k] = sortEntries(out[k], CATEGORIES[k].direction);
  return out;
}

/**
 * Rewrite every row. At this size a whole-sheet write beats range bookkeeping.
 *
 * Written over the top rather than cleared first: `clearContents()` followed by
 * `setValues()` leaves a window in which the sheet is empty, and a script that
 * dies in that window takes the whole leaderboard with it. Only the surplus
 * rows below the new content get cleared, and only after the write lands.
 */
function writeAll_(boards) {
  var rows = [HEADERS];
  for (var c in CATEGORIES) {
    var list = boards[c] || [];
    for (var i = 0; i < list.length; i++) {
      rows.push([c, list[i].userId, list[i].displayName, list[i].score, list[i].ts]);
    }
  }
  var sh = sheet_();
  var before = sh.getLastRow();
  /* Force the id and name columns to plain text before writing. Sheets types
     cells by content, so a display name of "007" is stored as the number 7 and
     read back as "7" — the player's chosen name, silently rewritten. Names are
     text even when they look like numbers. */
  sh.getRange(1, 2, Math.max(rows.length, before || 1), 2).setNumberFormat('@');
  sh.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);
  if (before > rows.length) {
    sh.getRange(rows.length + 1, 1, before - rows.length, HEADERS.length).clearContent();
  }
}

/**
 * Verify a Google ID token and return its stable subject.
 *
 * The `sub` comes from Google's response, never from the request body — the
 * body is attacker-controlled. `aud` must match our own client id, or a token
 * minted for some other site would be accepted here.
 */
function verifyIdToken_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 20) return null;

  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
  );
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;

  var info = JSON.parse(res.getContentText());
  if (info.aud !== OAUTH_CLIENT_ID) return null;
  if (!info.sub) return null;

  var secondsLeft = Number(info.exp) - Math.floor(Date.now() / 1000);
  if (!(secondsLeft > 0)) return null;

  var identity = { sub: String(info.sub), name: info.name || info.given_name || '' };
  // Cached only for as long as the token itself is valid, capped at Apps
  // Script's six-hour ceiling.
  cache.put(key, JSON.stringify(identity), Math.min(secondsLeft, 21600));
  return identity;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code) {
  return json_({ ok: false, error: code });
}

/* ──────────────────────────── GET ──────────────────────────── */

/**
 * `?action=boards` returns every category in one response, which is what the
 * game asks for once at start-up. `?action=leaderboard&category=x` returns one.
 *
 * Reads take no lock. A reader that catches a write half-done sees stale rows,
 * not corrupt ones, and the next submit returns fresh data anyway.
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'boards';

    if (action === 'diag') return json_(diag_());

    if (action === 'boards') {
      var cached = CacheService.getScriptCache().get('boards');
      if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);

      var boards = readAll_();
      var payload = { ok: true, size: LEADERBOARD_SIZE, categories: {} };
      for (var c in CATEGORIES) {
        payload.categories[c] = {
          label: CATEGORIES[c].label,
          direction: CATEGORIES[c].direction,
          cutoff: cutoffOf(boards[c], LEADERBOARD_SIZE),
          entries: publicEntries(boards[c].slice(0, LEADERBOARD_SIZE)),
        };
      }
      var body = JSON.stringify(payload);
      CacheService.getScriptCache().put('boards', body, 45);
      return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'leaderboard') {
      if (!isKnownCategory(params.category)) return fail_('unknown_category');
      var one = readAll_()[params.category];
      return json_({
        ok: true,
        category: params.category,
        cutoff: cutoffOf(one, LEADERBOARD_SIZE),
        entries: publicEntries(one.slice(0, LEADERBOARD_SIZE)),
      });
    }

    return fail_('unknown_action');
  } catch (err) {
    return fail_(errorCode_(err));
  }
}

/* ──────────────────────────── POST ──────────────────────────── */

/**
 * Submit one result.
 *
 * The body arrives as text/plain on purpose: a JSON content-type would make the
 * browser send a CORS preflight, and Apps Script Web Apps do not answer OPTIONS.
 * Nothing about that is a weakening — the credential is the ID token in the
 * body, not the content-type.
 *
 * The response carries the refreshed board, so a submit doubles as the refresh
 * and the client never needs a second round trip.
 */
function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseErr) {
      return fail_('bad_request');
    }

    if (!isKnownCategory(body.category)) return fail_('unknown_category');
    if (!isValidScore(body.category, body.score)) return fail_('invalid_score');

    var identity = verifyIdToken_(body.idToken);
    if (!identity) return fail_('unauthenticated');

    var category = body.category;
    var cfg = CATEGORIES[category];
    var entry = {
      userId: identity.sub,
      // The client may offer a handle; the Google name is only the fallback.
      displayName: cleanName(body.displayName || identity.name),
      score: body.score,
      ts: Date.now(),
    };

    var lock = LockService.getScriptLock();
    // Read-modify-write must be atomic or two submissions landing together can
    // each write a board that never saw the other.
    if (!lock.tryLock(20000)) return fail_('busy');

    var result;
    try {
      var boards = readAll_();
      result = applyScore(boards[category], entry, cfg.direction, LEADERBOARD_SIZE);
      if (result.changed) {
        boards[category] = result.entries;
        writeAll_(boards);
        CacheService.getScriptCache().remove('boards');
      }
    } finally {
      lock.releaseLock();
    }

    return json_({
      ok: true,
      status: result.status,
      category: category,
      rank: result.rank,
      best: result.best,
      cutoff: cutoffOf(result.entries, LEADERBOARD_SIZE),
      entries: publicEntries(result.entries),
    });
  } catch (err) {
    return fail_(errorCode_(err));
  }
}
