import { useEffect, useRef } from 'react';
import { SiteArtwork } from '../../components/ui/SiteArtwork';
import type { Website } from '../../types';

interface Props {
  site: Website;
  index: number;
  onOpen: (site: Website) => void;
}

interface Pose {
  nx: number; // pointer position across the card, -1 (left) to 1 (right)
  ny: number; // -1 (top) to 1 (bottom)
  lift: number; // 0 idle, 1 fully hovered
}

const EASE = 0.14;

/**
 * Card that reacts to the pointer in real time: it tilts in 3D toward the cursor, the artwork drifts in
 * parallax, a soft spotlight and rim light follow the cursor, and everything eases back when it leaves.
 * Values are smoothed in a requestAnimationFrame loop and written as CSS variables (no React re-renders).
 */
export function SiteCard({ site, index, onOpen }: Props) {
  const card = useRef<HTMLButtonElement>(null);
  const now = useRef<Pose>({ nx: 0, ny: 0, lift: 0 });
  const goal = useRef<Pose>({ nx: 0, ny: 0, lift: 0 });
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const paint = () => {
    const el = card.current;
    if (!el) return;
    const c = now.current;
    const g = goal.current;
    c.nx += (g.nx - c.nx) * EASE;
    c.ny += (g.ny - c.ny) * EASE;
    c.lift += (g.lift - c.lift) * (g.lift > c.lift ? 0.16 : 0.1);
    el.style.setProperty('--nx', c.nx.toFixed(4));
    el.style.setProperty('--ny', c.ny.toFixed(4));
    el.style.setProperty('--lift', c.lift.toFixed(4));
    el.style.setProperty('--mx', `${((c.nx + 1) * 50).toFixed(2)}%`);
    el.style.setProperty('--my', `${((c.ny + 1) * 50).toFixed(2)}%`);
    const settled = Math.abs(g.nx - c.nx) + Math.abs(g.ny - c.ny) + Math.abs(g.lift - c.lift) < 0.002;
    if (settled) {
      raf.current = 0;
      if (g.lift === 0) el.removeAttribute('data-live');
    } else {
      raf.current = requestAnimationFrame(paint);
    }
  };

  const run = () => {
    if (!raf.current) raf.current = requestAnimationFrame(paint);
  };

  const track = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || reduced()) return;
    const el = card.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    goal.current = {
      nx: Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)),
      ny: Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)),
      lift: 1,
    };
    el.setAttribute('data-live', '');
    run();
  };

  const release = () => {
    goal.current = { nx: 0, ny: 0, lift: 0 };
    run();
  };

  return (
    <li className="site-item" style={{ ['--i' as string]: Math.min(index, 14) }}>
      <button
        ref={card}
        type="button"
        onClick={() => onOpen(site)}
        onPointerEnter={track}
        onPointerMove={track}
        onPointerLeave={release}
        onPointerCancel={release}
        onBlur={release}
        aria-label={`Open ${site.name}`}
        title={site.name}
        className="site-card relative flex w-full flex-col overflow-hidden rounded-3xl border border-line bg-surface text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="relative flex aspect-[9/5] w-full items-center justify-center overflow-hidden bg-raised/50">
          <span className="site-art absolute inset-0 block">
            <SiteArtwork src={site.logoUrl} crop={site.logoCrop} />
          </span>
          <span className="site-veil" aria-hidden />
        </span>
        <span className="site-title flex h-[54px] w-full shrink-0 items-center justify-center border-t border-line px-3.5 text-center text-sm font-semibold uppercase leading-5 tracking-[0.1em] text-fg">
          <span className="site-name w-full truncate">{site.name}</span>
        </span>
      </button>
    </li>
  );
}
