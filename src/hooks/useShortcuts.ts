import { useEffect, useRef } from 'react';
import { isEditableTarget } from '../utils/dom';
import type { PlaylistId } from '../types';

interface Handlers {
  onAdmin: () => void;
  onPlaylist: (id: PlaylistId) => void;
}

/**
 * Global keyboard shortcuts, matched on physical key codes where possible so they survive layouts.
 *   Ctrl+Q            admin sign-in
 *   Alt+1 / 2 / 3     playlist 1 / 2 / 3 (random track, playback starts)
 */
export function useShortcuts(handlers: Handlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      if (isEditableTarget(e.target)) return;
      const { onAdmin, onPlaylist } = ref.current;
      const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;

      if (ctrl && !e.shiftKey && e.code === 'KeyQ') {
        e.preventDefault();
        onAdmin();
      } else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const m = /^(?:Digit|Numpad)([123])$/.exec(e.code);
        if (m) {
          e.preventDefault();
          const id = Number(m[1]) as PlaylistId;
          onPlaylist(id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
