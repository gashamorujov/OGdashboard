import { useEffect, useRef, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { AuthFailure, signInAdmin } from '../../lib/auth';
import { APP_CONFIG } from '../../lib/config';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginDialog({ onClose, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || remaining > 0) return;
    if (!code) {
      setError('Enter the access code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInAdmin(code);
      setCode('');
      onSuccess();
    } catch (err) {
      if (!mounted.current) return;
      const failure = err instanceof AuthFailure ? err : null;
      setError(failure?.message ?? 'Could not sign in.');
      setCode('');
      if (failure?.kind === 'denied') {
        const next = failures + 1;
        setFailures(next);
        const table = APP_CONFIG.loginClientCooldownMs;
        const wait = table[Math.min(next, table.length - 1)];
        if (wait > 0) {
          setCooldownUntil(Date.now() + wait);
          setNow(Date.now());
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Dialog
      title="Access"
      onClose={onClose}
      width="max-w-xs"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="admin-login" loading={busy} disabled={remaining > 0} icon={<KeyRound className="h-4 w-4" aria-hidden />}>
            {remaining > 0 ? `Wait ${remaining}s` : 'Continue'}
          </Button>
        </>
      }
    >
      <form id="admin-login" onSubmit={submit} noValidate>
        <Field
          label="Access code"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          error={error}
          maxLength={128}
        />
      </form>
    </Dialog>
  );
}
