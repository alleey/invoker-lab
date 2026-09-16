import { useEffect, useRef } from 'react';
import { ORB_INFO, type Orb } from '../engine/spells';
import { useStore } from '../store';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  hex: string;
}

const COUNT = 72;
const FALLBACK: readonly string[] = [ORB_INFO.quas.hex, ORB_INFO.wex.hex, ORB_INFO.exort.hex];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A drifting mote field that takes its colour from the reagents you are holding.
 *
 * Canvas rather than DOM because seventy additive sprites would thrash layout,
 * and it reads orb state through a ref so a keypress never restarts the loop.
 */
export function Aether(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbs = useStore((s) => s.orbs);
  const orbsRef = useRef<Orb[]>(orbs);
  orbsRef.current = orbs;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;

    /**
     * One pre-rendered sprite per reagent colour, drawn once and blitted.
     * Building a radial gradient per mote per frame meant ~4,300 gradient
     * allocations a second, all of it garbage.
     */
    const sprites = new Map<string, HTMLCanvasElement>();
    const spriteFor = (hex: string): HTMLCanvasElement => {
      const cached = sprites.get(hex);
      if (cached) return cached;
      const size = 64;
      const sprite = document.createElement('canvas');
      sprite.width = size;
      sprite.height = size;
      const sctx = sprite.getContext('2d');
      if (sctx) {
        const [r, g, b] = hexToRgb(hex);
        const grad = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, size, size);
      }
      sprites.set(hex, sprite);
      return sprite;
    };

    const resize = () => {
      // 1.5 is plenty for a soft glow field and costs a third fewer pixels
      // than 2 on a retina display.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const palette = (): readonly string[] => {
      const held = orbsRef.current;
      return held.length ? held.map((orb) => ORB_INFO[orb].hex) : FALLBACK;
    };

    const spawn = (seeded: boolean): Mote => {
      const colours = palette();
      const life = 5200 + Math.random() * 6200;
      return {
        x: Math.random() * width,
        y: seeded ? Math.random() * height : height + 12,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(0.10 + Math.random() * 0.22),
        r: 0.6 + Math.random() * 1.9,
        age: seeded ? Math.random() * life : 0,
        life,
        hex: colours[Math.floor(Math.random() * colours.length)] as string,
      };
    };

    resize();
    const motes: Mote[] = Array.from({ length: COUNT }, () => spawn(true));

    let frame = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(now - last, 48);
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i] as Mote;
        if (!reduced) {
          m.age += dt;
          m.x += m.vx * dt + Math.sin((m.age + i * 400) / 1400) * 0.12;
          m.y += m.vy * dt;
        }
        if (m.age > m.life || m.y < -20) {
          motes[i] = spawn(false);
          continue;
        }
        // Fade in over the first fifth of life, out over the last third.
        const t = m.age / m.life;
        const alpha = Math.min(t / 0.2, 1) * Math.min((1 - t) / 0.33, 1) * 0.5;
        const d = m.r * 10;
        ctx.globalAlpha = alpha;
        ctx.drawImage(spriteFor(m.hex), m.x - d / 2, m.y - d / 2, d, d);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas className="aether" ref={canvasRef} aria-hidden="true" />;
}
