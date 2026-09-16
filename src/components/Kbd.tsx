import { keyLabel } from '../engine/bindings';

/**
 * One key, drawn as a cap. `gold` marks a key that belongs to the route being
 * described rather than to the surrounding prose.
 */
export function Kbd({ code, gold }: { code: string; gold?: boolean }): JSX.Element {
  return <kbd className={`k${gold ? ' g' : ''}`}>{keyLabel(code)}</kbd>;
}
