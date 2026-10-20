import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Item { id: number; kind: Kind; text: string }
interface Api { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const Ctx = createContext<Api>({ success: () => undefined, error: () => undefined, info: () => undefined });
export const useToast = () => useContext(Ctx);

const icons = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const tone = { success: 'text-ok', error: 'text-danger', info: 'text-accent' } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++seq.current;
    setItems((cur) => [...cur.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const api = useMemo<Api>(
    () => ({ success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {items.map((i) => {
          const Icon = icons[i.kind];
          return (
            <div key={i.id} className="anim-pop pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg border border-line bg-raised px-3.5 py-2.5 text-sm shadow-pop">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone[i.kind]}`} aria-hidden />
              <span>{i.text}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
