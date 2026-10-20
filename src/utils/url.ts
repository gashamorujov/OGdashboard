export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript|file|blob|about|chrome|ftp|ws|wss):/i;

/** Normalizes user input to a safe http(s) URL. Bare hosts get https://. */
export function normalizeUrl(input: string): UrlResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Enter a URL.' };
  if (UNSAFE_SCHEME.test(raw)) return { ok: false, error: 'Only http and https URLs are allowed.' };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: 'Enter a valid URL.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Only http and https URLs are allowed.' };
  }
  if (parsed.username || parsed.password) return { ok: false, error: 'URLs with credentials are not allowed.' };
  const host = parsed.hostname;
  if (!host.includes('.') && host !== 'localhost') return { ok: false, error: 'Enter a valid domain.' };
  if (parsed.href.length > 2048) return { ok: false, error: 'URL is too long.' };
  return { ok: true, url: parsed.href };
}

export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
