import type { Mode } from '../engine/modes';
import { DrillOptions } from './DrillOptions';
import { ModeExample } from './ModeExample';

interface Props {
  mode: Mode;
}

/**
 * Shown in the arena whenever a drill is not under way — which is exactly when
 * someone is deciding whether they understand the mode well enough to press
 * Begin, and how long they want to spend.
 */
export function ModeBrief({ mode }: Props): JSX.Element {
  return (
    <div className="brief">
      <p className="eyebrow">{mode.label}</p>
      <p className="brief-goal">{mode.goal}</p>

      <ol className="brief-steps">
        {mode.steps.map((step, i) => (
          <li key={i}>
            <span className="brief-num">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      {mode.example && <ModeExample example={mode.example} />}

      <DrillOptions mode={mode} />

      <dl className="brief-meta">
        <div>
          <dt>Scoring</dt>
          <dd>{mode.scoring}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{mode.ends}</dd>
        </div>
      </dl>
    </div>
  );
}
