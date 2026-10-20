import type { LogoCrop } from '../types';

export const DEFAULT_LOGO_CROP: LogoCrop = { x: 50, y: 50, zoom: 1 };

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
};

export function clampLogoCrop(value?: Partial<LogoCrop> | null): LogoCrop {
  return {
    x: clamp(value?.x, 0, 100, DEFAULT_LOGO_CROP.x),
    y: clamp(value?.y, 0, 100, DEFAULT_LOGO_CROP.y),
    zoom: clamp(value?.zoom, 1, 3, DEFAULT_LOGO_CROP.zoom),
  };
}
