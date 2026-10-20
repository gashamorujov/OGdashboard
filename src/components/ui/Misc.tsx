import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg bg-raised', className)} aria-hidden />
);

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('h-5 w-5 animate-spin text-muted', className)} aria-label="Loading" />
);

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <div className="text-muted">{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function SiteLogo({ src, size = 40, fallback }: { src?: string; size?: number; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-raised" style={{ width: size, height: size }}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        <span className="text-muted">{fallback}</span>
      )}
    </div>
  );
}
