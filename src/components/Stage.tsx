import { useEffect, useRef, type ReactNode } from 'react';
import { bars, clamp, mmss, rgba } from '../engine/bars';
import { EDGES, geom, markerTarget, NODES, nodeOf, type Geo, type Pt } from '../engine/constellation';
import { optimalRoute } from '../engine/orbs';
import { dominantOrb, ORB_INFO, type Orb, type Spell } from '../engine/spells';
import { accuracy, attempts, statFor } from '../engine/stats';
import { useStore } from '../store';

/** Node scale. Every node-relative radius and caption offset derives from this. */
const NS = 1.5;
/** Cast flourish: one ring per reagent, released a beat apart. */
const CELEB_STAGGER = 150;
const CELEB_RING = 760;
const CELEB_MS = CELEB_STAGGER * 2 + CELEB_RING;
/** Ring travel as a fraction of the triangle radius — small, so it stays home. */
const CELEB_SPREAD = 0.225;
const EMBERS = 120;

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  hex: string;
}

/** One pre-rendered radial sprite per colour, blitted rather than rebuilt. */
const glow = (() => {
  const cache = new Map<string, HTMLCanvasElement>();
  return (hex: string): HTMLCanvasElement => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const x = s.getContext('2d');
    if (x) {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, rgba(hex, 1));
      g.addColorStop(0.35, rgba(hex, 0.35));
      g.addColorStop(1, rgba(hex, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
    }
    cache.set(hex, s);
    return s;
  };
})();

const hexFor = (sp: Spell): string => {
  const orb = dominantOrb(sp.orbs);
  return orb ? ORB_INFO[orb].hex : '#ffd76a';
};

/**
 * What the chart is for at this moment.
 *
 * `drill` is the board you play on; `run` and `life` are the same mastery read
 * differing only in what they count; `idle` is the backdrop behind a brief.
 */
type View = 'idle' | 'drill' | 'run' | 'life';

function viewFor(s: ReturnType<typeof useStore.getState>): View {
  if (s.masteryOpen) return 'life';
  if (s.result) return 'run';
  if (s.statsOpen) return s.lastRun ? 'run' : 'life';
  if (s.running || s.practicing) return 'drill';
  return 'idle';
}

/**
 * The star chart, and the frame everything else hangs off.
 *
 * Every panel in the app is positioned against `#stage`, so the shell is passed
 * in as children rather than sitting beside it — one element, one coordinate
 * space, and the canvases stay underneath without a z-index argument.
 */
export function Stage({ children }: { children?: ReactNode }): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  // The chart fades behind a page rather than vanishing: it is the thing you
  // came back to, and a black rectangle loses your place in it.
  const dimmed = useStore((s) => (s.kbOpen ? 'dim' : s.statsOpen ? 'dim2' : ''));
  // masteryOpen deliberately dims nothing: there, the chart is the page.

  useEffect(() => {
    const stage = stageRef.current;
    const bg = bgRef.current;
    const chart = chartRef.current;
    const bctx = bg?.getContext('2d');
    const ctx = chart?.getContext('2d');
    if (!stage || !bg || !chart || !bctx || !ctx) return;

    let W = 0;
    let H = 0;
    let geo: Geo | null = null;
    let embers: Ember[] = [];
    let mx = 0;
    let my = 0;

    const palette = (): string[] => {
      const { orbs } = useStore.getState();
      return orbs.length ? orbs.map((o: Orb) => ORB_INFO[o].hex) : ['#ff9a3c', '#ffd27a'];
    };

    const spawn = (seed: boolean): Ember => {
      const p = palette();
      return {
        x: Math.random() * W,
        y: seed ? Math.random() * H : H + 10,
        vx: (Math.random() - 0.5) * 0.02,
        vy: -(0.025 + Math.random() * 0.06),
        r: 0.9 + Math.random() * 2,
        age: seed ? Math.random() * 6000 : 0,
        life: 5000 + Math.random() * 5000,
        hex: p[Math.floor(Math.random() * p.length)] as string,
      };
    };

    const fit = (cv: HTMLCanvasElement, c: CanvasRenderingContext2D) => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      cv.width = Math.max(1, (W * dpr) | 0);
      cv.height = Math.max(1, (H * dpr) | 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      fit(bg, bctx);
      fit(chart, ctx);
      geo = geom(W, H);
      // The altar and the chain hang off the constellation's centre, not the viewport's.
      document.documentElement.style.setProperty('--cx', `${geo.cx}px`);
      if (!embers.length) embers = Array.from({ length: EMBERS }, () => spawn(true));
      const p = markerTarget(geo, useStore.getState().orbs);
      mx = p[0];
      my = p[1];
    };

    const drawBg = (dt: number) => {
      bctx.clearRect(0, 0, W, H);
      const g = bctx.createRadialGradient(W / 2, H * 1.08, 0, W / 2, H * 1.08, H * 0.95);
      g.addColorStop(0, 'rgba(120,48,10,.5)');
      g.addColorStop(0.45, 'rgba(46,14,4,.24)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, W, H);
      if (!geo) return;
      bctx.globalCompositeOperation = 'lighter';
      const corners: [Pt, string][] = [
        [geo.Q, ORB_INFO.quas.hex],
        [geo.W, ORB_INFO.wex.hex],
        [geo.E, ORB_INFO.exort.hex],
      ];
      for (const [c, hex] of corners) {
        const gg = bctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], geo.R * 0.9);
        gg.addColorStop(0, rgba(hex, 0.09));
        gg.addColorStop(1, rgba(hex, 0));
        bctx.fillStyle = gg;
        bctx.fillRect(0, 0, W, H);
      }
      // Rising motes take their colours from the reagents in your queue.
      for (let i = 0; i < embers.length; i++) {
        const m = embers[i] as Ember;
        m.age += dt;
        m.x += m.vx * dt + Math.sin((m.age + i * 300) / 1500) * 0.08;
        m.y += m.vy * dt;
        if (m.age > m.life || m.y < -20) {
          embers[i] = spawn(false);
          continue;
        }
        const p = m.age / m.life;
        const a = Math.min(p / 0.15, 1) * Math.min((1 - p) / 0.35, 1) * 0.6;
        const d = m.r * 9;
        bctx.globalAlpha = a;
        bctx.drawImage(glow(m.hex), m.x - d / 2, m.y - d / 2, d, d);
      }
      bctx.globalAlpha = 1;
      bctx.globalCompositeOperation = 'source-over';
    };

    const drawChart = (t: number, dt: number) => {
      ctx.clearRect(0, 0, W, H);
      if (!geo) return;
      const S = useStore.getState();
      const { R, at } = geo;
      const view = viewFor(S);
      const target = view === 'drill' && S.running ? S.combo[S.step] : null;
      /* Mastery and results read the same chart: rings become accuracy, the
         marker and the route go away. They differ only in what they count. */
      const scored = view === 'run' || view === 'life';

      // lattice
      ctx.strokeStyle = view === 'idle' ? 'rgba(184,147,74,.1)' : 'rgba(184,147,74,.24)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const [a, b] of EDGES) {
        const p = at(a.q, a.w, a.e);
        const q = at(b.q, b.w, b.e);
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();

      /* Idle is the brief's backdrop, not the board. The stars are there, unlit
         and unlabelled, so Begin lights up something already in place rather
         than dropping a new screen on top of you. */
      if (view === 'idle') {
        ctx.fillStyle = 'rgba(235,225,204,.22)';
        for (const nd of NODES) {
          const p = at(nd.q, nd.w, nd.e);
          ctx.beginPath();
          ctx.arc(p[0], p[1], 2.2 * NS, 0, 7);
          ctx.fill();
        }
        return;
      }

      // the marker eases toward where the held reagents put you
      const tp = markerTarget(geo, S.orbs);
      const k = Math.min(1, dt * 0.012);
      mx += (tp[0] - mx) * k;
      my += (tp[1] - my) * k;

      if (target) {
        const tn = nodeOf(target.id);
        if (tn) {
          const tpos = at(tn.q, tn.w, tn.e);
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = -t * 0.04;
          ctx.strokeStyle = 'rgba(255,215,106,.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(tpos[0], tpos[1]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(255,215,106,.12)';
          ctx.lineWidth = 7;
          ctx.stroke();
          const ph = (t / 1600) % 1;
          const cxm = mx + (tpos[0] - mx) * ph;
          const cym = my + (tpos[1] - my) * ph;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.9;
          ctx.drawImage(glow('#ffd76a'), cxm - 14, cym - 14, 28, 28);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(cxm, cym, 1.8, 0, 7);
          ctx.fill();
        }
      }

      // per-spell tallies for the run being reviewed
      const per: Record<string, { h: number; m: number }> = {};
      if (view === 'run') {
        for (const x of S.lastRun ? S.lastRun.casts : S.casts) {
          const p = per[x.id] ?? (per[x.id] = { h: 0, m: 0 });
          if (x.ok) p.h++;
          else p.m++;
        }
      }

      /* The chain, traced across the map in cast order: legs already cast go
         solid, the rest stay dashed, and each spell carries its position. */
      if (view === 'drill' && S.running && S.combo.length > 1) {
        const pts = S.combo.map((sp) => {
          const n = nodeOf(sp.id);
          return n ? at(n.q, n.w, n.e) : null;
        });
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          if (!a || !b) continue;
          const done = i <= S.step;
          ctx.strokeStyle = rgba('#ffd76a', done ? 0.55 : 0.2);
          ctx.lineWidth = done ? 2 : 1.2;
          ctx.setLineDash(done ? [] : [5, 6]);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        pts.forEach((p, i) => {
          if (!p) return;
          const bx = p[0] + 16 * NS;
          const by = p[1] - 16 * NS;
          const on = i === S.step;
          const past = i < S.step;
          ctx.fillStyle = on ? '#ffd76a' : 'rgba(9,7,5,.92)';
          ctx.beginPath();
          ctx.arc(bx, by, 9.5, 0, 7);
          ctx.fill();
          ctx.strokeStyle = on ? '#ffd76a' : past ? 'rgba(255,215,106,.45)' : 'rgba(184,147,74,.5)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(bx, by, 9.5, 0, 7);
          ctx.stroke();
          ctx.fillStyle = on ? '#241a06' : past ? 'rgba(255,215,106,.55)' : 'rgba(235,225,204,.8)';
          ctx.fillText(String(i + 1), bx, by);
        });
      }

      // nodes
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tight = R * 0.577 < 210;
      const RING = 9 * NS;
      const L1 = RING + 11;
      const L2 = L1 + 13;
      for (const nd of NODES) {
        const p = at(nd.q, nd.w, nd.e);
        const sp = nd.spell;
        const isT = !!target && sp.id === target.id;
        // No mastery on hover mid-drill: it is a distraction dressed as help,
        // and the one number that matters right then is the shot clock.
        const isH = S.hovered?.id === sp.id && !S.running && !S.paused;
        const hex = hexFor(sp);
        const li = S.slots.findIndex((x) => x && x.id === sp.id);
        const cost = li >= 0 ? 0 : optimalRoute(S.orbs, sp.orbs).length;
        const lifeStat = statFor(S.stats, sp.id);
        const runRec = per[sp.id];
        const a =
          view === 'run' ? (runRec ? runRec.h / (runRec.h + runRec.m) : null) : accuracy(lifeStat);
        const att = view === 'run' ? (runRec ? runRec.h + runRec.m : 0) : attempts(lifeStat);

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = isT || isH ? 0.85 : 0.4;
        ctx.drawImage(glow(hex), p[0] - 22 * NS, p[1] - 22 * NS, 44 * NS, 44 * NS);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (a === null) {
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = 'rgba(184,147,74,.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p[0], p[1], RING, 0, 7);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(184,147,74,.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p[0], p[1], RING, 0, 7);
          ctx.stroke();
          ctx.strokeStyle = a >= 0.9 ? '#5ad1ff' : a >= 0.7 ? '#ffd76a' : '#ff5c6a';
          ctx.lineWidth = 1.5 + (Math.min(att, 40) / 40) * 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(p[0], p[1], RING, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.6 * NS, 0, 7);
        ctx.fill();

        if (isT) {
          ctx.strokeStyle = 'rgba(255,215,106,.9)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 14 * NS, 0, 7);
          ctx.stroke();
          if (S.spellTimeoutMs && S.spellEndsAt) {
            const frac = clamp((S.spellEndsAt - t) / S.spellTimeoutMs, 0, 1);
            ctx.strokeStyle = frac < 0.3 ? '#ff5c6a' : '#ffd76a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 20 * NS, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
            ctx.stroke();
          } else {
            for (let j = 0; j < 2; j++) {
              const q = (t / 1400 + j * 0.5) % 1;
              ctx.strokeStyle = rgba('#ffd76a', (1 - q) * 0.7);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(p[0], p[1], (14 + q * 26) * NS, 0, 7);
              ctx.stroke();
            }
          }
        }
        if (isH) {
          ctx.strokeStyle = 'rgba(235,225,204,.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 18 * NS, 0, 7);
          ctx.stroke();
        }

        const words = sp.name.toUpperCase().split(' ');
        const wrap = tight && words.length > 1;
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.fillStyle = isT || isH ? '#fff' : 'rgba(235,225,204,.78)';
        if (wrap) {
          ctx.fillText(words[0] as string, p[0], p[1] + L1);
          ctx.fillText(words.slice(1).join(' '), p[0], p[1] + L2);
        } else ctx.fillText(words.join(' '), p[0], p[1] + L1);

        const subY = p[1] + (wrap ? L2 : L1) + 14;
        ctx.font = '400 11px "IBM Plex Mono", monospace';
        if (scored) {
          ctx.fillStyle =
            a === null ? 'rgba(97,90,77,.9)' : a >= 0.9 ? 'rgba(90,209,255,.85)' : a >= 0.7 ? 'rgba(255,215,106,.85)' : 'rgba(255,92,106,.9)';
          const blank = view === 'run' ? 'not drawn' : 'never cast';
          ctx.fillText(a === null ? blank : `${Math.round(a * 100)}% · ${att}`, p[0], subY);
        } else {
          ctx.fillStyle = li >= 0 ? '#ffd76a' : 'rgba(138,130,114,.9)';
          ctx.fillText(li >= 0 ? `slot ${li + 1}` : cost === 0 ? 'in hand' : `${cost} key${cost > 1 ? 's' : ''}`, p[0], subY);
        }
      }

      if (!scored) {
        // cast flourish: one ring per reagent, in the spell's own colours
        const cel = S.celebration;
        if (cel) {
          const age = t - cel.id;
          if (age >= 0 && age < CELEB_MS) {
            const q = Math.min(age / CELEB_MS, 1);
            const nd = nodeOf(cel.spellId);
            const sp = nd?.spell ?? null;
            const p: Pt = nd ? at(nd.q, nd.w, nd.e) : [mx, my];
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (1 - q) * 0.6;
            ctx.drawImage(glow(cel.hex), p[0] - 60, p[1] - 60, 120, 120);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            if (sp) {
              for (let i = 0; i < sp.orbs.length; i++) {
                const lq = (age - i * CELEB_STAGGER) / CELEB_RING;
                if (lq <= 0 || lq >= 1) continue;
                ctx.strokeStyle = rgba(ORB_INFO[sp.orbs[i] as Orb].hex, (1 - lq) * 0.85);
                ctx.lineWidth = 2.6 * (1 - lq) + 0.6;
                ctx.beginPath();
                ctx.arc(p[0], p[1], 10 * NS + lq * R * CELEB_SPREAD, 0, 7);
                ctx.stroke();
              }
            }
          }
        }
        // you are here
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(glow('#ffffff'), mx - 20 * NS, my - 20 * NS, 40 * NS, 40 * NS);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(mx, my, 9 * NS, 0, 7);
        ctx.stroke();
        const rot = t * 0.0015;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const ang = rot + (i * Math.PI) / 2;
          ctx.moveTo(mx + Math.cos(ang) * 12 * NS, my + Math.sin(ang) * 12 * NS);
          ctx.lineTo(mx + Math.cos(ang) * 17 * NS, my + Math.sin(ang) * 17 * NS);
        }
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(mx, my, 2.2 * NS, 0, 7);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.fillStyle = 'rgba(235,225,204,.9)';
        ctx.fillText('YOU', mx + 22 * NS, my);
      }
    };

    /* One loop for the whole app: it advances the clocks, runs the resume count,
       then draws. The bars are written through direct DOM handles so sixty
       frames a second never touch React. */
    const PZC = 2 * Math.PI * 54;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      const S = useStore.getState();

      if (S.paused) {
        if (S.resumeUntil) {
          const left = Math.max(0, S.resumeUntil - t);
          if (bars.pzRing) {
            bars.pzRing.style.strokeDasharray = String(PZC);
            bars.pzRing.style.strokeDashoffset = String(PZC * (1 - left / 3000));
          }
          const digit = String(Math.max(1, Math.ceil(left / 1000)));
          if (bars.pzNum && bars.pzNum.textContent !== digit) {
            bars.pzNum.textContent = digit;
            bars.pzNum.classList.remove('tick');
            void bars.pzNum.offsetWidth;
            bars.pzNum.classList.add('tick');
          }
          if (left <= 0) S.endPause(t);
        }
      } else if (S.running) {
        if (S.runDurationMs) {
          const left = S.endsAt - t;
          if (bars.tbar) bars.tbar.style.scale = `${clamp(left / S.runDurationMs, 0, 1)} 1`;
          if (bars.clock) {
            const s = mmss(left);
            if (bars.clock.textContent !== s) bars.clock.textContent = s;
          }
          if (left <= 0) S.finish();
        }
        if (S.spellTimeoutMs && S.spellEndsAt) {
          const left = S.spellEndsAt - t;
          if (bars.shot) bars.shot.style.scale = `${clamp(left / S.spellTimeoutMs, 0, 1)} 1`;
          if (left <= 0) S.spellTimedOut();
        }
      } else if (bars.tbar) bars.tbar.style.scale = '0 1';

      drawBg(dt);
      drawChart(t, dt);
      raf = requestAnimationFrame(tick);
    };

    /* Hover: nearest node within reach of the cursor.
       Only where a star page is welcome — the mastery chart and the sandbox.
       Mid-drill it is suppressed outright rather than merely hidden, so the
       node under a resting cursor does not light up either. */
    const onMove = (e: PointerEvent) => {
      const S = useStore.getState();
      const welcome = S.masteryOpen || (S.practicing && !S.kbOpen && !S.statsOpen);
      if (!geo || S.paused || !welcome) {
        if (S.hovered) S.setHovered(null);
        return;
      }
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      let best: Spell | null = null;
      let bestD = 34 * NS;
      for (const nd of NODES) {
        const p = geo.at(nd.q, nd.w, nd.e);
        const d = Math.hypot(p[0] - x, p[1] - y);
        if (d < bestD) {
          bestD = d;
          best = nd.spell;
        }
      }
      S.setHovered(best);
    };
    const onLeave = () => useStore.getState().setHovered(null);

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div id="stage" className={dimmed} ref={stageRef}>
      <canvas className="layer" id="bgl" ref={bgRef} aria-hidden="true" />
      <canvas className="layer" id="chart" ref={chartRef} aria-hidden="true" />
      {children}
    </div>
  );
}
