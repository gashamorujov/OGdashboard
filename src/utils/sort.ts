import type { Website } from '../types';

/**
 * Dashboard order: the manual order set in admin (drag and drop).
 * Sites that have never been ordered (older data) come first, alphabetically; new sites are appended at the end.
 */
export function sortWebsites(list: readonly Website[]): Website[] {
  return [...list].sort((a, b) => {
    const ao = a.order;
    const bo = b.order;
    if (ao !== undefined && bo !== undefined) return ao - bo || a.createdAt - b.createdAt;
    if (ao === undefined && bo === undefined) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return ao === undefined ? -1 : 1;
  });
}
