import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { AdminWorkspace } from '../features/admin/AdminWorkspace';
import { LoginDialog } from '../features/admin/LoginDialog';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Splash } from '../features/intro/Splash';
import { EmbeddedViewer } from '../features/dashboard/EmbeddedViewer';
import { MiniPlayer } from '../features/music/MiniPlayer';
import { usePlayer } from '../features/music/PlayerContext';
import { ThemeSwitcher } from '../components/ui/ThemeSwitcher';
import { useAdminSession } from '../hooks/useAdmin';
import { useLongPress } from '../hooks/useLongPress';
import { useShortcuts } from '../hooks/useShortcuts';
import { useTheme } from '../hooks/useTheme';
import { signOutAdmin } from '../lib/auth';
import { APP_CONFIG } from '../lib/config';
import { isFirebaseConfigured } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';
import type { Website } from '../types';

type View = { name: 'dashboard' } | { name: 'viewer'; site: Website } | { name: 'admin' };

export default function App() {
  const player = usePlayer();
  const toast = useToast();
  const { isAdmin, ready } = useAdminSession();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<View>({ name: 'dashboard' });
  const [loginOpen, setLoginOpen] = useState(false);
  const [intro, setIntro] = useState<'playing' | 'leaving' | 'done'>('playing');
  const onIntroLeave = useCallback(() => setIntro('leaving'), []);
  const onIntroDone = useCallback(() => setIntro('done'), []);

  const requestAdmin = useCallback(() => {
    if (isAdmin) setView({ name: 'admin' });
    else if (ready) setLoginOpen(true);
  }, [isAdmin, ready]);

  useShortcuts({
    onAdmin: requestAdmin,
    onPlaylist: (id) => player.selectPlaylist(id, { play: true }),
  });

  const holdHandlers = useLongPress(requestAdmin, APP_CONFIG.hiddenEntry.holdDurationMs, APP_CONFIG.hiddenEntry.touchHoldDurationMs);

  // Leaving the admin view when the session ends (sign out, code change elsewhere, revoked token).
  useEffect(() => {
    if (ready && !isAdmin) setView((v) => (v.name === 'admin' ? { name: 'dashboard' } : v));
  }, [isAdmin, ready]);

  if (!isFirebaseConfigured) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
        Firebase is not configured. Copy .env.example to .env and fill in the values.
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col" data-intro={intro === 'playing' ? 'on' : 'off'} data-phase={intro}>
      {intro !== 'done' && <Splash onLeave={onIntroLeave} onDone={onIntroDone} />}
      {view.name !== 'viewer' && <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-bg px-3 sm:px-5">
        <div className="-ml-3 flex h-14 select-none items-center gap-2.5 pl-3 pr-8 sm:-ml-5 sm:pl-5">
          <button
            type="button"
            aria-label="Open admin (Ctrl+Q, or hold the logo icon)"
            title={APP_CONFIG.appName}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
            style={{ touchAction: 'none' }}
            onPointerDown={holdHandlers.onPointerDown}
            onPointerMove={holdHandlers.onPointerMove}
            onPointerUp={holdHandlers.onPointerUp}
            onPointerCancel={holdHandlers.onPointerCancel}
            onLostPointerCapture={holdHandlers.onLostPointerCapture}
            onContextMenu={holdHandlers.onContextMenu}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                requestAdmin();
              }
            }}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm font-semibold">{APP_CONFIG.appName}</span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <ThemeSwitcher theme={theme} onChange={setTheme} />
          <MiniPlayer />
        </div>
      </header>}

      <main className={`flex min-h-0 flex-1 flex-col ${view.name === 'viewer' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className={view.name === 'dashboard' ? 'block' : 'hidden'}>
          <Dashboard onOpen={(site) => setView({ name: 'viewer', site })} />
        </div>
        {view.name === 'viewer' && <EmbeddedViewer site={view.site} onBack={() => setView({ name: 'dashboard' })} />}
        {view.name === 'admin' && isAdmin && (
          <AdminWorkspace
            onExit={() => setView({ name: 'dashboard' })}
            onSignOut={() => {
              void signOutAdmin().then(() => toast.info('Signed out'));
            }}
          />
        )}
      </main>

      {loginOpen && (
        <LoginDialog
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            setLoginOpen(false);
            setView({ name: 'admin' });
          }}
        />
      )}
    </div>
  );
}
