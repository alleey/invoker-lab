import { useStore } from '../store';

export function Verdict(): JSX.Element | null {
  const verdict = useStore((s) => s.verdict);
  const overlay = useStore((s) => s.kbOpen || s.statsOpen || !!s.result || s.paused);
  if (overlay || !verdict.text) return null;
  return <p className={`verdict ${verdict.tone}`}>{verdict.text}</p>;
}
