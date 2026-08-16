import { useState } from 'react';
import { Button } from '@/components/ui/app-button';
import type { CaptureMetadata } from './types';
import { MAX_VIDEO_SECONDS, MIN_VIDEO_SECONDS, VIDEO_SCENE_SECONDS, normalizedGeneratedSeconds } from '@/lib/credits';

export interface CaptureMediaItem { id: string; url: string; title: string; }

function filenameFromUrl(url: string) {
  try { return new URL(url, window.location.origin).pathname.split('/').pop() ?? ''; }
  catch { return url.split(/[/?#]/).filter(Boolean).pop() ?? ''; }
}

export function captureMediaItems(metadata: CaptureMetadata | null | undefined): CaptureMediaItem[] {
  if (!metadata) return [];
  const candidates: Array<{ url?: string | null; title: string }> = [
    { url: metadata.screenshotUrl, title: 'Homepage' },
    { url: metadata.fullPageScreenshotUrl, title: 'Homepage · full page' },
    { url: metadata.mobileScreenshotUrl, title: 'Mobile homepage' },
    { url: metadata.mobileFullPageScreenshotUrl, title: 'Mobile · full page' },
    ...(Array.isArray(metadata.pages) ? metadata.pages : []).map((page, index) => ({ url: page?.screenshotUrl, title: page?.title || `Page ${index + 1}` })),
  ];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (!candidate.url) return [];
    const id = filenameFromUrl(candidate.url);
    if (!/^(?:screenshot(?:-full|-mobile|-mobile-full)?|page-\d+|private-page-\d+|interaction-[a-z-]+)\.jpg$/.test(id) || seen.has(id)) return [];
    seen.add(id);
    return [{ id, url: candidate.url, title: candidate.title }];
  });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function MediaPlanningPanel({
  metadata, selectedIds, onSelectionChange, onChooseDuration, creditBalance, isSignedIn, disabled,
}: {
  metadata: CaptureMetadata | null | undefined;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onChooseDuration: (seconds: number, label: string) => void;
  creditBalance: number;
  isSignedIn: boolean;
  disabled?: boolean;
}) {
  const items = captureMediaItems(metadata);
  const [customSeconds, setCustomSeconds] = useState(Math.min(MAX_VIDEO_SECONDS, Math.max(24, selectedIds.length * VIDEO_SCENE_SECONDS)));
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const selectedSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const recommendedSeconds = Math.min(MAX_VIDEO_SECONDS, Math.max(MIN_VIDEO_SECONDS, selectedCount * VIDEO_SCENE_SECONDS));
  const previewSeconds = normalizedGeneratedSeconds(customSeconds);
  const previewScenes = previewSeconds / VIDEO_SCENE_SECONDS;
  const portraitCount = selectedIds.filter((id) => (dimensions[id] ?? 1) < 0.82).length;
  const landscapeCount = selectedIds.filter((id) => (dimensions[id] ?? 1) > 1.22).length;
  const orientationAdvice = portraitCount > selectedCount / 2
    ? 'Most selected sources are portrait. Portrait 9:16 will usually keep more of each photo visible.'
    : landscapeCount > selectedCount / 2
      ? 'Most selected sources are wide. Landscape 16:9 will usually reduce cropping.'
      : 'Your selected sources use mixed shapes. Square or landscape is often the safest; the studio will preserve the important content.';

  function toggle(id: string) {
    if (selectedSet.has(id)) onSelectionChange(selectedIds.filter((value) => value !== id));
    else if (selectedIds.length < 30) onSelectionChange([...selectedIds, id]);
  }

  const presets = [8, 24, 56, recommendedSeconds].filter((seconds, index, all) => all.indexOf(seconds) === index);

  return <div className="space-y-3 rounded-2xl border border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-3.5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-sm font-semibold text-text-primary">Plan the right length for your media</p><p className="mt-1 text-[11px] leading-relaxed text-text-muted">{items.length} usable photo/page reference{items.length === 1 ? '' : 's'} found · choose what the video should use or emphasize.</p></div>
      <span className="rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold text-mint">{selectedCount} selected</span>
    </div>

    {items.length > 0 && <>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <button type="button" disabled={disabled} onClick={() => onSelectionChange(items.slice(0, 30).map((item) => item.id))} className="rounded-full border border-border px-2.5 py-1 text-text-muted hover:border-violet/40 hover:text-text-primary">Select all{items.length > 30 ? ' first 30' : ''}</button>
        <button type="button" disabled={disabled} onClick={() => onSelectionChange([])} className="rounded-full border border-border px-2.5 py-1 text-text-muted hover:border-violet/40 hover:text-text-primary">Choose specific photos</button>
        {items.length > 30 && <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-200">Up to 30 references per 4-minute production</span>}
      </div>
      <div className="chat-scroll grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
        {items.map((item, index) => {
          const checked = selectedSet.has(item.id);
          return <button key={item.id} type="button" disabled={disabled} onClick={() => toggle(item.id)} className={`group relative min-w-0 overflow-hidden rounded-lg border text-left transition ${checked ? 'border-violet bg-violet/10 ring-1 ring-violet/30' : 'border-white/10 bg-black/15 opacity-65 hover:opacity-100'}`}>
            <img
              src={item.url}
              alt={item.title}
              onLoad={(event) => {
                // React clears currentTarget after this handler returns. Read
                // the dimensions synchronously before scheduling the state
                // update; otherwise a large batch of concurrently loading
                // thumbnails can make currentTarget null inside the updater.
                const image = event.currentTarget;
                const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
                setDimensions((current) => ({ ...current, [item.id]: Number.isFinite(ratio) ? ratio : 1 }));
              }}
              onError={() => setDimensions((current) => ({ ...current, [item.id]: 1 }))}
              className="aspect-video w-full bg-black/20 object-contain"
            />
            <div className="flex items-center gap-2 px-2 py-1.5"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${checked ? 'border-violet bg-violet text-white' : 'border-white/25'}`}>{checked ? '✓' : ''}</span><span className="truncate text-[10px] text-text-muted">{index + 1}. {item.title}</span></div>
          </button>;
        })}
      </div>
    </>}

    {selectedCount === 0 ? <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-[11px] text-amber-100">Choose at least one photo or screenshot. Selecting only the strongest items usually makes a short video clearer.</div> : <div className="rounded-xl border border-mint/20 bg-mint/5 p-3 text-[11px] leading-relaxed text-text-muted"><p className="font-semibold text-mint">Recommended: {formatDuration(recommendedSeconds)} · {recommendedSeconds / VIDEO_SCENE_SECONDS} scenes</p><p className="mt-1">This gives each selected item one complete AI-video scene. For {selectedCount} selected items, the 1080p video costs {recommendedSeconds} credits without narration or {recommendedSeconds + 6} with voice.</p>{isSignedIn && <p className={`mt-1 font-semibold ${creditBalance >= recommendedSeconds + 6 ? 'text-mint' : 'text-amber-200'}`}>Your balance: {creditBalance} · {creditBalance >= recommendedSeconds + 6 ? 'enough for the recommended 1080p voice version' : `you would need ${recommendedSeconds + 6 - creditBalance} more credits for the recommended voice version`}</p>}<p className="mt-1 text-text-dim">{orientationAdvice}</p></div>}

    <div className="grid gap-2 sm:grid-cols-2">
      {presets.map((seconds) => { const voiceCost = seconds + 6; const shortage = Math.max(0, voiceCost - creditBalance); return <button key={seconds} type="button" disabled={disabled || selectedCount === 0} onClick={() => onChooseDuration(seconds, seconds === recommendedSeconds ? `Recommended coverage · ${formatDuration(seconds)}` : `${formatDuration(seconds)} video`)} className={`rounded-xl border px-3 py-2.5 text-left transition ${seconds === recommendedSeconds ? 'border-mint/35 bg-mint/10' : 'border-border bg-panel-alt hover:border-violet/40'}`}><span className="block text-xs font-semibold text-text-primary">{seconds === recommendedSeconds ? '✓ Recommended · ' : ''}{formatDuration(seconds)}</span><span className="mt-0.5 block text-[9px] text-text-dim">{seconds / VIDEO_SCENE_SECONDS} scenes · {seconds} credits at 1080p + optional voice</span>{isSignedIn && <span className={`mt-1 block text-[9px] font-semibold ${shortage ? 'text-amber-200' : 'text-mint'}`}>{shortage ? `Voice version needs ${shortage} more credits` : 'Your balance covers the 1080p voice version'}</span>}</button>; })}
    </div>

    <div className="rounded-xl border border-border bg-panel-alt p-3">
      <div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="text-[10px] font-semibold text-text-muted">Custom duration · 8-second steps · up to 4 minutes</span><input type="number" min={MIN_VIDEO_SECONDS} max={MAX_VIDEO_SECONDS} step={VIDEO_SCENE_SECONDS} value={customSeconds} onChange={(event) => setCustomSeconds(normalizedGeneratedSeconds(Number(event.target.value) || MIN_VIDEO_SECONDS))} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text-primary" /></label><Button size="sm" disabled={disabled || selectedCount === 0} onClick={() => onChooseDuration(previewSeconds, `Custom · ${formatDuration(previewSeconds)}`)}>Use {formatDuration(previewSeconds)}</Button></div>
      <p className={`mt-2 text-[10px] ${selectedCount > previewScenes ? 'text-amber-200' : 'text-text-dim'}`}>{selectedCount > previewScenes ? `${selectedCount} items cannot each receive a dedicated scene in ${formatDuration(previewSeconds)}. Select ${previewScenes} priority items, or use at least ${formatDuration(recommendedSeconds)}.` : `${previewScenes} scenes · ${previewSeconds} credits at 1080p or ${previewSeconds * 3} credits at 4K · voice narration adds 6.`}</p>
      {isSignedIn && <p className={`mt-1 text-[10px] font-semibold ${creditBalance >= previewSeconds + 6 ? 'text-mint' : 'text-amber-200'}`}>Balance {creditBalance} · {creditBalance >= previewSeconds + 6 ? 'enough for 1080p with voice' : `add ${previewSeconds + 6 - creditBalance} credits for 1080p with voice`}</p>}
    </div>
  </div>;
}
