import { MODES, PRACTICE } from '../engine/modes';
import { mins, pct, sec, tier } from '../engine/format';
import { accuracy, attempts, averageMs, statFor, weakestSpells } from '../engine/stats';
import { useStore, WEAK_POOL_SIZE } from '../store';
import { Kbd } from './Kbd';
import { SpellIcon } from './SpellIcon';

function Seg<T extends number | string>({
  options,
  value,
  onPick,
  render,
  label,
}: {
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
  render: (v: T) => string;
  label: string;
}): JSX.Element {
  return (
    <div className="opt">
      <p className="lb">{label}</p>
      <span className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o)} type="button" aria-pressed={value === o} onClick={() => onPick(o)}>
            {render(o)}
          </button>
        ))}
      </span>
    </div>
  );
}

/**
 * The spells the weakness filter would actually draw, named.
 *
 * Without this the All 10 / Weakest 6 toggle asks you to trust a selection you
 * cannot see. Ordered worst accuracy first, then slowest — see weakestSpells.
 */
function WeakestStrip({ inPlay }: { inPlay: boolean }): JSX.Element {
  const stats = useStore((s) => s.stats);
  const six = weakestSpells(stats, WEAK_POOL_SIZE);

  return (
    <div className={`weakest${inPlay ? ' live' : ''}`}>
      <p className="lb">Your weakest {WEAK_POOL_SIZE}</p>
      <div className="chips">
        {six.map((spell) => {
          const stat = statFor(stats, spell.id);
          const acc = accuracy(stat);
          const avg = averageMs(stat);
          const n = attempts(stat);
          return (
            <span className="chip" key={spell.id}>
              <SpellIcon spell={spell} size={20} />
              <b>{spell.name}</b>
              {n > 0 && (
                <em>
                  {avg === null ? '—' : sec(avg)} · {n} cast{n === 1 ? '' : 's'}
                </em>
              )}
              <span className={`acc ${acc === null ? 'none' : tier(acc)}`}>
                {acc === null ? 'never cast' : pct(acc)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What you read before you commit to a run. It sits where the constellation
 * will be rather than off in a rail, so Begin dissolves the brief and lights
 * the stars in the same place instead of reflowing the page.
 */
export function ModeBrief(): JSX.Element | null {
  const mode = useStore((s) => s.mode);
  const lengths = useStore((s) => s.lengths);
  const timeouts = useStore((s) => s.timeouts);
  const focusWeak = useStore((s) => s.prefs.focusWeak);
  const bindings = useStore((s) => s.bindings);
  const best = useStore((s) => s.stats.modes[s.mode] ?? 0);
  const idle = useStore((s) => !s.running && !s.practicing && !s.result && !s.kbOpen && !s.statsOpen && !s.masteryOpen);
  const start = useStore((s) => s.start);
  const setPracticing = useStore((s) => s.setPracticing);
  const setLength = useStore((s) => s.setLength);
  const setSpellTimeout = useStore((s) => s.setSpellTimeout);
  const setFocusWeak = useStore((s) => s.setFocusWeak);

  if (!idle) return null;

  const c = MODES[mode];
  const ex = c.example;

  return (
    <section className="brief">
      <div className="brief-main">
        <p className="eb">{c.label}</p>
        <h2 className="brief-goal">{c.goal}</h2>

        <ol className="steps">
          {c.steps.map((step, i) => (
            <li key={i}>
              <b>{i + 1}</b>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <dl className="meta">
          <div>
            <dt>Scoring</dt>
            <dd>{c.scoring}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{c.ends}</dd>
          </div>
          <div>
            <dt>Your best</dt>
            <dd>
              {best > 0 ? (
                <>
                  {best}
                  {c.scoreBy === 'efficiency' ? '%' : ''}{' '}
                  <small>{c.scoreBy === 'streak' ? 'longest streak' : c.scoreBy === 'efficiency' ? 'routed at par' : 'spells landed'}</small>
                </>
              ) : (
                'nothing recorded yet'
              )}
            </dd>
          </div>
        </dl>

        {ex && (
          <div className="example">
            {ex.setup} {ex.ask}
            {([['good', ex.efficient] as const, ['bad', ex.wasteful] as const]).map(([tone, r]) => (
              <div key={tone}>
                <div className={`r ${tone}`}>
                  <span>
                    {r.orbs.map((o, i) => (
                      <Kbd key={i} code={bindings[o]} />
                    ))}
                    <Kbd code={bindings.invoke} />
                    <Kbd code={bindings.slot1} />
                  </span>
                  <em>{tone === 'good' ? 'efficient' : 'wasteful'}</em>
                </div>
                <p className="n">{r.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="brief-side">
        <div className="opts">
          {c.durationOptions.length > 0 && (
            <Seg
              label="Session"
              options={c.durationOptions}
              value={lengths[mode] || c.defaultDuration}
              onPick={(v) => setLength(mode, v)}
              render={mins}
            />
          )}
          {c.spellTimeoutOptions.length > 0 && (
            <Seg
              label="Shot clock"
              options={c.spellTimeoutOptions}
              value={timeouts[mode] || c.defaultSpellTimeout}
              onPick={(v) => setSpellTimeout(mode, v)}
              render={(v) => `${v / 1000}s`}
            />
          )}
          <div className="opt">
            <p className="lb">Spell pool</p>
            <span className="seg" role="group" aria-label="Spell pool">
              <button type="button" aria-pressed={!focusWeak} onClick={() => setFocusWeak(false)}>
                All 10
              </button>
              <button type="button" aria-pressed={focusWeak} onClick={() => setFocusWeak(true)}>
                Weakest {WEAK_POOL_SIZE}
              </button>
            </span>
          </div>
        </div>

        <WeakestStrip inPlay={focusWeak} />

        <div className="brief-go">
          <button className="begin" type="button" onClick={() => start()}>
            Begin drill · Space
          </button>
          <button className="begin alt" type="button" onClick={() => setPracticing(true)}>
            {PRACTICE.label}
          </button>
          <p className="n">
            {PRACTICE.label} is not {c.label} practice — nothing is drawn, timed or scored.
          </p>
        </div>
      </div>
    </section>
  );
}
