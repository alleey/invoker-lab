import { MODES } from '../engine/modes';
import { spellFor } from '../engine/orbs';
import { useStore } from '../store';
import { ComboTrack } from './ComboTrack';
import { ModeBrief } from './ModeBrief';
import { Sigil } from './Sigil';

export function Cue(): JSX.Element {
  const mode = useStore((s) => s.mode);
  const running = useStore((s) => s.running);
  const combo = useStore((s) => s.combo);
  const step = useStore((s) => s.step);
  const chainPar = useStore((s) => s.chainPar);
  const chainPresses = useStore((s) => s.chainPresses);
  const verdict = useStore((s) => s.verdict);
  const orbs = useStore((s) => s.orbs);

  const config = MODES[mode];
  const untargeted = config.comboSizes.length === 0;
  const target = combo[step] ?? null;
  const live = untargeted ? spellFor(orbs) : null;

  // Practice has no running state, so its brief gives way to the live preview
  // as soon as there are three reagents to read.
  const showBrief = untargeted ? live === null : !running;

  if (showBrief) {
    return (
      <div className="cue">
        <ModeBrief mode={config} />
        <p className={`verdict ${verdict.tone}`}>{verdict.text || ' '}</p>
      </div>
    );
  }

  let eyebrow: string;
  let heading: JSX.Element | string;
  let tag: string;

  if (live) {
    eyebrow = 'Invoking';
    heading = live.name;
    tag = live.tag;
  } else if (target && config.reveal === 'sigil') {
    eyebrow = 'Match this signature';
    heading = <Sigil orbs={target.orbs} size="lg" />;
    tag = 'Three reagents. Name it with your hands.';
  } else if (target) {
    eyebrow = combo.length > 1 ? `Spell ${step + 1} of ${combo.length}` : 'Invoke and cast';
    heading = target.name;
    tag = target.tag;
  } else {
    eyebrow = 'Ready';
    heading = config.label;
    tag = config.goal;
  }

  return (
    <div className="cue">
      <ComboTrack combo={combo} step={step} />
      <p className="eyebrow">{eyebrow}</p>
      {/* Keyed on the target so each new spell replays the materialise animation
          instead of swapping text inside a reused node. */}
      <h2 className="spellname" key={target?.id ?? live?.id ?? 'idle'}>
        {heading}
      </h2>
      <p className="spelltag">{tag}</p>

      {/* The budget is for the whole chain, so pre-invoking reads as the saving
          it is instead of being charged to whichever spell was next. */}
      {config.trackEfficiency && running && chainPar > 0 && (
        <p className="par">
          CHAIN PAR <b>{chainPar}</b> KEYS · USED{' '}
          <b className={chainPresses > chainPar ? 'over' : undefined}>{chainPresses}</b>
        </p>
      )}

      <p className={`verdict ${verdict.tone}`}>{verdict.text || ' '}</p>
    </div>
  );
}
