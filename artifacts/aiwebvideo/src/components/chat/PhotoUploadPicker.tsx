import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/app-button';
import { clearPhotoDraft, loadPhotoDraft, savePhotoDraft } from '@/lib/photoDraft';

const MAX_PHOTOS = 10;
const MAX_BYTES_PER_PHOTO = 10 * 1024 * 1024;
// HEIC/HEIF intentionally excluded — the server can't decode it (no libheif
// in the ffmpeg build this runs on). iPhone photos default to HEIC; users
// need to convert to JPEG first or switch their camera to "Most Compatible".
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

type AttachedPhoto = {
  id: string;
  file: File;
  source: 'paste' | 'picker';
};

/**
 * Alternative entry point to the chat: instead of pasting a website URL,
 * the user attaches their own photos (product shots, digital-product page
 * exports, etc.) and those become the real reference material the AI video
 * is grounded in — the exact same role website screenshots normally play.
 */
export function PhotoUploadPicker({ onSubmit, disabled, isAdmin = false, title = 'Paste or choose your own photos', buttonLabel = 'Upload', helper, draftKey = 'new-photo-project' }: { onSubmit: (files: File[]) => boolean | Promise<boolean>; disabled?: boolean; isAdmin?: boolean; title?: string; buttonLabel?: string; helper?: string; draftKey?: string }) {
  const [photos, setPhotos] = useState<AttachedPhoto[]>([]);
  const photosRef = useRef<AttachedPhoto[]>([]);
  const nextPhotoId = useRef(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maximum = isAdmin ? Number.POSITIVE_INFINITY : MAX_PHOTOS;
  const helperText = helper ?? (isAdmin ? 'Administrator upload · paste or choose any number of JPEG, PNG, or WEBP photos' : 'Paste with Ctrl+V / Cmd+V, or choose up to 10 JPEG, PNG, or WEBP photos');

  function replacePhotos(next: AttachedPhoto[]) {
    photosRef.current = next;
    setPhotos(next);
  }

  useEffect(() => {
    let cancelled = false;
    setDraftReady(false);
    void loadPhotoDraft(draftKey).then((saved) => {
      if (cancelled) return;
      if (saved.length > 0) {
        replacePhotos(saved);
        setDraftRestored(true);
      }
      setDraftReady(true);
    }).catch(() => setDraftReady(true));
    return () => { cancelled = true; };
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const operation = photos.length > 0 ? savePhotoDraft(draftKey, photos) : clearPhotoDraft(draftKey);
      void operation.catch(() => setError('These photos could not be saved as a browser draft. Keep this tab open until the upload finishes.'));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftReady, photos]);

  function handleFiles(list: FileList | File[] | null, source: AttachedPhoto['source']) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const accepted: File[] = [];
    let nextError: string | null = null;
    for (const file of incoming) {
      if (!ACCEPTED.includes(file.type)) {
        nextError = `${file.name || 'That pasted file'} isn't a supported image type. Use JPEG, PNG, or WEBP (not HEIC — convert iPhone photos to JPEG first).`;
        continue;
      }
      if (file.size > MAX_BYTES_PER_PHOTO) {
        nextError = `${file.name || 'That pasted photo'} is too large (max 10MB per photo).`;
        continue;
      }
      accepted.push(file);
    }
    const available = Math.max(0, maximum - photosRef.current.length);
    if (accepted.length > available) nextError = `You can add up to ${MAX_PHOTOS} photos in one project.`;
    const added = accepted.slice(0, available).map((file) => ({
      id: `photo-${Date.now()}-${nextPhotoId.current++}`,
      file,
      source,
    }));
    if (added.length > 0) replacePhotos([...photosRef.current, ...added]);
    setError(nextError);
  }

  useEffect(() => {
    const urls = Object.fromEntries(photos.map((photo) => [photo.id, URL.createObjectURL(photo.file)]));
    setPreviewUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (disabled) return;
      const pastedFiles = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
      const itemFiles = pastedFiles.length > 0
        ? []
        : Array.from(event.clipboardData?.items ?? [])
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
      const images = pastedFiles.length > 0 ? pastedFiles : itemFiles;
      if (images.length === 0) return; // Keep normal text pasting unchanged.
      event.preventDefault();
      handleFiles(images, 'paste');
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [disabled, isAdmin]);

  function removePhoto(id: string) {
    if (openPreviewId === id) setOpenPreviewId(null);
    replacePhotos(photosRef.current.filter((photo) => photo.id !== id));
  }

  const openPhoto = openPreviewId ? photos.find((photo) => photo.id === openPreviewId) : null;

  return (
    <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[.025] p-3.5">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files, 'picker'); e.target.value = ''; }}
      />
      {photos.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center transition-colors hover:border-violet/45 hover:bg-violet/5 disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="text-xl" aria-hidden="true">📷</span>
          <span className="text-sm font-medium text-text-primary">{title}</span>
          <span className="text-[11px] text-text-dim">{helperText}</span>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-text-primary">{photos.length} photo{photos.length === 1 ? '' : 's'} ready</p>
            <p className="text-[10px] text-text-dim">Tap a photo to preview</p>
          </div>
          {draftRestored && <p className="rounded-lg border border-mint/20 bg-mint/5 px-2.5 py-1.5 text-[10px] text-mint">Draft restored — your selected photos are still here.</p>}
          <div className={`chat-scroll grid max-h-[22rem] gap-1.5 overflow-y-auto pr-1 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'}`}>
            {photos.map((photo, index) => (
              <div key={photo.id} className={`group relative min-w-0 overflow-hidden rounded-lg border bg-black/20 ${photo.source === 'paste' ? 'border-violet/35' : 'border-white/10'}`}>
                <button
                  type="button"
                  onClick={() => setOpenPreviewId(photo.id)}
                  disabled={disabled}
                  aria-label={`Preview ${photo.file.name || `photo ${index + 1}`}`}
                  className={`block w-full ${photos.length === 1 ? 'aspect-[16/7] max-h-48' : 'aspect-square'} disabled:opacity-50`}
                >
                  {previewUrls[photo.id] && <img src={previewUrls[photo.id]} alt={`Selected photo ${index + 1}`} className="h-full w-full object-contain" />}
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-1.5 pb-1.5 pt-5">
                  <p className="truncate text-[9px] font-medium text-white">{index + 1}. {photo.file.name || `Photo ${index + 1}`}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  disabled={disabled}
                  aria-label={`Remove ${photo.file.name || `photo ${index + 1}`}`}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/70 text-xs text-white shadow-lg backdrop-blur transition-colors hover:bg-red-500 disabled:pointer-events-none"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < maximum && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className={`flex min-h-20 items-center justify-center rounded-lg border border-dashed border-white/15 px-2 py-2 text-center text-[10px] text-text-dim transition-colors hover:border-violet/45 hover:bg-violet/5 hover:text-text-primary disabled:pointer-events-none disabled:opacity-50 ${photos.length === 1 ? '' : 'aspect-square'}`}
              >
                <span><span className="block text-lg">＋</span>Add or paste more</span>
              </button>
            )}
          </div>
          <div className="sticky bottom-0 z-10 -mx-1 rounded-xl border border-violet/20 bg-[#17122b]/95 p-1 shadow-[0_-10px_30px_rgba(12,8,28,.75)] backdrop-blur-xl">
            <Button
              variant="primary" size="sm" className="w-full"
              disabled={disabled || submitting || photos.length === 0}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const succeeded = await onSubmit(photos.map((photo) => photo.file));
                  if (succeeded) {
                    await clearPhotoDraft(draftKey).catch(() => {});
                    replacePhotos([]);
                    setDraftRestored(false);
                  }
                } finally { setSubmitting(false); }
              }}
            >
              {submitting ? 'Uploading securely…' : `${buttonLabel} ${photos.length} photo${photos.length === 1 ? '' : 's'} & continue`}
            </Button>
          </div>
        </>
      )}
      <p className="text-center text-[10px] text-text-dim">Tip: copy a photo or screenshot, then paste anywhere in this chat.</p>
      {error && <p className="text-[11px] text-amber-300">{error}</p>}
      {openPhoto && previewUrls[openPhoto.id] && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setOpenPreviewId(null)} className="fixed inset-0 z-[120] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-md sm:p-8">
          <button type="button" onClick={() => setOpenPreviewId(null)} aria-label="Close photo preview" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-xl text-white hover:bg-white/15">×</button>
          <div onClick={(event) => event.stopPropagation()} className="max-h-[88vh] max-w-[94vw] cursor-default overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <img src={previewUrls[openPhoto.id]} alt={openPhoto.file.name || 'Selected photo'} className="max-h-[82vh] max-w-[94vw] object-contain" />
            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/80 px-4 py-3 text-xs text-white/75">
              <span className="max-w-[70vw] truncate">{openPhoto.file.name || 'Selected photo'}</span>
              <span>{openPhoto.source === 'paste' ? 'Pasted from clipboard' : 'Selected from device'}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
