export type PlaylistId = 1 | 2 | 3;
export const PLAYLIST_IDS: readonly PlaylistId[] = [1, 2, 3];

export interface LogoCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface Website {
  id: string;
  name: string;
  url: string;
  logoUrl?: string;
  logoPublicId?: string;
  logoCrop?: LogoCrop;
  /** Manual position set by drag and drop in admin. */
  order?: number;
  createdAt: number;
}

export interface Track {
  id: string;
  playlist: PlaylistId;
  title: string;
  url: string;
  publicId?: string;
  duration?: number;
  order: number;
  createdAt: number;
}

export type TracksByPlaylist = Record<PlaylistId, Track[]>;

export interface UploadResult {
  secureUrl: string;
  publicId: string;
  duration?: number;
}
