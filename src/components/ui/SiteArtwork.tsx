import { useEffect, useState, type ReactNode } from 'react';
import { Globe } from 'lucide-react';
import type { LogoCrop } from '../../types';
import { clampLogoCrop } from '../../utils/logoCrop';

interface Props {
  src?: string;
  crop?: LogoCrop;
  className?: string;
  fallback?: ReactNode;
}

export function SiteArtwork({ src, crop, className = '', fallback }: Props) {
  const [failed, setFailed] = useState(false);
  const framing = clampLogoCrop(crop);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className}`}>
        {fallback ?? <Globe className="h-16 w-16 text-muted" aria-hidden />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`h-full w-full object-cover ${className}`}
      style={{
        objectPosition: `${framing.x}% ${framing.y}%`,
        transform: framing.zoom > 1 ? `scale(${framing.zoom})` : undefined,
        transformOrigin: `${framing.x}% ${framing.y}%`,
      }}
      onError={() => setFailed(true)}
    />
  );
}
