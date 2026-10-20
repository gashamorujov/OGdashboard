import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useData } from '../../app/DataContext';
import { getAudio } from '../../lib/audio';
import { PLAYER_STORAGE_KEY } from '../../lib/config';
import type { PlaylistId, Track } from '../../types';

const DEFAULT_PLAYLIST: PlaylistId = 3;

export type PlayMode = 'ordered' | 'random';

interface Prefs { volume: number; muted: boolean; mode: PlayMode }

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY) ?? '{}') as Partial<Prefs>;
    const volume = typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : 0.8;
    return { volume, muted: raw.muted === true, mode: raw.mode === 'random' ? 'random' : 'ordered' };
  } catch {
    return { volume: 0.8, muted: false, mode: 'ordered' };
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

interface SelectOptions { play?: boolean; random?: boolean; trackId?: string }

export interface PlayerApi {
  activePlaylist: PlaylistId;
  queue: Track[];
  current: Track | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  mode: PlayMode;
  notice: string | null;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setMode: (mode: PlayMode) => void;
  selectPlaylist: (id: PlaylistId, opts?: SelectOptions) => void;
  playTrack: (track: Track) => void;
}

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlayer must be used inside PlayerProvider');
  return v;
}

function pickRandom(queue: Track[], excludeId: string | null): Track {
  const pool = queue.length > 1 ? queue.filter((t) => t.id !== excludeId) : queue;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { tracks } = useData();
  const [active, setActive] = useState<PlaylistId>(DEFAULT_PLAYLIST);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  const queue = tracks[active];
  const current = useMemo(() => queue.find((t) => t.id === currentId) ?? null, [queue, currentId]);

  // Latest values for event handlers that outlive a render.
  const live = useRef({ active, queue, currentId, tracks, mode: prefs.mode });
  live.current = { active, queue, currentId, tracks, mode: prefs.mode };
  const loaded = useRef<{ id: string; url: string } | null>(null);
  const history = useRef<string[]>([]);
  /** False until playback has been requested once; until then an in-order player always waits on the first track. */
  const started = useRef(false);

  const start = useCallback(async () => {
    started.current = true;
    const a = getAudio();
    try {
      await a.play();
      setNotice(null);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError') setNotice('Playback was blocked by the browser. Press Play to start.');
      else if (name !== 'AbortError') setNotice('This track could not be played.');
      setPlaying(false);
    }
  }, []);

  const load = useCallback((t: Track) => {
    const a = getAudio();
    a.pause();
    a.src = t.url;
    loaded.current = { id: t.id, url: t.url };
    setCurrentId(t.id);
    setTime(0);
    setDuration(t.duration ?? 0);
    setNotice(null);
    setLoading(true);
    a.load();
  }, []);

  const clear = useCallback((message: string | null) => {
    const a = getAudio();
    a.pause();
    a.removeAttribute('src');
    a.load();
    loaded.current = null;
    setCurrentId(null);
    setPlaying(false);
    setLoading(false);
    setTime(0);
    setDuration(0);
    setNotice(message);
  }, []);

  const playTrack = useCallback(
    (t: Track) => {
      history.current = [];
      setActive(t.playlist);
      live.current = { ...live.current, active: t.playlist, queue: live.current.tracks[t.playlist], currentId: t.id };
      load(t);
      void start();
    },
    [load, start],
  );

  const selectPlaylist = useCallback(
    (id: PlaylistId, opts: SelectOptions = {}) => {
      const a = getAudio();
      a.pause();
      history.current = [];
      const q = live.current.tracks[id];
      setActive(id);
      live.current = { ...live.current, active: id, queue: q };
      if (!q.length) {
        clear(null);
        return;
      }
      const t = opts.trackId ? q.find((x) => x.id === opts.trackId) ?? q[0] : live.current.mode === 'random' ? pickRandom(q, null) : q[0];
      load(t);
      if (opts.play) void start();
    },
    [clear, load, start],
  );

  const next = useCallback(() => {
    const { queue: q, currentId: cid, mode } = live.current;
    if (!q.length) return;
    let target: Track;
    if (mode === 'random') {
      target = pickRandom(q, cid);
    } else {
      // In order: the next track in the playlist, wrapping to the first after the last.
      const at = q.findIndex((t) => t.id === cid);
      target = q[(at + 1) % q.length];
    }
    if (cid) history.current.push(cid);
    load(target);
    void start();
  }, [load, start]);

  const prev = useCallback(() => {
    const a = getAudio();
    const { queue: q, mode, currentId: cid } = live.current;
    if (!q.length) return;
    if (a.currentTime > 3 || q.length === 1) {
      a.currentTime = 0;
      return;
    }
    let target: Track | undefined;
    if (mode === 'ordered') {
      const at = q.findIndex((t) => t.id === cid);
      if (at > 0) target = q[at - 1];
      if (!target) {
        a.currentTime = 0;
        return;
      }
      history.current = [];
      load(target);
      void start();
      return;
    }
    while (history.current.length && !target) {
      const id = history.current.pop();
      target = q.find((t) => t.id === id);
    }
    if (!target) {
      a.currentTime = 0;
      return;
    }
    load(target);
    void start();
  }, [load, start]);

  const toggle = useCallback(() => {
    const a = getAudio();
    const { queue: q } = live.current;
    const cur = q.find((t) => t.id === live.current.currentId);
    if (!cur) {
      if (q.length) {
        load(live.current.mode === 'random' ? pickRandom(q, null) : q[0]);
        void start();
      }
      return;
    }
    if (loaded.current?.id !== cur.id) load(cur);
    if (a.paused) void start();
    else a.pause();
  }, [load, start]);

  const seek = useCallback((s: number) => {
    const a = getAudio();
    if (Number.isFinite(s)) a.currentTime = Math.max(0, s);
  }, []);

  const setVolume = useCallback((v: number) => setPrefs((p) => ({ ...p, volume: Math.min(1, Math.max(0, v)), muted: v === 0 ? p.muted : false })), []);
  const setMode = useCallback((mode: PlayMode) => {
    history.current = [];
    setPrefs((p) => ({ ...p, mode }));
  }, []);
  const toggleMute = useCallback(() => setPrefs((p) => ({ ...p, muted: !p.muted })), []);

  useEffect(() => {
    const a = getAudio();
    a.volume = prefs.volume;
    a.muted = prefs.muted;
    savePrefs(prefs);
  }, [prefs]);

  // Audio element events (single set of listeners).
  useEffect(() => {
    const a = getAudio();
    const on = <K extends keyof HTMLMediaElementEventMap>(type: K, fn: () => void) => {
      a.addEventListener(type, fn);
      return () => a.removeEventListener(type, fn);
    };
    const offs = [
      on('timeupdate', () => setTime(a.currentTime)),
      on('durationchange', () => Number.isFinite(a.duration) && setDuration(a.duration)),
      on('loadedmetadata', () => setLoading(false)),
      on('canplay', () => setLoading(false)),
      on('playing', () => {
        setLoading(false);
        setPlaying(true);
      }),
      on('play', () => setPlaying(true)),
      on('pause', () => setPlaying(false)),
      on('waiting', () => setLoading(true)),
      on('ended', () => {
        setPlaying(false);
        next();
      }),
      on('error', () => {
        if (!a.getAttribute('src')) return;
        setLoading(false);
        setPlaying(false);
        setNotice('This track is unavailable.');
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      a.pause();
    };
  }, [next]);

  // Keep the audio element and queue in sync with realtime database changes.
  useEffect(() => {
    const a = getAudio();
    if (!started.current && live.current.mode === 'ordered' && queue.length && currentId !== queue[0].id) {
      load(queue[0]);
      return;
    }
    if (currentId) {
      const cur = queue.find((t) => t.id === currentId);
      if (cur) {
        if (loaded.current?.id === cur.id && loaded.current.url !== cur.url) {
          const wasPlaying = !a.paused;
          load(cur);
          if (wasPlaying) void start();
        }
        return;
      }
    }
    // No valid current track: prepare the first one (paused) or clear.
    if (queue.length) load(live.current.mode === 'random' ? pickRandom(queue, null) : queue[0]);
    else if (currentId || loaded.current) clear(null);
  }, [queue, currentId, load, start, clear]);

  const value = useMemo<PlayerApi>(
    () => ({
      activePlaylist: active, queue, current, playing, loading, time, duration,
      volume: prefs.volume, muted: prefs.muted, mode: prefs.mode, notice,
      toggle, next, prev, seek, setVolume, toggleMute, setMode, selectPlaylist, playTrack,
    }),
    [active, queue, current, playing, loading, time, duration, prefs, notice, toggle, next, prev, seek, setVolume, toggleMute, setMode, selectPlaylist, playTrack],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
