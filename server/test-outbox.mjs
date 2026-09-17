/**
 * The client-side outbox and local qualification gate, proved without a browser.
 *
 * These are the rules that decide whether a result survives a closed tab and
 * whether a request is worth making at all, so they are worth pinning down
 * before any UI depends on them.
 *
 *   node server/test-outbox.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, '..', 'src', 'engine', 'leaderboard.ts');
const src = readFileSync(srcPath, 'utf8');

// Only the pure half is under test; the wire half touches import.meta.env and
// fetch, neither of which exists here. Cut the file at the divider.
const pure = src.slice(0, src.indexOf('/* ════════════════════════ wire'));
const js = ts.transpileModule(pure, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const exports_ = {};
new Function('exports', 'require', js)(exports_, () => ({}));
const { isBetter, couldRank, queueBest, confirm } = exports_;

let passed = 0;
const failures = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) passed++;
  else failures.push(`${name}\n    got  ${a}\n    want ${b}`);
};
const ok = (name, cond) => eq(name, !!cond, true);

const board = (cutoff, direction = 'desc') => ({ label: 'x', direction, cutoff, entries: [] });

/* ── the local gate ── */
ok('no board cached at all: always try', couldRank(1, undefined));
ok('board with room: always try', couldRank(1, board(null)));
ok('desc: above the cutoff qualifies', couldRank(40, board(31)));
ok('desc: below the cutoff does not', !couldRank(20, board(31)));
ok('desc: equalling the cutoff does not', !couldRank(31, board(31)));
ok('asc: below the cutoff qualifies', couldRank(20, board(31, 'asc')));
ok('asc: above the cutoff does not', !couldRank(40, board(31, 'asc')));
ok('asc: equalling the cutoff does not', !couldRank(31, board(31, 'asc')));

/* A stale cutoff must fail safe: it can only ever be too low, never too high,
   so it may cost a wasted request but must never suppress a real one. */
ok('a stale (lower) cutoff still lets a good score through', couldRank(60, board(20)));
ok('a stale cutoff never blocks a score above it', couldRank(21, board(20)));

/* ── the outbox ── */
{
  const a = queueBest({}, 'rapid', 10, 1);
  eq('first best is queued', a.rapid, { score: 10, at: 1 });

  const b = queueBest(a, 'rapid', 15, 2);
  eq('a better score replaces it', b.rapid, { score: 15, at: 2 });

  const c = queueBest(b, 'rapid', 12, 3);
  eq('a worse score is ignored', c.rapid, { score: 15, at: 2 });

  const d = queueBest(c, 'rapid', 15, 4);
  eq('an equal score is ignored', d.rapid, { score: 15, at: 2 });

  eq('one slot per category however many bests', Object.keys(d).length, 1);

  const multi = queueBest(d, 'daredevil', 3, 5);
  eq('categories are independent', Object.keys(multi).sort(), ['daredevil', 'rapid']);

  const asc = queueBest({}, 'rapid', 30, 1, 'asc');
  eq('asc: a lower score replaces', queueBest(asc, 'rapid', 22, 2, 'asc').rapid, { score: 22, at: 2 });
  eq('asc: a higher score is ignored', queueBest(asc, 'rapid', 44, 2, 'asc').rapid, { score: 30, at: 1 });
}

/* ── confirming ── */
{
  const queued = queueBest({}, 'rapid', 15, 1);
  eq('confirming the queued score clears it', confirm(queued, 'rapid', 15), {});
  eq('confirming an unrelated category is a no-op', confirm(queued, 'combo', 15), queued);
  eq('confirming an empty outbox is a no-op', confirm({}, 'rapid', 15), {});

  // A better result set while the request was in flight must survive its
  // response landing afterwards, or the new best is silently dropped.
  const raced = queueBest(queued, 'rapid', 20, 2);
  eq('a newer best is not cleared by an older confirmation', confirm(raced, 'rapid', 15), raced);
  eq('the newer best clears on its own confirmation', confirm(raced, 'rapid', 20), {});
}

/* ── the signed-out week ── */
{
  // Play anonymously, setting bests across several categories and sessions.
  let out = {};
  out = queueBest(out, 'rapid', 12, 100);
  out = queueBest(out, 'combo', 4, 200);
  out = queueBest(out, 'rapid', 19, 300);
  out = queueBest(out, 'daredevil', 7, 400);
  out = queueBest(out, 'rapid', 15, 500);

  eq('a week of anonymous play leaves one entry per category', Object.keys(out).sort(), [
    'combo',
    'daredevil',
    'rapid',
  ]);
  eq('and each holds the best, not the latest', out.rapid.score, 19);

  // Signing in flushes them; a partial flush leaves the rest queued.
  let after = confirm(out, 'rapid', 19);
  eq('a confirmed category leaves the others queued', Object.keys(after).sort(), ['combo', 'daredevil']);
  after = confirm(after, 'combo', 4);
  after = confirm(after, 'daredevil', 7);
  eq('a full flush empties the outbox', after, {});
}

console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL  ${f}\n`);
  process.exit(1);
}
console.log('  Outbox rules verified.\n');
