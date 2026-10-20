import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { isSafeHttpUrl } from '../utils/url';
import { clampLogoCrop } from '../utils/logoCrop';
import { PLAYLIST_IDS, type PlaylistId, type Track, type TracksByPlaylist, type Website } from '../types';

interface DataState {
  websites: Website[];
  tracks: TracksByPlaylist;
  loading: boolean;
  error: string | null;
}

const empty: TracksByPlaylist = { 1: [], 2: [], 3: [] };
const Ctx = createContext<DataState>({ websites: [], tracks: empty, loading: true, error: null });
export const useData = () => useContext(Ctx);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

function parseWebsites(val: unknown): Website[] {
  if (!isObj(val)) return [];
  const out: Website[] = [];
  for (const [key, raw] of Object.entries(val)) {
    if (!isObj(raw)) continue;
    const name = str(raw.name, 80);
    if (!name || !isSafeHttpUrl(raw.url)) continue;
    const cropRaw = isObj(raw.logoCrop) ? raw.logoCrop : null;
    out.push({
      id: key,
      name,
      url: raw.url,
      logoUrl: isSafeHttpUrl(raw.logoUrl) ? raw.logoUrl : undefined,
      logoPublicId: str(raw.logoPublicId, 300) ?? undefined,
      logoCrop: cropRaw
        ? clampLogoCrop({
            x: typeof cropRaw.x === 'number' ? cropRaw.x : undefined,
            y: typeof cropRaw.y === 'number' ? cropRaw.y : undefined,
            zoom: typeof cropRaw.zoom === 'number' ? cropRaw.zoom : undefined,
          })
        : undefined,
      order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : undefined,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    });
  }
  return out;
}

function parseTracks(playlist: PlaylistId, val: unknown): Track[] {
  if (!isObj(val)) return [];
  const out: Track[] = [];
  for (const [key, raw] of Object.entries(val)) {
    if (!isObj(raw)) continue;
    const title = str(raw.title, 120);
    if (!title || !isSafeHttpUrl(raw.url)) continue;
    out.push({
      id: key,
      playlist,
      title,
      url: raw.url,
      publicId: str(raw.publicId, 300) ?? undefined,
      duration: typeof raw.duration === 'number' ? raw.duration : undefined,
      order: typeof raw.order === 'number' ? raw.order : 0,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    });
  }
  return out.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

function describeError(e: Error): string {
  return /permission/i.test(e.message)
    ? 'Permission denied. Check the Realtime Database rules.'
    : 'Could not load data. Check your connection.';
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [tracks, setTracks] = useState<TracksByPlaylist>(empty);
  const [ready, setReady] = useState({ sites: false, lists: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const offSites = onValue(
      ref(db, 'websites'),
      (s) => {
        setWebsites(parseWebsites(s.val()));
        setReady((r) => ({ ...r, sites: true }));
        setError(null);
      },
      (e) => {
        setError(describeError(e));
        setReady((r) => ({ ...r, sites: true }));
      },
    );
    const offLists = onValue(
      ref(db, 'playlists'),
      (s) => {
        const val = s.val();
        const next: TracksByPlaylist = { 1: [], 2: [], 3: [] };
        for (const id of PLAYLIST_IDS) next[id] = parseTracks(id, isObj(val) && isObj(val[String(id)]) ? (val[String(id)] as Record<string, unknown>).tracks : null);
        setTracks(next);
        setReady((r) => ({ ...r, lists: true }));
      },
      (e) => {
        setError(describeError(e));
        setReady((r) => ({ ...r, lists: true }));
      },
    );
    return () => {
      offSites();
      offLists();
    };
  }, []);

  const value = useMemo<DataState>(
    () => ({ websites, tracks, loading: !(ready.sites && ready.lists), error }),
    [websites, tracks, ready, error],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
