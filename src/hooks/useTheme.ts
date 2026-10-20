import { useEffect, useState } from 'react';

export const THEME_IDS = ['day', 'black', 'red', 'blue'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

const STORAGE_KEY = 'sites.theme.v1';
const META_COLORS: Record<ThemeId, string> = {
  day: '#f8f9fc',
  black: '#0a0b0d',
  red: '#120e10',
  blue: '#0c121c',
};

function isTheme(value: string | null): value is ThemeId {
  return value !== null && THEME_IDS.some((theme) => theme === value);
}

function readTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : 'black';
  } catch {
    return 'black';
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The active page theme still works when browser storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setTheme(isTheme(event.newValue) ? event.newValue : 'black');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { theme, setTheme };
}
