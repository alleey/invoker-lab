/**
 * Exercises a DEPLOYED Apps Script endpoint — the half `test-logic.mjs` cannot
 * reach: routing, Sheet I/O, token validation, and whether Apps Script actually
 * answers a browser-shaped POST.
 *
 *   node server/smoke.mjs <WEB_APP_URL> [ID_TOKEN]
 *
 * Without an ID token it checks everything that does not need a signed-in user,
 * including that submitting without one is refused. With a token (grab one from
 * the browser console after signing in) it also runs a real submit and proves
 * personal-best behaviour end to end.
 *
 * Run it against a THROWAWAY sheet first — the token path writes real rows.
 */
const [, , URL_ARG, ID_TOKEN] = process.argv;

if (!URL_ARG) {
  console.error('\n  usage: node server/smoke.mjs <WEB_APP_URL> [ID_TOKEN]\n');
  process.exit(2);
}
const URL_BASE = URL_ARG.replace(/\/+$/, '');

let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
};

/**
 * Apps Script answers /exec with a 302 to googleusercontent; fetch follows it.
 *
 * Retried once, because that second hop intermittently 404s with "unable to
 * open the file at present" even on a healthy deployment. A single spurious
 * 404 here reads exactly like a broken deployment, which is worth one extra
 * request to rule out — and it is why the game must never treat one failed
 * leaderboard call as the service being down.
 */
async function get(query) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${URL_BASE}?${query}`, { redirect: 'follow' });
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      return { status: res.status, body: null, text };
    }
  }
  return { status: 0, body: null, text: '' };
}

/**
 * text/plain, deliberately. A JSON content-type makes the browser send a CORS
 * preflight and Apps Script does not answer OPTIONS. This mirrors exactly what
 * the game will send, so if this passes the browser will work too.
 */
async function post(payload) {
  // Retried once for the same reason `get` is: the googleusercontent hop
  // intermittently 404s on a healthy deployment. Safe to repeat — the server
  // keeps only a personal best, so a duplicate submission changes nothing.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(URL_BASE, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      return { status: res.status, body: null, text };
    }
  }
  return { status: 0, body: null, text: '' };
}

console.log(`\n  Endpoint: ${URL_BASE}\n`);

/* ── reachable and returning JSON at all ── */
const boards = await get('action=boards');
check('GET boards returns HTTP 200', boards.status === 200, `got ${boards.status}`);
check(
  'GET boards returns JSON, not an HTML login page',
  boards.body !== null,
  boards.text ? `first 120 chars: ${boards.text.slice(0, 120)}` : '',
);

if (!boards.body) {
  console.error(
    '\n  Stopped: the endpoint did not return JSON.\n' +
      '  Almost always this means the Web App is not deployed with access\n' +
      '  "Anyone" — Google served a sign-in page instead.\n',
  );
  process.exit(1);
}

/* Setup mistakes get named rather than guessed at. */
const SETUP_HINTS = {
  sheet_id_not_set: ['SHEET_ID is still the placeholder in leaderboard.gs.'],
  cannot_open_sheet: [
    'SHEET_ID is wrong, or the script was never authorised for Sheets.',
    'The id is the part of the Sheet URL between /d/ and /edit.',
  ],
  missing_tab: [
    'The tab is not called "Leaderboard".',
    'Renaming the FILE is not enough — rename the TAB at the bottom of the window.',
  ],
  unexpected_headers: ['Row 1 must read exactly: Category | UserId | DisplayName | Score | Timestamp'],
};

if (boards.body.ok !== true) {
  const diag = await get('action=diag');
  const d = diag.body || {};
  const problem = d.problem || boards.body.error;
  console.error('');
  console.error('  The endpoint is reachable but cannot read the sheet.');
  console.error('');
  if (d.sheetIdSet !== undefined) {
    console.error(`    SHEET_ID filled in .......... ${d.sheetIdSet ? 'yes' : 'NO'}`);
    console.error(`    OAUTH_CLIENT_ID filled in ... ${d.clientIdSet ? 'yes' : 'NO'}`);
    console.error(`    sheet opens ................. ${d.sheetOpens ? 'yes' : 'NO'}`);
    console.error(`    tab "${d.expectedTab}" found ..... ${d.tabFound ? 'yes' : 'NO'}`);
    if (Array.isArray(d.tabsPresent) && d.tabsPresent.length) {
      console.error(`    tabs actually present ....... ${d.tabsPresent.join(', ')}`);
    }
    if (Array.isArray(d.headerRow) && d.headerRow.length) {
      console.error(`    header row .................. ${d.headerRow.join(' | ')}`);
    }
  } else {
    console.error('    (diag endpoint not present — redeploy with a New version)');
  }
  console.error('');
  console.error(`  Problem: ${problem}`);
  for (const line of SETUP_HINTS[problem] || []) console.error(`    ${line}`);
  console.error('');
  process.exit(1);
}

check('GET boards reports ok', boards.body.ok === true, JSON.stringify(boards.body).slice(0, 200));
check('GET boards carries a size', Number.isFinite(boards.body.size));
check('GET boards carries categories', !!boards.body.categories);

const cats = Object.keys(boards.body.categories || {});
check('GET boards lists every category', cats.length === 5, `got ${cats.length}: ${cats.join(', ')}`);
for (const c of cats) {
  const cat = boards.body.categories[c];
  check(`${c} has a direction`, cat.direction === 'asc' || cat.direction === 'desc');
  check(`${c} has an entries array`, Array.isArray(cat.entries));
  check(`${c} never exposes a user id`, !JSON.stringify(cat.entries).includes('userId'));
}

/* ── single-category read ── */
const one = await get('action=leaderboard&category=rapid');
check('GET one category works', one.body?.ok === true, JSON.stringify(one.body).slice(0, 160));

/* ── rejections ── */
const bogus = await get('action=leaderboard&category=../../secrets');
check('GET rejects a traversal category', bogus.body?.error === 'unknown_category', JSON.stringify(bogus.body));

const unknownAction = await get('action=drop_table');
check('GET rejects an unknown action', unknownAction.body?.error === 'unknown_action', JSON.stringify(unknownAction.body));

const noAuth = await post({ category: 'rapid', score: 10, displayName: 'Smoke' });
check(
  'POST without a token is refused',
  noAuth.body?.error === 'unauthenticated',
  JSON.stringify(noAuth.body),
);

const forgedName = await post({ category: 'rapid', score: 10, displayName: 'Smoke', idToken: 'not-a-token' });
check(
  'POST with a junk token is refused',
  forgedName.body?.error === 'unauthenticated',
  JSON.stringify(forgedName.body),
);

const badCat = await post({ category: 'nope', score: 10, idToken: 'x'.repeat(40) });
check('POST rejects an unknown category', badCat.body?.error === 'unknown_category', JSON.stringify(badCat.body));

const badScore = await post({ category: 'rapid', score: 'lots', idToken: 'x'.repeat(40) });
check('POST rejects a non-numeric score', badScore.body?.error === 'invalid_score', JSON.stringify(badScore.body));

const hugeScore = await post({ category: 'rapid', score: 999999, idToken: 'x'.repeat(40) });
check('POST rejects an out-of-bounds score', hugeScore.body?.error === 'invalid_score', JSON.stringify(hugeScore.body));

// Category and score are checked before the token, so these prove validation
// order without needing a real credential.
check(
  'validation runs before authentication',
  badCat.body?.error === 'unknown_category' && badScore.body?.error === 'invalid_score',
);

/* ── the authenticated path ── */
if (ID_TOKEN) {
  console.log('  Signed-in checks (these write to the sheet)\n');

  const base = 11;
  const first = await post({ category: 'rapid', score: base, displayName: 'SmokeTest', idToken: ID_TOKEN });
  check('POST with a real token is accepted', first.body?.ok === true, JSON.stringify(first.body).slice(0, 200));
  check(
    'POST returns a status the client can branch on',
    ['ranked', 'not_ranked', 'no_improvement'].includes(first.body?.status),
    JSON.stringify(first.body?.status),
  );
  check('POST returns the refreshed board', Array.isArray(first.body?.entries));
  check('POST response never exposes a user id', !JSON.stringify(first.body || {}).includes('userId'));

  const worse = await post({ category: 'rapid', score: base - 1, displayName: 'SmokeTest', idToken: ID_TOKEN });
  check(
    'a lower score does not replace your best',
    worse.body?.status === 'no_improvement' || worse.body?.status === 'not_ranked',
    JSON.stringify(worse.body?.status),
  );

  const better = await post({ category: 'rapid', score: base + 1, displayName: 'SmokeTest', idToken: ID_TOKEN });
  check('a higher score is accepted', better.body?.ok === true, JSON.stringify(better.body).slice(0, 160));

  const after = await get('action=leaderboard&category=rapid');
  const mine = (after.body?.entries || []).filter((e) => e.displayName === 'SmokeTest');
  check('you hold at most one entry per category', mine.length <= 1, `found ${mine.length}`);

  console.log('  Remember to delete the SmokeTest rows from the sheet.\n');
} else {
  console.log('  Skipped signed-in checks — pass an ID token as the second argument.\n');
}

console.log(`  ${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL  ${f}\n`);
  process.exit(1);
}
console.log('  Endpoint verified.\n');
