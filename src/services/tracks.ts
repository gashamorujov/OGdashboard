import { push, ref, remove, set, update } from 'firebase/database';
import { db } from '../lib/firebase';
import type { PlaylistId, Track } from '../types';

export interface NewTrack {
  title: string;
  url: string;
  publicId?: string;
  duration?: number;
}

export async function addTrack(playlist: PlaylistId, input: NewTrack, order: number): Promise<string> {
  const node = push(ref(db, `playlists/${playlist}/tracks`));
  const id = node.key;
  if (!id) throw new Error('Could not allocate an id.');
  const track: Track = { id, playlist, title: input.title, url: input.url, order, createdAt: Date.now() };
  if (input.publicId) track.publicId = input.publicId;
  if (input.duration !== undefined) track.duration = input.duration;
  await set(node, track);
  return id;
}

export const renameTrack = (playlist: PlaylistId, id: string, title: string) =>
  update(ref(db, `playlists/${playlist}/tracks/${id}`), { title });

export const replaceTrackFile = (playlist: PlaylistId, id: string, file: Required<Pick<NewTrack, 'url' | 'publicId'>> & { duration?: number }) =>
  update(ref(db, `playlists/${playlist}/tracks/${id}`), {
    url: file.url,
    publicId: file.publicId,
    duration: file.duration ?? null,
  });

export const removeTrack = (playlist: PlaylistId, id: string) => remove(ref(db, `playlists/${playlist}/tracks/${id}`));

export async function saveOrder(playlist: PlaylistId, orderedIds: string[]): Promise<void> {
  const patch: Record<string, number> = {};
  orderedIds.forEach((id, i) => {
    patch[`playlists/${playlist}/tracks/${id}/order`] = i;
  });
  await update(ref(db), patch);
}
