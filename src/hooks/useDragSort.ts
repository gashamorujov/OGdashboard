import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface DragState {
  from: number;
  over: number;
  dy: number;
  height: number;
  dropping: boolean;
}

interface Options {
  listRef: RefObject<HTMLElement>;
  disabled?: boolean;
  onMove: (from: number, to: number) => void;
}

interface Session {
  from: number;
  startY: number;
  startScroll: number;
  scroller: HTMLElement | null;
  rects: Array<{ top: number; height: number }>;
  lastY: number;
  raf: number;
}

const EDGE = 72;
const DROP_MS = 190;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Pointer based sortable list (mouse, touch and pen). The row being dragged follows the pointer, the others slide out
 * of the way, the list auto-scrolls near its edges, Escape cancels and the row settles into its slot on release.
 */
export function useDragSort({ listRef, disabled, onMove }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const session = useRef<Session | null>(null);
  const move = useRef(onMove);
  move.current = onMove;

  const compute = useCallback((s: Session) => {
    const scrollNow = s.scroller ? s.scroller.scrollTop : window.scrollY;
    const r = s.rects[s.from];
    const first = s.rects[0];
    const last = s.rects[s.rects.length - 1];
    const raw = s.lastY - s.startY + (scrollNow - s.startScroll);
    const dy = Math.max(first.top - r.top, Math.min(last.top + last.height - (r.top + r.height), raw));
    const center = r.top + r.height / 2 + dy;
    let over = s.from;
    for (let i = 0; i < s.from; i++) {
      if (center < s.rects[i].top + s.rects[i].height / 2) {
        over = i;
        break;
      }
    }
    if (over === s.from) {
      for (let i = s.rects.length - 1; i > s.from; i--) {
        if (center > s.rects[i].top + s.rects[i].height / 2) {
          over = i;
          break;
        }
      }
    }
    return { dy, over };
  }, []);

  const loop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    if (s.scroller) {
      const box = s.scroller.getBoundingClientRect();
      if (s.lastY < box.top + EDGE) s.scroller.scrollTop -= Math.min(16, ((box.top + EDGE - s.lastY) / EDGE) * 16);
      else if (s.lastY > box.bottom - EDGE) s.scroller.scrollTop += Math.min(16, ((s.lastY - (box.bottom - EDGE)) / EDGE) * 16);
    }
    const { dy, over } = compute(s);
    setDrag((prev) => (prev && prev.dy === dy && prev.over === over ? prev : { from: s.from, over, dy, height: s.rects[s.from].height, dropping: false }));
    s.raf = requestAnimationFrame(loop);
  }, [compute]);

  const finish = useCallback(
    (commit: boolean) => {
      const s = session.current;
      if (!s) return;
      session.current = null;
      cancelAnimationFrame(s.raf);
      const { over } = compute(s);
      const target = commit ? over : s.from;
      const r = s.rects[s.from];
      const slot = s.rects[target];
      const dy = target > s.from ? slot.top + slot.height - (r.top + r.height) : slot.top - r.top;
      setDrag({ from: s.from, over: target, dy, height: r.height, dropping: true });
      window.setTimeout(() => {
        setDrag(null);
        if (commit && target !== s.from) move.current(s.from, target);
      }, DROP_MS);
    },
    [compute],
  );

  useEffect(() => {
    if (!drag || drag.dropping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag, finish]);

  useEffect(
    () => () => {
      if (session.current) cancelAnimationFrame(session.current.raf);
    },
    [],
  );

  const handleProps = (index: number) => ({
    style: { touchAction: 'none' } as CSSProperties,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || session.current || e.button !== 0) return;
      const list = listRef.current;
      if (!list) return;
      const rects = Array.from(list.children).map((c) => {
        const b = (c as HTMLElement).getBoundingClientRect();
        return { top: b.top, height: b.height };
      });
      if (!rects[index]) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const scroller = scrollParent(list);
      session.current = { from: index, startY: e.clientY, startScroll: scroller ? scroller.scrollTop : window.scrollY, scroller, rects, lastY: e.clientY, raf: 0 };
      session.current.raf = requestAnimationFrame(loop);
      setDrag({ from: index, over: index, dy: 0, height: rects[index].height, dropping: false });
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (session.current) session.current.lastY = e.clientY;
    },
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
  });

  const rowStyle = (index: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    const { from, over, dy, height, dropping } = drag;
    if (index === from) {
      return { transform: `translate3d(0, ${dy}px, 0)`, transition: dropping ? `transform ${DROP_MS}ms ${EASE}` : 'none', position: 'relative', zIndex: 20 };
    }
    let shift = 0;
    if (from < over && index > from && index <= over) shift = -height;
    else if (from > over && index >= over && index < from) shift = height;
    return { transform: `translate3d(0, ${shift}px, 0)`, transition: `transform 220ms ${EASE}` };
  };

  return { drag, handleProps, rowStyle };
}
