import { useState, type FormEvent } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { AuthFailure, changeAdminCode } from '../../lib/auth';
import { MIN_CODE_LENGTH } from '../../lib/config';

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl+Q', 'Open admin sign-in'],
  ['Alt+1', 'Playlist 1, random track'],
  ['Alt+2', 'Playlist 2, random track'],
  ['Alt+3', 'Playlist 3, random track'],
];

export function SettingsAdmin({ onSignOut }: { onSignOut: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const err: typeof errors = {};
    if (!current) err.current = 'Enter the current code.';
    if (next.length < MIN_CODE_LENGTH) err.next = `Use at least ${MIN_CODE_LENGTH} characters.`;
    else if (next.length > 128) err.next = 'Use 128 characters or fewer.';
    else if (next === current) err.next = 'Choose a code different from the current one.';
    if (confirm !== next) err.confirm = 'Codes do not match.';
    setErrors(err);
    if (err.current || err.next || err.confirm) return;

    setBusy(true);
    try {
      await changeAdminCode(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Access code changed');
    } catch (e2) {
      const f = e2 instanceof AuthFailure ? e2 : null;
      if (f?.kind === 'denied') setErrors({ current: 'Incorrect code.' });
      else toast.error(f?.message ?? 'Could not change the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Security and settings" className="max-w-lg space-y-8">
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-surface p-5" noValidate>
        <h3 className="text-sm font-semibold">Access code</h3>
        <Field label="Current code" type="password" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} maxLength={128} />
        <Field label="New code" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} hint={`At least ${MIN_CODE_LENGTH} characters. Longer is safer.`} maxLength={128} />
        <Field label="Confirm new code" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} maxLength={128} />
        <Button variant="primary" type="submit" loading={busy} icon={<KeyRound className="h-4 w-4" aria-hidden />}>
          Change code
        </Button>
      </form>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold">Shortcuts</h3>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd className="shrink-0 rounded-md border border-line bg-raised px-2 py-0.5 text-xs">{keys}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Button onClick={onSignOut} icon={<LogOut className="h-4 w-4" aria-hidden />}>
        Sign out
      </Button>
    </section>
  );
}
