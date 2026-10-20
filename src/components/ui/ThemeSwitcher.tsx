import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Droplets, Flame, Moon, Palette, Sun } from 'lucide-react';
import type { ThemeId } from '../../hooks/useTheme';

const OPTIONS: Array<{
  id: ThemeId;
  label: string;
  description: string;
  icon: typeof Sun;
  surface: string;
  accent: string;
  border: string;
}> = [
  { id: 'day', label: 'Day', description: 'Bright and clear', icon: Sun, surface: '#f8f9fc', accent: '#5266dc', border: '#dfe3ec' },
  { id: 'black', label: 'Black', description: 'Quiet and minimal', icon: Moon, surface: '#0a0b0d', accent: '#9eafff', border: '#383a40' },
  { id: 'red', label: 'Red', description: 'Crimson red surfaces', icon: Flame, surface: '#180509', accent: '#ff3753', border: '#70192a' },
  { id: 'blue', label: 'Blue', description: 'Deep blue surfaces', icon: Droplets, surface: '#051024', accent: '#42a6ff', border: '#1a4a82' },
];

export function ThemeSwitcher({ theme, onChange }: { theme: ThemeId; onChange: (theme: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = OPTIONS.findIndex((option) => option.id === theme);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => optionRefs.current[Math.max(0, selectedIndex)]?.focus());
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, selectedIndex]);

  const choose = (value: ThemeId) => {
    onChange(value);
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % OPTIONS.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = OPTIONS.length - 1;
    if (next !== null) {
      event.preventDefault();
      optionRefs.current[next]?.focus();
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label={`Theme: ${OPTIONS[selectedIndex]?.label ?? 'Black'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-menu"
        title={`Theme: ${OPTIONS[selectedIndex]?.label ?? 'Black'}`}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-sm transition-colors hover:bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Palette className="h-[18px] w-[18px]" aria-hidden />
        <span className="absolute bottom-[7px] right-[7px] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: OPTIONS[selectedIndex]?.accent }} aria-hidden />
      </button>

      {open && (
        <div id="theme-menu" role="menu" aria-label="Choose a color theme" className="anim-pop absolute right-0 top-12 z-50 w-56 rounded-xl border border-line bg-surface p-2 shadow-pop">
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Appearance</p>
          {OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(option.id)}
                onKeyDown={(event) => moveFocus(event, index)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${active ? 'bg-accent/10 text-fg' : 'text-muted hover:bg-raised hover:text-fg'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ backgroundColor: option.surface, borderColor: option.border, color: option.accent }}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-5">{option.label}</span>
                  <span className="block truncate text-[11px] leading-4 text-muted">{option.description}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
