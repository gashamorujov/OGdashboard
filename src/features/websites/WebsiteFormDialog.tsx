import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SiteArtwork } from '../../components/ui/SiteArtwork';
import { useToast } from '../../components/ui/Toast';
import { CLOUDINARY, UPLOAD_RULES, uploadToCloudinary, validateFile } from '../../lib/cloudinary';
import { createWebsite, updateWebsite } from '../../services/websites';
import type { LogoCrop, UploadResult, Website } from '../../types';
import { DEFAULT_LOGO_CROP, clampLogoCrop } from '../../utils/logoCrop';
import { errorMessage } from '../../utils/dom';
import { normalizeUrl } from '../../utils/url';

interface Props {
  site?: Website;
  onClose: () => void;
}

interface CropDrag {
  pointerId: number;
  startX: number;
  startY: number;
  cropX: number;
  cropY: number;
  width: number;
  height: number;
}

interface CropSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  output: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function CropSlider({ label, value, min, max, step, output, onChange }: CropSliderProps) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>{label}</span>
        <output className="tabular-nums text-fg">{output}</output>
      </span>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={onChange} />
    </label>
  );
}

export function WebsiteFormDialog({ site, onClose }: Props) {
  const toast = useToast();
  const [name, setName] = useState(site?.name ?? '');
  const [url, setUrl] = useState(site?.url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(site?.logoUrl);
  const [logoCrop, setLogoCrop] = useState<LogoCrop>(() => clampLogoCrop(site?.logoCrop));
  const [removeLogo, setRemoveLogo] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string; logo?: string; form?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ file: File; result: UploadResult } | null>(null);
  const objectUrl = useRef<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cropDrag = useRef<CropDrag | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      cancel.current?.();
    },
    [],
  );

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problem = validateFile(f, 'image');
    if (problem) {
      setErrors((x) => ({ ...x, logo: problem }));
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(f);
    setFile(f);
    setPreview(objectUrl.current);
    setLogoCrop(DEFAULT_LOGO_CROP);
    setRemoveLogo(false);
    setErrors((x) => ({ ...x, logo: undefined }));
  };

  const clearLogo = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setFile(null);
    setPreview(undefined);
    setLogoCrop(DEFAULT_LOGO_CROP);
    setRemoveLogo(true);
  };

  const onCropPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!preview || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    cropDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: logoCrop.x,
      cropY: logoCrop.y,
      width: rect.width,
      height: rect.height,
    };
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Dragging still works where pointer capture is unavailable.
    }
  };

  const onCropPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = cropDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = drag.cropX - ((event.clientX - drag.startX) / drag.width) * 100;
    const y = drag.cropY - ((event.clientY - drag.startY) / drag.height) * 100;
    setLogoCrop((current) => clampLogoCrop({ x, y, zoom: current.zoom }));
  };

  const endCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (cropDrag.current?.pointerId === event.pointerId) cropDrag.current = null;
  };

  const updateCrop = (key: keyof LogoCrop) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.currentTarget.value);
    setLogoCrop((current) => clampLogoCrop({ ...current, [key]: value }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Enter a name.';
    else if (trimmed.length > 80) next.name = 'Use 80 characters or fewer.';
    const normalized = normalizeUrl(url);
    if (!normalized.ok) next.url = normalized.error;
    setErrors(next);
    if (next.name || next.url || !normalized.ok) return;

    setBusy(true);
    try {
      let logoUrl = removeLogo ? undefined : site?.logoUrl;
      let logoPublicId = removeLogo ? undefined : site?.logoPublicId;
      if (file) {
        if (!uploaded.current || uploaded.current.file !== file) {
          setProgress(0);
          const handle = uploadToCloudinary(file, 'image', CLOUDINARY.folders.logos, setProgress);
          cancel.current = handle.cancel;
          uploaded.current = { file, result: await handle.promise };
          cancel.current = null;
        }
        logoUrl = uploaded.current.result.secureUrl;
        logoPublicId = uploaded.current.result.publicId;
      }
      const payload = {
        name: trimmed,
        url: normalized.url,
        logoUrl,
        logoPublicId,
        logoCrop: logoUrl ? clampLogoCrop(logoCrop) : undefined,
      };
      if (site) await updateWebsite(site.id, payload);
      else await createWebsite(payload);
      toast.success(site ? 'Website updated' : 'Website added');
      onClose();
    } catch (err) {
      setErrors((x) => ({ ...x, form: errorMessage(err, 'Could not save. Try again.') }));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      title={site ? 'Edit website' : 'Add website'}
      onClose={busy ? () => undefined : onClose}
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="website-form" loading={busy}>
            {progress !== null ? `Uploading ${progress}%` : 'Save'}
          </Button>
        </>
      }
    >
      <form id="website-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={80} autoComplete="off" />
        <Field label="URL" value={url} onChange={(e) => setUrl(e.target.value)} error={errors.url} placeholder="example.com" inputMode="url" autoCapitalize="off" spellCheck={false} autoComplete="off" />
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">Logo</span>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-line bg-raised">
              {preview ? <img src={preview} alt="Logo thumbnail" className="h-full w-full object-contain p-1" /> : <ImagePlus className="h-5 w-5 text-muted" aria-hidden />}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => input.current?.click()} disabled={busy}>
                {preview ? 'Replace' : 'Upload'}
              </Button>
              {preview && (
                <Button variant="ghost" onClick={clearLogo} disabled={busy} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
                  Remove
                </Button>
              )}
            </div>
            <input ref={input} type="file" className="hidden" accept={UPLOAD_RULES.image.mimes.join(',')} onChange={pick} aria-label="Logo file" />
          </div>
          {progress !== null && (
            <div className="h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-fg transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          <p className={errors.logo ? 'text-xs text-danger' : 'text-xs text-muted'} role={errors.logo ? 'alert' : undefined}>
            {errors.logo || UPLOAD_RULES.image.label}
          </p>
        </div>

        {preview && (
          <section aria-label="User panel logo crop" className="space-y-3 rounded-xl border border-line bg-bg/50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-fg">User-panel preview</h3>
                <p className="mt-0.5 text-[11px] text-muted">Drag the image to frame it, or adjust the controls.</p>
              </div>
              <Button variant="ghost" className="h-8 shrink-0 px-2 text-xs" onClick={() => setLogoCrop(DEFAULT_LOGO_CROP)} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}>
                Reset crop
              </Button>
            </div>

            <div className="overflow-hidden rounded-3xl border border-line bg-surface">
              <div
                className="relative aspect-[9/5] w-full cursor-grab overflow-hidden touch-none active:cursor-grabbing"
                onPointerDown={onCropPointerDown}
                onPointerMove={onCropPointerMove}
                onPointerUp={endCropDrag}
                onPointerCancel={endCropDrag}
                onLostPointerCapture={endCropDrag}
                aria-label="Logo crop preview. Drag to reposition the image."
              >
                <SiteArtwork src={preview} crop={logoCrop} />
              </div>
              <div className="flex h-[54px] items-center justify-center border-t border-line px-3.5 text-center text-sm font-semibold uppercase leading-5 tracking-[0.1em] text-fg">
                <span className="w-full truncate">{name.trim() || 'Website name'}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <CropSlider label="Zoom" value={logoCrop.zoom} min={1} max={3} step={0.01} output={`${logoCrop.zoom.toFixed(2)}×`} onChange={updateCrop('zoom')} />
              <CropSlider label="Horizontal framing" value={logoCrop.x} min={0} max={100} step={1} output={`${Math.round(logoCrop.x)}%`} onChange={updateCrop('x')} />
              <CropSlider label="Vertical framing" value={logoCrop.y} min={0} max={100} step={1} output={`${Math.round(logoCrop.y)}%`} onChange={updateCrop('y')} />
            </div>
            <p className="text-[11px] leading-4 text-muted">Save confirms this exact 9:5 crop in the user panel. Cancel discards your framing changes.</p>
          </section>
        )}

        {errors.form && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  );
}
