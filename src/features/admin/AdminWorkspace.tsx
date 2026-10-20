import { useState } from 'react';
import { ArrowLeft, Globe, LayoutDashboard, Music, Shield } from 'lucide-react';
import { ConnectionBadge } from '../../components/ui/ConnectionBadge';
import { cn } from '../../utils/cn';
import { MusicAdmin } from '../music/MusicAdmin';
import { SettingsAdmin } from '../settings/SettingsAdmin';
import { WebsitesAdmin } from '../websites/WebsitesAdmin';
import { Overview } from './Overview';

type Section = 'overview' | 'websites' | 'music' | 'settings';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'websites', label: 'Websites', icon: Globe },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'settings', label: 'Security', icon: Shield },
] as const;

export function AdminWorkspace({ onExit, onSignOut }: { onExit: () => void; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>('overview');
  const title = SECTIONS.find((s) => s.id === section)?.label ?? '';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-24 pt-5 sm:px-6 md:flex-row md:gap-8">
      <nav aria-label="Admin sections" className="md:w-44 md:shrink-0">
        <button type="button" onClick={onExit} className="mb-3 hidden h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-fg md:flex">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </button>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          <li className="md:hidden">
            <button type="button" onClick={onExit} aria-label="Back to dashboard" className="flex h-9 items-center rounded-lg px-2.5 text-muted hover:bg-raised hover:text-fg">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
          </li>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-sm transition-colors',
                  section === id ? 'bg-raised font-medium text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <ConnectionBadge />
        </div>
        {section === 'overview' && <Overview />}
        {section === 'websites' && <WebsitesAdmin />}
        {section === 'music' && <MusicAdmin />}
        {section === 'settings' && <SettingsAdmin onSignOut={onSignOut} />}
      </div>
    </div>
  );
}
