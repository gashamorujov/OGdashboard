import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { APP_CONFIG } from '../../lib/config';
import { FLASH_UI_AT, Scene, T_FLASH, T_WHITE, TITLE_AT } from './scene';
import './splash.css';

/** Light-to-site reveal length (ms) and the shortened timings for reduced motion. */
const REVEAL_MS = 1250;
const REDUCED_INTRO_MS = 1100;
const REDUCED_LIFT_MS = 450;
const STILL_FRAME_S = 3.2;

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Props {
  /** Called the moment the light starts opening onto the site, so the app can start its own entrance animation. */
  onLeave: () => void;
  /** Called when the intro is fully gone. */
  onDone: () => void;
}

/**
 * Cinematic intro: a ship sails toward a lighthouse at night. On the last sweep the beam points at the viewer, its light
 * fills the whole screen and then opens outward from the lamp, revealing the site underneath.
 */
export function Splash({ onLeave, onDone }: Props) {
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0); // 0 opening, 1 title, 2 light takes over
  const [leaving, setLeaving] = useState(false);
  const skip = useRef<() => void>(() => undefined);
  const callbacks = useRef({ onLeave, onDone });
  callbacks.current = { onLeave, onDone };
  const name = APP_CONFIG.appName;

  const requestSkip = useCallback(() => skip.current(), []);

  // Reduced motion: one still frame, then a plain fade.
  useEffect(() => {
    if (!reduced) return;
    const el = canvas.current;
    if (el) {
      try {
        const s = new Scene(el);
        s.resize(window.innerWidth, window.innerHeight, 1);
        s.draw(STILL_FRAME_S);
      } catch {
        /* canvas unavailable: the dark background is enough */
      }
    }
    setStage(1);
    const timer = window.setTimeout(() => setLeaving(true), REDUCED_INTRO_MS);
    skip.current = () => setLeaving(true);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (!leaving || !reduced) return;
    callbacks.current.onLeave();
    const timer = window.setTimeout(() => callbacks.current.onDone(), REDUCED_LIFT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, reduced]);

  // Full animation.
  useEffect(() => {
    if (reduced) return;
    const el = canvas.current;
    const host = root.current;
    if (!el || !host) return;
    let scene: Scene;
    try {
      scene = new Scene(el);
    } catch {
      // No canvas support: skip straight to the site.
      callbacks.current.onLeave();
      callbacks.current.onDone();
      return;
    }

    const resize = () => scene.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 1.5));
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    let last = performance.now();
    let raf = 0;
    let stageNow = 0;
    let revealT0 = -1;
    let finished = false;

    skip.current = () => {
      // Jump to just before the beam points at the viewer; the light then takes over quickly.
      if (t < T_FLASH - 0.9) t = T_FLASH - 0.9;
    };

    const frame = (now: number) => {
      if (finished) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;

      scene.draw(t);

      const wanted = t >= FLASH_UI_AT ? 2 : t >= TITLE_AT ? 1 : 0;
      if (wanted !== stageNow) {
        stageNow = wanted;
        setStage(wanted);
      }

      if (t >= T_WHITE) {
        if (revealT0 < 0) {
          revealT0 = now;
          callbacks.current.onLeave();
          setLeaving(true);
        }
        const k = Math.min(1, (now - revealT0) / REVEAL_MS);
        const lamp = scene.lamp(T_FLASH);
        const far = Math.hypot(window.innerWidth, window.innerHeight) * 1.1;
        const r = easeInOut(k) * far;
        const edge = far * 0.22;
        const mask = `radial-gradient(circle at ${lamp.x}px ${lamp.y}px, transparent ${r}px, #000 ${r + edge}px)`;
        host.style.maskImage = mask;
        host.style.setProperty('-webkit-mask-image', mask);
        if (k >= 1) {
          finished = true;
          callbacks.current.onDone();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        requestSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestSkip]);

  const cls = ['splash', stage >= 1 && 'has-title', stage >= 2 && 'is-flash', leaving && 'is-leaving', reduced && 'is-reduced'].filter(Boolean).join(' ');

  return (
    <div ref={root} className={cls} role="dialog" aria-modal="true" aria-label={`${name} intro`} onClick={requestSkip}>
      <canvas ref={canvas} className="splash-scene" aria-hidden />

      <div className="splash-ui">
        <h1 className="splash-title" aria-label={name}>
          {name.split('').map((ch, i) => (
            <span key={i} aria-hidden style={vars({ '--k': i })}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="splash-tag">Charting your course</p>
      </div>

      <button
        type="button"
        className="splash-skip"
        onClick={(e) => {
          e.stopPropagation();
          requestSkip();
        }}
      >
        Skip
      </button>
    </div>
  );
}
