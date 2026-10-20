import { Globe, Music } from 'lucide-react';
import { useData } from '../../app/DataContext';
import { Skeleton } from '../../components/ui/Misc';
import { PLAYLIST_IDS } from '../../types';

export function Overview() {
  const { websites, tracks, loading } = useData();
  const total = PLAYLIST_IDS.reduce((n, id) => n + tracks[id].length, 0);

  const stats: Array<{ label: string; value: number; icon?: boolean }> = [
    { label: 'Websites', value: websites.length, icon: true },
    { label: 'Tracks', value: total },
    ...PLAYLIST_IDS.map((id) => ({ label: `Playlist ${id}`, value: tracks[id].length })),
  ];

  return (
    <section aria-label="Overview" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              {s.icon ? <Globe className="h-3.5 w-3.5" aria-hidden /> : <Music className="h-3.5 w-3.5" aria-hidden />}
              {s.label}
            </div>
            {loading ? <Skeleton className="mt-2 h-8 w-12" /> : <p className="mt-1.5 text-2xl font-semibold tabular-nums">{s.value}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
