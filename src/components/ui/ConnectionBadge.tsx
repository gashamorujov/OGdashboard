import { Database } from 'lucide-react';
import { useConnection } from '../../hooks/useConnection';
import { cn } from '../../utils/cn';

/** Live Realtime Database status. Shown in the admin header so it is visible in every section. */
export function ConnectionBadge() {
  const connected = useConnection();
  const state = connected === null ? 'checking' : connected ? 'online' : 'offline';
  const label = state === 'checking' ? 'Connecting' : state === 'online' ? 'Connected' : 'Offline';

  return (
    <span
      role="status"
      aria-live="polite"
      title="Realtime Database"
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium',
        state === 'online' && 'border-ok/30 bg-ok/10 text-ok',
        state === 'offline' && 'border-danger/30 bg-danger/10 text-danger',
        state === 'checking' && 'border-line bg-surface text-muted',
      )}
    >
      <span className="relative flex h-2 w-2">
        {state !== 'offline' && <span className={cn('absolute inset-0 animate-ping rounded-full', state === 'online' ? 'bg-ok/60' : 'bg-muted/50')} />}
        <span className={cn('relative h-2 w-2 rounded-full', state === 'online' ? 'bg-ok' : state === 'offline' ? 'bg-danger' : 'bg-muted')} />
      </span>
      <Database className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden text-muted sm:inline">Database</span>
      <span>{label}</span>
    </span>
  );
}
