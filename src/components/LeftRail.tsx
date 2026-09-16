import { MODES } from '../engine/modes';
import { spellFor } from '../engine/orbs';
import { parFor } from '../engine/slots';
import { ORB_INFO, type Orb } from '../engine/spells';
import { useStore, WEAK_POOL_SIZE } from '../store';
import { Kbd } from './Kbd';
import { Sigil } from './Sigil';
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
 * The rail holds what you read between casts. What you need *during* one — the
 * chain and the shot clock — lives under the stars instead.
 */
export function LeftRail(): JSX.Element | null {
  const s = useStore();
  const c = MODES[s.mode];
  const overlay = s.kbOpen || s.statsOpen || !!s.result || s.paused;
  if (overlay) return null;

  const untargeted = c.comboSizes.length === 0;
  const live = untargeted ? spellFor(s.orbs) : null;

  // Practice, with three reagents held: show what they make.
  if (live) {
    return (
      <aside className="left">
        <p className="eb">Invoking</p>
        <h2 className="in">
          <SpellIcon spell={live} size={34} />
          <span>{live.name}</span>
        </h2>
        <p className="tag">{live.tag}</p>
        <div className="route">
          <Sigil orbs={live.orbs} />
          {live.orbs.map((o: Orb) => ORB_INFO[o].name).join(' · ')}
          <Kbd code={s.bindings.invoke} gold /> invoke, then <Kbd code={s.bindings.slot1} gold /> to cast
        </div>
      </aside>
    );
  }

  // A drill in progress: the spell you owe and the cheapest way to it.
  const target = s.running ? s.combo[s.step] : null;
  if (target) {
    const par = parFor(s.orbs, s.slots, target);
    return (
      <aside className="left">
        <p className="eb">{s.combo.length > 1 ? `Spell ${s.step + 1} of ${s.combo.length}` : 'Invoke and cast'}</p>
        <h2 className="in">
          <SpellIcon spell={target} size={34} />
          <span>{target.name}</span>
        </h2>
        <p className="tag">{target.tag}</p>
        <div className="route">
          {par.needsInvoke ? (
            <>
              {par.route.map((o, i) => (
                <Kbd key={i} code={s.bindings[o]} />
              ))}
              {par.route.length ? `${par.route.length} press${par.route.length === 1 ? '' : 'es'} · ` : 'reagents in hand · '}
              <Kbd code={s.bindings.invoke} gold />
              <Kbd code={s.bindings.slot1} gold />
              <b>par {par.total}</b>
            </>
          ) : (
            <>
              Already in slot {par.slot + 1} — <Kbd code={s.bindings[par.slot === 0 ? 'slot1' : 'slot2']} gold /> cast,{' '}
              <b>par 1</b>
            </>
          )}
        </div>
        {c.trackEfficiency && s.chainPar > 0 && (
          <p className="tag">
            {s.combo.length > 1 ? 'Chain par' : 'Par'} <b>{s.chainPar}</b> keys · used{' '}
            <b>{s.chainPresses}</b>
          </p>
        )}
        <button className="begin end" type="button" onClick={() => s.toggleRun()}>
          End drill · Space
        </button>
      </aside>
    );
  }

  // Idle: the brief for whichever mode is selected.
  const ex = c.example;
  return (
    <aside className="left">
      <p className="eb">{c.label}</p>
      <p className="goal">{c.goal}</p>
      {untargeted ? (
        <p className="tag">Stack three reagents to see what they make.</p>
      ) : (
        <button className="begin" type="button" onClick={() => s.start()}>
          Begin drill · Space
        </button>
      )}
      <ol className="steps">
        {c.steps.map((step, i) => (
          <li key={i}>
            <b>{i + 1}</b>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {ex && (
        <div className="example">
          {ex.setup} {ex.ask}
          {([['good', ex.efficient] as const, ['bad', ex.wasteful] as const]).map(([tone, r]) => (
            <div key={tone}>
              <div className={`r ${tone}`}>
                <span>
                  {r.orbs.map((o, i) => (
                    <Kbd key={i} code={s.bindings[o]} />
                  ))}
                  <Kbd code={s.bindings.invoke} />
                  <Kbd code={s.bindings.slot1} />
                </span>
                <em>{tone === 'good' ? 'efficient' : 'wasteful'}</em>
              </div>
              <p className="n">{r.note}</p>
            </div>
          ))}
        </div>
      )}

      {!untargeted && (
        <div className="opts">
          {c.durationOptions.length > 0 && (
            <Seg
              label="Session"
              options={c.durationOptions}
              value={s.lengths[s.mode] || c.defaultDuration}
              onPick={(v) => s.setLength(s.mode, v)}
              render={(v) => `${v / 1000}s`}
            />
          )}
          {c.spellTimeoutOptions.length > 0 && (
            <Seg
              label="Shot clock"
              options={c.spellTimeoutOptions}
              value={s.timeouts[s.mode] || c.defaultSpellTimeout}
              onPick={(v) => s.setSpellTimeout(s.mode, v)}
              render={(v) => `${v / 1000}s`}
            />
          )}
          <div className="opt">
            <p className="lb">Spell pool</p>
            <span className="seg" role="group" aria-label="Spell pool">
              <button type="button" aria-pressed={!s.prefs.focusWeak} onClick={() => s.setFocusWeak(false)}>
                All 10
              </button>
              <button type="button" aria-pressed={s.prefs.focusWeak} onClick={() => s.setFocusWeak(true)}>
                Weakest {WEAK_POOL_SIZE}
              </button>
            </span>
          </div>
        </div>
      )}

      <dl className="meta">
        <div>
          <dt>Scoring</dt>
          <dd>{c.scoring}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{c.ends}</dd>
        </div>
      </dl>
    </aside>
  );
}
