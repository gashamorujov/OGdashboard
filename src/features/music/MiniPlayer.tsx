import { useEffect, useRef, useState } from 'react';
import { ListMusic, ListOrdered, Shuffle, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Loader2, TriangleAlert } from 'lucide-react';
import { IconButton } from '../../components/ui/Button';
import { usePlayer } from './PlayerContext';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/format';

export function MiniPlayer() {
  const p = usePlayer();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const title = p.current?.title ?? 'Music';
  const hasTracks = p.queue.length > 0;
  const VolIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;
  const pct = p.duration > 0 ? Math.min(100, (p.time / p.duration) * 100) : 0;

  return (
    <div ref={box} className="relative" role="group" aria-label="Music player">
      <div className="flex h-10 items-center gap-0.5 rounded-xl border border-line bg-surface pl-1 pr-1">
        <IconButton label="Previous track" size="sm" onClick={p.prev} disabled={!hasTracks}>
          <SkipBack className="h-4 w-4" aria-hidden />
        </IconButton>
        <IconButton label={p.playing ? 'Pause' : 'Play'} size="sm" onClick={p.toggle} className="text-fg">
          {p.loading && p.playing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : p.playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </IconButton>
        <IconButton label="Next track" size="sm" onClick={p.next} disabled={!hasTracks}>
          <SkipForward className="h-4 w-4" aria-hidden />
        </IconButton>
        <div className="mx-1.5 hidden w-36 min-w-0 md:block" aria-live="off">
          <p className="truncate text-xs font-medium leading-4">{title}</p>
          <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full bg-fg/80" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Active playlist ${p.activePlaylist}. Open player options`}
          className={cn('ml-0.5 flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-fg', open && 'bg-raised text-fg')}
        >
          <ListMusic className="h-4 w-4" aria-hidden />
          {p.activePlaylist}
        </button>
      </div>

      {open && (
        <div role="dialog" aria-label="Player options" className="anim-pop absolute right-0 top-12 z-40 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface p-3.5 shadow-pop">
          <p className="truncate text-sm font-medium">{title}</p>
          <div className="mt-3 flex items-center gap-2 text-xs tabular-nums text-muted">
            <span className="w-9">{formatTime(p.time)}</span>
            <input
              type="range"
              aria-label="Seek"
              className="min-w-0 flex-1"
              min={0}
              max={p.duration || 0}
              step={1}
              value={Math.min(p.time, p.duration || 0)}
              disabled={!p.duration}
              style={{ ['--pct' as string]: `${pct}%` }}
              onChange={(e) => p.seek(Number(e.target.value))}
            />
            <span className="w-9 text-right">{formatTime(p.duration || undefined)}</span>
          </div>
          <div role="radiogroup" aria-label="Play mode" className="mt-3 grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-bg p-0.5">
            {([
              ['ordered', 'In order', ListOrdered],
              ['random', 'Random', Shuffle],
            ] as const).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={p.mode === mode}
                onClick={() => p.setMode(mode)}
                className={cn('flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors', p.mode === mode ? 'bg-raised text-fg' : 'text-muted hover:text-fg')}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <IconButton label={p.muted ? 'Unmute' : 'Mute'} size="sm" onClick={p.toggleMute}>
              <VolIcon className="h-4 w-4" aria-hidden />
            </IconButton>
            <input
              type="range"
              aria-label="Volume"
              className="min-w-0 flex-1"
              min={0}
              max={1}
              step={0.05}
              value={p.muted ? 0 : p.volume}
              style={{ ['--pct' as string]: `${(p.muted ? 0 : p.volume) * 100}%` }}
              onChange={(e) => p.setVolume(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {p.notice && (
        <p role="status" className="absolute right-0 top-12 z-30 flex w-max max-w-[18rem] items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs text-muted shadow-pop" style={{ display: open ? 'none' : undefined }}>
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {p.notice}
        </p>
      )}
    </div>
  );
}
