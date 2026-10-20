/** Central, non-secret configuration. */
export const APP_CONFIG = {
  appName: 'Sites',
  hiddenEntry: { holdDurationMs: 2000, touchHoldDurationMs: 1000 },
  iframeSlowLoadMs: 12_000,
  loginClientCooldownMs: [0, 0, 0, 10_000, 30_000, 60_000],
} as const;

export const PLAYER_STORAGE_KEY = 'sites.player.prefs.v1';

/** Shared admin account. Its password is derived from the access code. Database rules check this exact email. */
export const ADMIN_EMAIL = 'admin@sites-dashboard.app';
export const DEFAULT_ADMIN_CODE = '0706';
export const MIN_CODE_LENGTH = 4;
export const passwordFromCode = (code: string) => `sites-admin:${code}`;
