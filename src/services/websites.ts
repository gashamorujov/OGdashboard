import { push, ref, remove, set, update } from 'firebase/database';
import { db } from '../lib/firebase';
import type { LogoCrop, Website } from '../types';
import { clampLogoCrop } from '../utils/logoCrop';

export interface WebsiteInput {
  name: string;
  url: string;
  logoUrl?: string;
  logoPublicId?: string;
  logoCrop?: LogoCrop;
}

export async function createWebsite(input: WebsiteInput): Promise<string> {
  const node = push(ref(db, 'websites'));
  const id = node.key;
  if (!id) throw new Error('Could not allocate an id.');
  const now = Date.now();
  // New sites go to the end of the manual order (existing positions are small integers, this is a timestamp).
  const site: Website = { id, name: input.name, url: input.url, order: now, createdAt: now };
  if (input.logoUrl) site.logoUrl = input.logoUrl;
  if (input.logoPublicId) site.logoPublicId = input.logoPublicId;
  if (input.logoUrl && input.logoCrop) site.logoCrop = clampLogoCrop(input.logoCrop);
  await set(node, site);
  return id;
}

export async function updateWebsite(id: string, input: WebsiteInput): Promise<void> {
  await update(ref(db, `websites/${id}`), {
    name: input.name,
    url: input.url,
    logoUrl: input.logoUrl ?? null,
    logoPublicId: input.logoPublicId ?? null,
    logoCrop: input.logoUrl ? clampLogoCrop(input.logoCrop) : null,
  });
}

export const deleteWebsite = (id: string) => remove(ref(db, `websites/${id}`));

/** Saves the manual order: position i is stored on every site in one atomic update. */
export function saveWebsiteOrder(ids: readonly string[]): Promise<void> {
  const updates: Record<string, number> = {};
  ids.forEach((id, i) => {
    updates[`websites/${id}/order`] = i;
  });
  return update(ref(db), updates);
}
