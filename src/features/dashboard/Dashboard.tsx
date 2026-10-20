import { useMemo } from 'react';
import { Globe, TriangleAlert } from 'lucide-react';
import { useData } from '../../app/DataContext';
import { EmptyState, Skeleton } from '../../components/ui/Misc';
import { SiteCard } from './SiteCard';
import type { Website } from '../../types';
import { sortWebsites } from '../../utils/sort';

interface Props {
  onOpen: (site: Website) => void;
}

const gridClass = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

export function Dashboard({ onOpen }: Props) {
  const { websites, loading, error } = useData();
  const sorted = useMemo(
    () => sortWebsites(websites),
    [websites],
  );

  return (
    <div className="mx-auto w-full px-4 pb-24 pt-5 sm:px-4 sm:pt-7">
      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {loading ? (
        <div className={gridClass} aria-busy>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl border border-line bg-surface">
              <Skeleton className="aspect-[9/5] rounded-none" />
              <div className="flex h-[54px] items-center justify-center px-4">
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        !error && <EmptyState icon={<Globe className="h-8 w-8" aria-hidden />} title="No websites yet" />
      ) : (
        <ul className={gridClass} aria-label="Websites">
          {sorted.map((site, i) => (
            <SiteCard key={site.id} site={site} index={i} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  );
}
