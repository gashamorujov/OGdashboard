import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type CSSProperties, type KeyboardEvent } from 'react';
import { AlertCircle, FileAudio, GripVertical, Music, Play, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useData } from '../../app/DataContext';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { CLOUDINARY, UPLOAD_RULES, probeAudioDuration, uploadToCloudinary, validateFile } from '../../lib/cloudinary';
import { useDragSort } from '../../hooks/useDragSort';
import { addTrack, removeTrack, renameTrack, replaceTrackFile, saveOrder } from '../../services/tracks';
import { PLAYLIST_IDS, type PlaylistId, type Track } from '../../types';
import { cn } from '../../utils/cn';
import { errorMessage } from '../../utils/dom';
import { formatBytes, formatTime, titleFromFilename } from '../../utils/format';
import { usePlayer } from './PlayerContext';

interface QueueItem {
  key: string;
  file: File;
  playlist: PlaylistId;
  status: 'queued' | 'uploading' | 'saving' | 'error';
  progress: number;
  error?: string;
}

export function MusicAdmin() {
  const { tracks } = useData();
  const player = usePlayer();
  const toast = useToast();
  const [tab, setTab] = useState<PlaylistId>(1);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [removing, setRemoving] = useState<Track | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{ playlist: PlaylistId; ids: string[] } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(new Set<string>());
  const nextOrder = useRef<Record<number, number>>({});
  const cancels = useRef(new Map<string, () => void>());
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    const map = cancels.current;
    return () => map.forEach((c) => c());
  }, []);

  const patch = useCallback((key: string, p: Partial<QueueItem>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...p } : i))), []);

  const process = useCallback(
    async (item: QueueItem) => {
      if (running.current.has(item.key)) return;
      running.current.add(item.key);
      try {
        patch(item.key, { status: 'uploading', progress: 0, error: undefined });
        const handle = uploadToCloudinary(item.file, 'audio', CLOUDINARY.folders.playlist(item.playlist), (progress) => patch(item.key, { progress }));
        cancels.current.set(item.key, handle.cancel);
        const result = await handle.promise;
        cancels.current.delete(item.key);
        patch(item.key, { status: 'saving', progress: 100 });
        const duration = result.duration ?? (await probeAudioDuration(item.file));
        const list = tracksRef.current[item.playlist];
        const base = Math.max(nextOrder.current[item.playlist] ?? 0, list.length ? list[list.length - 1].order + 1 : 0);
        nextOrder.current[item.playlist] = base + 1;
        await addTrack(item.playlist, { title: titleFromFilename(item.file.name), url: result.secureUrl, publicId: result.publicId, duration }, base);
        setQueue((q) => q.filter((i) => i.key !== item.key));
      } catch (e) {
        cancels.current.delete(item.key);
        patch(item.key, { status: 'error', error: errorMessage(e, 'Upload failed.') });
      } finally {
        running.current.delete(item.key);
      }
    },
    [patch],
  );

  // Upload sequentially so track order stays deterministic.
  useEffect(() => {
    if (running.current.size > 0) return;
    const next = queue.find((i) => i.status === 'queued');
    if (next) void process(next);
  }, [queue, process]);

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const accepted: QueueItem[] = [];
    for (const file of files) {
      const problem = validateFile(file, 'audio');
      if (problem) toast.error(`${file.name}: ${problem}`);
      else accepted.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, playlist: tab, status: 'queued', progress: 0 });
    }
    if (accepted.length) setQueue((q) => [...q, ...accepted]);
  };

  // Optimistic order while a new order is being saved, so the list never jumps back.
  const list = useMemo(() => {
    const base = tracks[tab];
    if (!pendingOrder || pendingOrder.playlist !== tab) return base;
    const byId = new Map(base.map((t) => [t.id, t]));
    const out = pendingOrder.ids.map((id) => byId.get(id)).filter((t): t is Track => !!t);
    for (const t of base) if (!pendingOrder.ids.includes(t.id)) out.push(t);
    return out;
  }, [tracks, tab, pendingOrder]);

  /** Moves one track and saves the whole order: the first track of the list is the one that plays first. */
  const moveTrack = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= list.length) return;
    const ids = list.map((t) => t.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setPendingOrder({ playlist: tab, ids });
    try {
      await saveOrder(tab, ids);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the new order.'));
    } finally {
      setPendingOrder(null);
    }
  };

  const { drag, handleProps, rowStyle } = useDragSort({ listRef, onMove: (from, to) => void moveTrack(from, to) });

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, index: number, id: string) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    void moveTrack(index, index + (e.key === 'ArrowUp' ? -1 : 1));
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-handle="${CSS.escape(id)}"]`)?.focus());
  };

  const pending = queue.filter((i) => i.playlist === tab);

  return (
    <section aria-label="Music" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Playlists" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {PLAYLIST_IDS.map((id) => (
            <button
              key={id}
              role="tab"
              id={`pl-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="pl-panel"
              type="button"
              onClick={() => setTab(id)}
              className={cn('h-8 min-w-[2.75rem] rounded-md px-3 text-sm font-medium transition-colors', tab === id ? 'bg-raised text-fg' : 'text-muted hover:text-fg')}
            >
              {id}
              <span className="ml-1.5 text-xs text-muted">{tracks[id].length}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" className="ml-auto" icon={<Upload className="h-4 w-4" aria-hidden />} onClick={() => input.current?.click()}>
          Upload MP3
        </Button>
        <input ref={input} type="file" multiple className="hidden" accept=".mp3,audio/mpeg" onChange={onFiles} aria-label={`Upload MP3 files to playlist ${tab}`} />
      </div>
      <p className="text-xs text-muted">{UPLOAD_RULES.audio.label}. Select several files to upload them one after another.</p>
      {list.length > 1 && <p className="text-xs text-muted">Drag the handle to change the order. The first track plays first (listeners can also choose random).</p>}

      <div role="tabpanel" id="pl-panel" aria-labelledby={`pl-tab-${tab}`} className="space-y-3">
        {pending.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-label="Uploads">
            {pending.map((i) => (
              <li key={i.key} className="flex items-center gap-3 px-3.5 py-2.5">
                {i.status === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden /> : <FileAudio className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.file.name}</p>
                  {i.status === 'error' ? (
                    <p className="text-xs text-danger" role="alert">{i.error}</p>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Upload progress for ${i.file.name}`}>
                        <div className="h-full bg-fg transition-[width]" style={{ width: `${i.progress}%` }} />
                      </div>
                      <span className="w-24 text-right text-xs tabular-nums text-muted">
                        {i.status === 'queued' ? 'Waiting' : i.status === 'saving' ? 'Saving' : `${i.progress}%`} · {formatBytes(i.file.size)}
                      </span>
                    </div>
                  )}
                </div>
                {i.status === 'error' && (
                  <IconButton label={`Retry ${i.file.name}`} size="sm" onClick={() => patch(i.key, { status: 'queued' })}>
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  </IconButton>
                )}
                <IconButton
                  label={i.status === 'error' || i.status === 'queued' ? `Dismiss ${i.file.name}` : `Cancel ${i.file.name}`}
                  size="sm"
                  onClick={() => {
                    cancels.current.get(i.key)?.();
                    setQueue((q) => q.filter((x) => x.key !== i.key));
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        {list.length === 0 && pending.length === 0 ? (
          <EmptyState icon={<Music className="h-8 w-8" aria-hidden />} title="No tracks" action={<Button onClick={() => input.current?.click()}>Upload MP3</Button>} />
        ) : (
          <ul ref={listRef} className={cn('divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface', drag && 'cursor-grabbing select-none')}>
            {list.map((t, index) => (
              <TrackRow
                key={t.id}
                track={t}
                index={index}
                style={rowStyle(index)}
                dragging={drag?.from === index}
                handle={{ ...handleProps(index), onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onHandleKey(e, index, t.id) }}
                playing={player.current?.id === t.id && player.playing}
                onPreview={() => player.playTrack(t)}
                onRemove={() => setRemoving(t)}
              />
            ))}
          </ul>
        )}
      </div>

      {removing && (
        <ConfirmDialog
          title="Remove track"
          message={`Remove "${removing.title}" from playlist ${removing.playlist}? The audio file stays in Cloudinary and can be deleted from its media library.`}
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await removeTrack(removing.playlist, removing.id);
              toast.success('Track removed');
            } catch (e) {
              toast.error(errorMessage(e, 'Could not remove the track.'));
              throw e;
            }
          }}
        />
      )}
    </section>
  );
}

interface RowProps {
  track: Track;
  index: number;
  style?: CSSProperties;
  dragging: boolean;
  handle: ButtonHTMLAttributes<HTMLButtonElement>;
  playing: boolean;
  onPreview: () => void;
  onRemove: () => void;
}

function TrackRow({ track, index, style, dragging, handle, playing, onPreview, onRemove }: RowProps) {
  const toast = useToast();
  const [title, setTitle] = useState(track.title);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(track.title), [track.title]);

  const commit = async () => {
    const next = title.trim();
    if (next === track.title) return;
    if (!next || next.length > 120) {
      toast.error('Title must be 1 to 120 characters.');
      setTitle(track.title);
      return;
    }
    setSaving(true);
    try {
      await renameTrack(track.playlist, track.id, next);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not rename the track.'));
      setTitle(track.title);
    } finally {
      setSaving(false);
    }
  };

  const replace = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problem = validateFile(f, 'audio');
    if (problem) {
      toast.error(problem);
      return;
    }
    setReplacing(0);
    try {
      const res = await uploadToCloudinary(f, 'audio', CLOUDINARY.folders.playlist(track.playlist), setReplacing).promise;
      const duration = res.duration ?? (await probeAudioDuration(f));
      await replaceTrackFile(track.playlist, track.id, { url: res.secureUrl, publicId: res.publicId, duration });
      toast.success('File replaced');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not replace the file.'));
    } finally {
      setReplacing(null);
    }
  };

  return (
    <li style={style} className={cn('flex items-center gap-2 bg-surface px-2 py-2.5 pr-3', dragging && 'bg-raised ring-1 ring-inset ring-accent/50')}>
      <button
        type="button"
        data-handle={track.id}
        aria-label={`Reorder ${track.title}. Drag, or press arrow up or down.`}
        title="Drag to reorder"
        {...handle}
        className={cn('flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg', dragging ? 'cursor-grabbing text-fg' : 'cursor-grab')}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <input
          className="field h-8 border-transparent bg-transparent px-2 py-0 hover:border-line"
          aria-label={`Title of track ${index + 1}`}
          value={title}
          maxLength={120}
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setTitle(track.title);
              e.currentTarget.blur();
            }
          }}
        />
        {replacing !== null && <p className="px-2 pt-0.5 text-xs text-muted">Replacing file {replacing}%</p>}
      </div>
      <span className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-muted sm:block">{formatTime(track.duration)}</span>
      <IconButton label={`Preview ${track.title}`} size="sm" onClick={onPreview} active={playing}>
        <Play className="h-4 w-4" aria-hidden />
      </IconButton>
      <IconButton label={`Replace file for ${track.title}`} size="sm" disabled={replacing !== null} onClick={() => file.current?.click()}>
        <RefreshCw className="h-4 w-4" aria-hidden />
      </IconButton>
      <IconButton label={`Remove ${track.title}`} size="sm" onClick={onRemove} className="hover:text-danger">
        <Trash2 className="h-4 w-4" aria-hidden />
      </IconButton>
      <input ref={file} type="file" className="hidden" accept=".mp3,audio/mpeg" onChange={replace} aria-label={`Replacement file for ${track.title}`} />
    </li>
  );
}
