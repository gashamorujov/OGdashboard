import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react';
import { IconButton } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Misc';
import { APP_CONFIG } from '../../lib/config';
import type { Website } from '../../types';

interface Props {
  site: Website;
  onBack: () => void;
}

type Status = 'loading' | 'loaded' | 'slow';

export function EmbeddedViewer({ site, onBack }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const timer = useRef<number>();

  useEffect(() => {
    setStatus('loading');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus((current) => (current === 'loading' ? 'slow' : current)), APP_CONFIG.iframeSlowLoadMs);
    return () => window.clearTimeout(timer.current);
  }, [site.url]);

  const mixedContent = window.location.protocol === 'https:' && site.url.startsWith('http://');

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-bg">
      {!mixedContent && (
        <iframe
          key={site.id}
          src={site.url}
          title={site.name}
          allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; web-share; usb"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0 bg-white"
          onLoad={() => {
            window.clearTimeout(timer.current);
            setStatus('loaded');
          }}
        />
      )}

      {status === 'loading' && !mixedContent && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-bg/70" aria-live="polite">
          <Spinner />
        </div>
      )}

      <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-2xl border border-line/80 bg-surface/90 p-1.5 shadow-pop backdrop-blur-xl sm:left-4 sm:top-4">
        <IconButton label="Back to dashboard" onClick={onBack} className="text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>

      {(status === 'slow' || mixedContent) && (
        <div role="status" className="absolute left-3 right-3 top-[4.5rem] z-20 flex items-start gap-2.5 rounded-xl border border-line bg-surface/95 px-4 py-3 text-sm shadow-pop backdrop-blur-xl sm:left-4 sm:right-auto sm:max-w-xl">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <p className="text-muted">
            {mixedContent
              ? 'This site uses http and cannot be shown inside this secure page. '
              : 'This site is taking a long time to load or may block embedding. '}
            Sites that set X-Frame-Options or a Content-Security-Policy frame-ancestors rule may refuse to open inside another page.
          </p>
          <a href={site.url} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-fg px-3 py-1.5 text-xs font-medium text-bg hover:bg-fg/90">
            Open site
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      )}

      {mixedContent && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg px-6 text-center text-sm text-muted">
          This HTTP website cannot be embedded in a secure HTTPS page.
        </div>
      )}
    </div>
  );
}
