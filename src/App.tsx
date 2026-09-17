import { useEffect, useState } from 'react';
import { Altar } from './components/Altar';
import { CrashNotice } from './components/CrashNotice';
import { StarCard } from './components/StarCard';
import { KeyboardPage } from './components/KeyboardPage';
import { LeftRail } from './components/LeftRail';
import { MasteryPage } from './components/MasteryPage';
import { ModeBrief } from './components/ModeBrief';
import { PausePage } from './components/PausePage';
import { PracticeBar } from './components/PracticeBar';
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
 * appears only once you have committed to a drill or the sandbox, and the chart
 * is never hidden, only re-purposed.
 */
export function App(): JSX.Element {
  useInput();

  /**
   * The sandbox gets the header slot to itself.
   *
   * Its title and Done button are positioned exactly where the app title and
   * the tiles are, so both drew on top of each other. Ceding the row is also
   * the honest thing: casts, streak, accuracy and a session clock are all
   * meaningless in free casting, and showing them implies otherwise.
   */
  const onPage = useStore((s) => s.kbOpen || s.statsOpen || s.masteryOpen);
  const chrome = useStore((s) => !s.kbOpen && !s.statsOpen && !s.masteryOpen && !s.practicing);
  const board = useStore((s) => (s.running || s.practicing) && !s.paused && !s.result);
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
      {chrome && <TopBar />}
      <CrashNotice />

      <ModeBrief />
      <PracticeBar />
      <StageBar />
      <LeftRail />
      <StarCard />
      <RightRail />
      {board && !onPage && <Altar />}
      <Verdict />

      {!onPage && <ResultsView />}
      <MasteryPage />
      <StatsPage />
      <KeyboardPage />
      <PausePage />
    </Stage>
  );
}
