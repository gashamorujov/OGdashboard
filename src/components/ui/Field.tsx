import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, Props>(function Field({ label, error, hint, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const msgId = `${inputId}-msg`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={cn('field', error && 'border-danger/70', className)}
        {...rest}
      />
      {(error || hint) && (
        <p id={msgId} className={cn('text-xs', error ? 'text-danger' : 'text-muted')} role={error ? 'alert' : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
});
