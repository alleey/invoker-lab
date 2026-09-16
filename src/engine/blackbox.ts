/**
 * Post-mortem breadcrumbs.
 *
 * A crash takes the console, the devtools timeline and the page with it, so the
 * only evidence that survives is what was already written to disk. This records
 * a small snapshot once a second and marks a clean exit on pagehide — if the
 * next load finds a snapshot that was never marked clean, that snapshot is the
 * last thing the app saw before it died.
 */
const KEY = 'arsenal-magus.blackbox.v1';

export interface Breadcrumb {
  at: string;
  uptimeS: number;
  mode: string;
  running: boolean;
  /** Spells cast in the run that was in progress. */
  casts: number;
  orbs: number;
  heapMB: number | null;
  heapLimitMB: number | null;
  /** Animation frames in the last second. A healthy page sits near 60. */
  fps: number;
  /** Longest single frame in the last second, in ms. */
  worstFrameMs: number;
  /** False until pagehide runs, so an unmarked record means an abnormal end. */
  clean: boolean;
}

export interface Probe {
  mode: string;
  running: boolean;
  casts: number;
  orbs: number;
}

interface Memory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

const memory = (): Memory | null =>
  (performance as Performance & { memory?: Memory }).memory ?? null;

const mb = (bytes: number): number => Math.round(bytes / 1048576);

/** The breadcrumb from a previous load that never shut down cleanly, if any. */
export function readLastCrash(): Breadcrumb | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const crumb = JSON.parse(raw) as Breadcrumb;
    return crumb.clean ? null : crumb;
  } catch {
    return null;
  }
}

export function clearCrash(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function startBlackBox(probe: () => Probe): () => void {
  const booted = performance.now();
  let frames = 0;
  let worst = 0;
  let last = performance.now();
  let raf = 0;
  let latest: Breadcrumb | null = null;

  const countFrame = (now: number) => {
    const dt = now - last;
    last = now;
    frames++;
    if (dt > worst) worst = dt;
    raf = requestAnimationFrame(countFrame);
  };

  const write = (clean: boolean) => {
    const state = probe();
    const mem = memory();
    const crumb: Breadcrumb = {
      at: new Date().toISOString(),
      uptimeS: Math.round((performance.now() - booted) / 1000),
      mode: state.mode,
      running: state.running,
      casts: state.casts,
      orbs: state.orbs,
      heapMB: mem ? mb(mem.usedJSHeapSize) : null,
      heapLimitMB: mem ? mb(mem.jsHeapSizeLimit) : null,
      fps: frames,
      worstFrameMs: Math.round(worst),
      clean,
    };
    latest = crumb;
    try {
      localStorage.setItem(KEY, JSON.stringify(crumb));
    } catch {
      /* storage unavailable — diagnostics are best effort */
    }
    frames = 0;
    worst = 0;
  };

  const timer = window.setInterval(() => write(false), 1000);

  // A normal exit stamps the last record clean, so only an abnormal one is left
  // looking like a crash.
  const markClean = () => {
    if (latest) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...latest, clean: true }));
      } catch {
        /* nothing more to do */
      }
    }
  };

  window.addEventListener('pagehide', markClean);
  raf = requestAnimationFrame(countFrame);

  return () => {
    window.clearInterval(timer);
    cancelAnimationFrame(raf);
    window.removeEventListener('pagehide', markClean);
    markClean();
  };
}
