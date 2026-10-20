import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { GripVertical, Globe, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useData } from '../../app/DataContext';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, Skeleton, SiteLogo } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useDragSort } from '../../hooks/useDragSort';
import { deleteWebsite, saveWebsiteOrder } from '../../services/websites';
import type { Website } from '../../types';
import { errorMessage } from '../../utils/dom';
import { cn } from '../../utils/cn';
import { sortWebsites } from '../../utils/sort';
import { hostOf } from '../../utils/url';
import { WebsiteFormDialog } from './WebsiteFormDialog';

export function WebsitesAdmin() {
  const { websites, loading } = useData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string[] | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [editing, setEditing] = useState<Website | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Website | null>(null);

  const ordered = useMemo(() => {
    const base = sortWebsites(websites);
    if (!pending) return base;
    const byId = new Map(base.map((w) => [w.id, w]));
    const out = pending.map((id) => byId.get(id)).filter((w): w is Website => !!w);
    for (const w of base) if (!pending.includes(w.id)) out.push(w);
    return out;
  }, [websites, pending]);

  const filtering = query.trim().length > 0;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ordered.filter((w) => w.name.toLowerCase().includes(q) || w.url.toLowerCase().includes(q)) : ordered;
  }, [ordered, query]);

  /** Moves one site to a new position and saves the whole order; the list updates instantly (optimistic). */
  const moveSite = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= ordered.length) return;
    const ids = ordered.map((w) => w.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setPending(ids);
    try {
      await saveWebsiteOrder(ids);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the new order.'));
    } finally {
      setPending(null);
    }
  };

  const { drag, handleProps, rowStyle } = useDragSort({ listRef, disabled: filtering, onMove: (from, to) => void moveSite(from, to) });

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, index: number, id: string) => {
    if (filtering || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    void moveSite(index, index + (e.key === 'ArrowUp' ? -1 : 1));
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-handle="${CSS.escape(id)}"]`)?.focus());
  };

  return (
    <section aria-label="Websites" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" className="field h-9 pl-9" placeholder="Search" aria-label="Search websites" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="primary" className="ml-auto" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEditing('new')}>
          Add website
        </Button>
      </div>

      {!loading && websites.length > 1 && (
        <p className="text-xs text-muted">{filtering ? 'Clear the search to change the order.' : 'Drag the handle to change the order. The dashboard updates instantly.'}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-8 w-8" aria-hidden />}
          title={websites.length ? 'No matches' : 'No websites yet'}
          action={!websites.length ? <Button onClick={() => setEditing('new')}>Add website</Button> : undefined}
        />
      ) : (
        <ul ref={listRef} className={cn('divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface', drag && 'cursor-grabbing select-none')}>
          {list.map((w, index) => (
            <li
              key={w.id}
              style={rowStyle(index)}
              className={cn('flex items-center gap-3 bg-surface px-2 py-3 pr-3.5', drag?.from === index && 'bg-raised ring-1 ring-inset ring-accent/50')}
            >
              <button
                type="button"
                data-handle={w.id}
                disabled={filtering}
                aria-label={`Reorder ${w.name}. Drag, or press arrow up or down.`}
                title={filtering ? 'Clear the search to reorder' : 'Drag to reorder'}
                onKeyDown={(e) => onHandleKey(e, index, w.id)}
                {...handleProps(index)}
                className={cn('flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-30', !filtering && (drag?.from === index ? 'cursor-grabbing text-fg' : 'cursor-grab'))}
              >
                <GripVertical className="h-4 w-4" aria-hidden />
              </button>
              <SiteLogo src={w.logoUrl} size={36} fallback={<Globe className="h-4 w-4" aria-hidden />} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.name}</p>
                <p className="truncate text-xs text-muted">{hostOf(w.url)}</p>
              </div>
              <IconButton label={`Edit ${w.name}`} onClick={() => setEditing(w)}>
                <Pencil className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton label={`Delete ${w.name}`} onClick={() => setDeleting(w)} className="hover:text-danger">
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {editing && <WebsiteFormDialog site={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete website"
          message={`Delete "${deleting.name}"? It disappears from the dashboard immediately.`}
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await deleteWebsite(deleting.id);
              toast.success('Website deleted');
            } catch (e) {
              toast.error(errorMessage(e, 'Could not delete the website.'));
              throw e;
            }
          }}
        />
      )}
    </section>
  );
}
