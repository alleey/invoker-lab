import { useEffect, useState } from 'react';
import { Altar } from './components/Altar';
import { CrashNotice } from './components/CrashNotice';
import { HoverCard } from './components/HoverCard';
import { KeyboardPage } from './components/KeyboardPage';
import { LeftRail } from './components/LeftRail';
import { PausePage } from './components/PausePage';
import { ResultsView } from './components/ResultsView';
import { RightRail } from './components/RightRail';
import { Stage } from './components/Stage';
import { StageBar } from './components/StageBar';
import { StatsPage } from './components/StatsPage';
import { TopBar } from './components/TopBar';
import { Verdict } from './components/Verdict';
import { loadKeyboardLayout } from './engine/bindings';
import { startBlackBox } from './engine/blackbox';
import { useInput } from './hooks/useInput';
import { useStore } from './store';

/**
 * Everything lives inside the stage, absolutely positioned around the star
 * chart. Each panel decides for itself whether it is visible, because the rules
 * differ: the header survives the results view but not a full page, the altar
 * survives neither, and the chart is only ever dimmed.
 */
export function App(): JSX.Element {
  useInput();

  const onPage = useStore((s) => s.kbOpen || s.statsOpen);
  const overlay = useStore((s) => s.kbOpen || s.statsOpen || !!s.result || s.paused);
  const [, bumpLayout] = useState(0);

  // Chromium can tell us the real cap legend; re-render once it answers.
  useEffect(() => {
    void loadKeyboardLayout().then(() => bumpLayout((n) => n + 1));
  }, []);

  // Records the last second before a crash. Reads the store directly so it
  // never re-subscribes and never re-renders anything.
  useEffect(
    () =>
      startBlackBox(() => {
        const s = useStore.getState();
        return { mode: s.mode, running: s.running, casts: s.hits, orbs: s.orbs.length };
      }),
    [],
  );

  return (
    <Stage>
      {!onPage && <TopBar />}
      <CrashNotice />

      <StageBar />
      <LeftRail />
      <HoverCard />
      <RightRail />
      {!overlay && <Altar />}
      <Verdict />

      {!onPage && <ResultsView />}
      <StatsPage />
      <KeyboardPage />
      <PausePage />
    </Stage>
  );
}
