import type { UploadResult } from '../types';

/** Centralized Cloudinary configuration. Only the unsigned preset is used; no API secret exists in the frontend. */
export const CLOUDINARY = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'djyfwp5yr',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'Orujov_Presents',
  folders: {
    logos: 'site-dashboard/logos',
    playlist: (n: number) => `site-dashboard/playlist-${n}`,
  },
} as const;

export const UPLOAD_RULES = {
  image: {
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
    exts: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'],
    maxBytes: 3 * 1024 * 1024,
    label: 'PNG, JPG, WEBP, SVG or GIF up to 3 MB',
  },
  audio: {
    mimes: ['audio/mpeg', 'audio/mp3'],
    exts: ['mp3'],
    maxBytes: 30 * 1024 * 1024,
    label: 'MP3 up to 30 MB',
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_RULES;

export function validateFile(file: File, kind: UploadKind): string | null {
  const rules = UPLOAD_RULES[kind];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(rules.exts as readonly string[]).includes(ext)) return `Unsupported file type. Use ${rules.label}.`;
  if (file.type && !(rules.mimes as readonly string[]).includes(file.type)) return `Unsupported file type. Use ${rules.label}.`;
  if (file.size === 0) return 'File is empty.';
  if (file.size > rules.maxBytes) return `File is too large. ${rules.label}.`;
  return null;
}

export interface UploadHandle {
  promise: Promise<UploadResult>;
  cancel: () => void;
}

/** Uploads to Cloudinary with progress. Audio uses the "video" resource type, as Cloudinary does. */
export function uploadToCloudinary(
  file: File,
  kind: UploadKind,
  folder: string,
  onProgress?: (percent: number) => void,
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadResult>((resolve, reject) => {
    const invalid = validateFile(file, kind);
    if (invalid) {
      reject(new Error(invalid));
      return;
    }
    const resource = kind === 'image' ? 'image' : 'video';
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', CLOUDINARY.uploadPreset);
    body.append('folder', folder);

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/${resource}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.timeout = 10 * 60_000;
    xhr.onload = () => {
      let json: { secure_url?: string; public_id?: string; duration?: number; error?: { message?: string } } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.secure_url && json.public_id) {
        onProgress?.(100);
        resolve({ secureUrl: json.secure_url, publicId: json.public_id, duration: typeof json.duration === 'number' ? Math.round(json.duration) : undefined });
      } else {
        reject(new Error(json.error?.message || `Upload failed (${xhr.status}).`));
      }
    };
    xhr.send(body);
  });
  return { promise, cancel: () => xhr.abort() };
}

/** Reads audio duration in the browser as a fallback when Cloudinary does not return one. */
export function probeAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    let finished = false;
    const done = (v?: number) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(v);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration) : undefined);
    a.onerror = () => done(undefined);
    setTimeout(() => done(undefined), 5000);
    a.src = url;
  });
}
