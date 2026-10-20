import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface ActivePress {
  pointerId: number;
  x: number;
  y: number;
}

/** Trigger once after one pointer is held in place for the requested duration. */
export function useLongPress(onTrigger: () => void, durationMs: number, touchDurationMs = durationMs) {
  const timer = useRef<number | null>(null);
  const active = useRef<ActivePress | null>(null);
  const trigger = useRef(onTrigger);
  trigger.current = onTrigger;

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    active.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if ((event.pointerType === 'mouse' && event.button !== 0) || active.current) return;
      event.preventDefault();
      active.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      const holdDurationMs = event.pointerType === 'mouse' ? durationMs : touchDurationMs;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        active.current = null;
        trigger.current();
      }, holdDurationMs);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is a convenience; the pointer handlers still cancel normally without it.
      }
    },
    [durationMs, touchDurationMs],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const press = active.current;
      if (!press || press.pointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - press.x) > 14 || Math.abs(event.clientY - press.y) > 14) cancel();
    },
    [cancel],
  );

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (active.current?.pointerId === event.pointerId) cancel();
    },
    [cancel],
  );

  const onContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(), []);

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onContextMenu };
}
