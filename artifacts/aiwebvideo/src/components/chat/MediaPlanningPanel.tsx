import { useState } from 'react';
import { Clock, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/app-button';
import type { CaptureMetadata } from './types';
import { MIN_VIDEO_SECONDS, VIDEO_SCENE_SECONDS, estimateRenderCredits } from '@/lib/credits';

const MAX_CREATOR_DURATION_SECONDS = 60;
const DURATION_PRESETS = [8, 16, 24, 32, 40, 48, 56, 60] as const;

function normalizeCreatorDuration(value: number) {
  if (!Number.isFinite(value)) return MIN_VIDEO_SECONDS;
  return Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_CREATOR_DURATION_SECONDS, Math.round(value)));
}

export interface CaptureMediaItem { id: string; url: string; title: string; pageUrl?: string; }

function filenameFromUrl(url: string) {
  try { return new URL(url, window.location.origin).pathname.split('/').pop() ?? ''; }
  catch { return url.split(/[/?#]/).filter(Boolean).pop() ?? ''; }
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/mobile/gi, '')
    .replace(/full page/gi, '')
    .replace(/screenshot/gi, '')
    .replace(/website/gi, '')
    .replace(/page\s*\d+/gi, '')
    .replace(/[·|:–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pathnameFromUrl(pageUrl?: string) {
  try {
    const url = new URL(pageUrl || 'https://example.com', window.location.origin);
    return (url.pathname.toLowerCase().replace(/\/$/, '') || '/');
  } catch {
    return (pageUrl || '').toLowerCase().replace(/\/$/, '') || '/';
  }
}

function captureCategory(title: string, pageUrl?: string) {
  const label = normalizeLabel(title);
  const path = pathnameFromUrl(pageUrl);
  const combined = `${label} ${path}`;
  if (/interaction-|assistant|chat|demo|playground|workspace/.test(combined)) return 'experience';
  if (/pricing|plans|billing/.test(combined)) return 'pricing';
  if (/feature|how it works|how-it-works|use case|benefit|services/.test(combined)) return 'features';
  if (/product|shop|store|collection|catalog|gallery|portfolio|menu/.test(combined)) return 'products';
  if (/dashboard|app|booking|reserve|reservation|checkout|cart|order|results/.test(combined)) return 'conversion';
  if (/about|story|team|contact|support|faq/.test(combined)) return 'trust';
  if (path === '/' || /home|landing|hero/.test(combined)) return 'home';
  return 'other';
}

function categoryRank(category: string) {
  switch (category) {
    case 'home': return 7;
    case 'features': return 6;
    case 'products': return 5;
    case 'pricing': return 4;
    case 'conversion': return 3;
    case 'experience': return 2;
    case 'trust': return 1;
    default: return 0;
  }
}

function candidateWeight(title: string, pageUrl?: string, kind: 'hero' | 'page' | 'full' = 'page') {
  const label = normalizeLabel(title);
  const url = (pageUrl ?? '').toLowerCase();
  const category = captureCategory(title, pageUrl);
  let score = categoryRank(category) * 40;
  if (/home|landing|hero/.test(label) || /(^|\/)(?:$|home|index)/.test(url)) score += 36;
  if (/product|shop|collection|catalog|store|pricing|plans|services|features|gallery|menu/.test(label + ' ' + url)) score += 22;
  if (/dashboard|booking|checkout|order|results|portfolio|work|contact/.test(label + ' ' + url)) score += 12;
  if (kind === 'page') score += 10;
  if (kind === 'hero') score += 8;
  if (kind === 'full') score -= 18;
  if (/about|story|team/.test(label + ' ' + url)) score -= 2;
  return score;
}

function familyKey(title: string, pageUrl?: string) {
  const path = pathnameFromUrl(pageUrl);
  const category = captureCategory(title, pageUrl);
  if (path === '/' || /^\/(?:home|index)?$/.test(path)) return 'home:/';
  if (/^\/(?:pricing|plans)(?:\/|$)/.test(path)) return 'pricing:/pricing';
  if (/^\/(?:features|feature|how-it-works|howitworks)(?:\/|$)/.test(path)) return 'features:/features';
  if (/^\/(?:dashboard|app|workspace)(?:\/|$)/.test(path)) return 'conversion:/dashboard';
  if (/^\/(?:about|company|team)(?:\/|$)/.test(path)) return 'trust:/about';
  if (/^\/(?:contact|support|faq)(?:\/|$)/.test(path)) return 'trust:/contact';
  if (/^\/(?:shop|store|products?|product|collections?|catalog)(?:\/|$)/.test(path)) return 'products:/catalog';
  return `${category}:${path}`;
}

function captureKey(title: string, pageUrl?: string) {
  const family = familyKey(title, pageUrl);
  const normalizedTitle = normalizeLabel(title);
  return `${family}:${normalizedTitle}`;
}

export function captureMediaItems(metadata: CaptureMetadata | null | undefined): CaptureMediaItem[] {
  if (!metadata) return [];
  const candidates: Array<{ url?: string | null; title: string; pageUrl?: string; kind: 'hero' | 'page' | 'full' }> = [
    { url: metadata.screenshotUrl, title: 'Homepage', pageUrl: '/', kind: 'hero' },
    { url: metadata.fullPageScreenshotUrl, title: 'Homepage · full page', pageUrl: '/', kind: 'full' },
    ...(Array.isArray(metadata.pages) ? metadata.pages : []).map((page, index) => ({
      url: page?.screenshotUrl,
      title: page?.title || `Page ${index + 1}`,
      pageUrl: page?.url,
      kind: 'page' as const,
    })),
  ];
  const byGroup = new Map<string, { id: string; url: string; title: string; pageUrl?: string; score: number; order: number; category: string; family: string }>();
  for (const [index, candidate] of candidates.entries()) {
    if (!candidate.url) continue;
    const id = filenameFromUrl(candidate.url);
    if (!/^(?:screenshot(?:-full)?|page-\d+|private-page-\d+|interaction-[a-z-]+)\.jpg$/.test(id)) continue;
    const family = id.startsWith('interaction-') ? `interaction:${id}` : familyKey(candidate.title, candidate.pageUrl);
    const key = id.startsWith('interaction-') ? `interaction:${id}` : captureKey(candidate.title, candidate.pageUrl);
    const category = captureCategory(candidate.title, candidate.pageUrl);
    const score = candidateWeight(candidate.title, candidate.pageUrl, candidate.kind);
    const existing = byGroup.get(key);
    if (!existing || score > existing.score) {
      byGroup.set(key, { id, url: candidate.url, title: candidate.title, pageUrl: candidate.pageUrl, score, order: index, category, family });
    }
  }
  return [...byGroup.values()]
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ id, url, title, pageUrl }) => ({ id, url, title, pageUrl }));
}

export function autoSelectCaptureIds(metadata: CaptureMetadata | null | undefined, maxCount = 30) {
  const items = captureMediaItems(metadata);
  const picked: string[] = [];
  const usedFamilies = new Set<string>();
  const usedCategories = new Set<string>();
  const enriched = items.map((item) => ({
    ...item,
    category: captureCategory(item.title, item.pageUrl),
    family: familyKey(item.title, item.pageUrl),
  }));

  // First pass: maximize variety so the first scenes do not all come from the same
  // landing-page family or repeat nearly identical website states.
  for (const item of enriched) {
    if (picked.length >= maxCount) break;
    if (usedFamilies.has(item.family) || usedCategories.has(item.category)) continue;
    usedFamilies.add(item.family);
    usedCategories.add(item.category);
    picked.push(item.id);
  }

  // Second pass: allow one more from a category only when it introduces a new family.
  for (const item of enriched) {
    if (picked.length >= maxCount) break;
    if (picked.includes(item.id) || usedFamilies.has(item.family)) continue;
    usedFamilies.add(item.family);
    picked.push(item.id);
  }

  // Final pass: fill any remaining slots without hard category limits.
  for (const item of enriched) {
    if (picked.length >= maxCount) break;
    if (picked.includes(item.id)) continue;
    picked.push(item.id);
  }
  return picked;
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
  const initialCustomSeconds = normalizeCreatorDuration(Math.max(32, selectedIds.length * VIDEO_SCENE_SECONDS));
  const [customText, setCustomText] = useState(String(initialCustomSeconds));
  const [committedCustomSeconds, setCommittedCustomSeconds] = useState(initialCustomSeconds);
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const selectedSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const recommendedSeconds = normalizeCreatorDuration(Math.max(MIN_VIDEO_SECONDS, selectedCount * VIDEO_SCENE_SECONDS));
  const parsedCustomSeconds = Number.parseInt(customText, 10);
  const previewSeconds = Number.isFinite(parsedCustomSeconds)
    ? normalizeCreatorDuration(parsedCustomSeconds)
    : committedCustomSeconds;
  const previewScenes = Math.max(1, Math.ceil(previewSeconds / VIDEO_SCENE_SECONDS));
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

  function commitCustomDuration(raw = customText) {
    const parsed = Number.parseInt(raw.trim(), 10);
    const safe = normalizeCreatorDuration(Number.isFinite(parsed) ? parsed : committedCustomSeconds);
    setCommittedCustomSeconds(safe);
    setCustomText(String(safe));
    return safe;
  }

  function nudgeCustomDuration(delta: number) {
    const safe = normalizeCreatorDuration(previewSeconds + delta);
    setCommittedCustomSeconds(safe);
    setCustomText(String(safe));
  }

  const presets = [...DURATION_PRESETS];

  return <div className="space-y-3 rounded-2xl border border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-3.5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-sm font-semibold text-text-primary">Plan the right length for your media</p><p className="mt-1 text-[11px] leading-relaxed text-text-muted">{items.length} usable photo/page reference{items.length === 1 ? '' : 's'} found · choose what the video should use or emphasize.</p></div>
      <span className="rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold text-mint">{selectedCount} selected</span>
    </div>

    {items.length > 0 && <>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <button type="button" disabled={disabled} onClick={() => onSelectionChange(autoSelectCaptureIds(metadata, 30))} className="rounded-full border border-border px-2.5 py-1 text-text-muted hover:border-violet/40 hover:text-text-primary">Auto-pick best{items.length > 30 ? ' first 30' : ''}</button>
        <button type="button" disabled={disabled} onClick={() => onSelectionChange([])} className="rounded-full border border-border px-2.5 py-1 text-text-muted hover:border-violet/40 hover:text-text-primary">Clear selection</button>
        {items.length > 30 && <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-200">Up to 30 references per continuous production</span>}
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

    {selectedCount === 0 ? <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-[11px] text-amber-100">Choose at least one photo or screenshot. Selecting only the strongest items usually makes a short video clearer.</div> : (() => { const silentCost = estimateRenderCredits('video', true, recommendedSeconds, '1080p'); const voiceCost = estimateRenderCredits('video', false, recommendedSeconds, '1080p'); return <div className="rounded-xl border border-mint/20 bg-mint/5 p-3 text-[11px] leading-relaxed text-text-muted"><p className="font-semibold text-mint">Recommended: {formatDuration(recommendedSeconds)} · {Math.ceil(recommendedSeconds / VIDEO_SCENE_SECONDS)} timeline beats</p><p className="mt-1">The beats guide one continuous premium AI film and help cover the selected references. The 1080p video costs {silentCost} credits without narration or {voiceCost} with voice.</p>{isSignedIn && <p className={`mt-1 font-semibold ${creditBalance >= voiceCost ? 'text-mint' : 'text-amber-200'}`}>Your balance: {creditBalance} · {creditBalance >= voiceCost ? 'enough for the recommended 1080p voice version' : `you would need ${voiceCost - creditBalance} more credits for the recommended voice version`}</p>}<p className="mt-1 text-text-dim">{orientationAdvice}</p></div>; })()}

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {presets.map((seconds) => {
        const silentCost = estimateRenderCredits('video', true, seconds, '1080p');
        const voiceCost = estimateRenderCredits('video', false, seconds, '1080p');
        const shortage = Math.max(0, voiceCost - creditBalance);
        const recommended = seconds === recommendedSeconds;
        return <button
          key={seconds}
          type="button"
          disabled={disabled || selectedCount === 0}
          onClick={() => onChooseDuration(seconds, recommended ? `Recommended coverage · ${formatDuration(seconds)}` : `${formatDuration(seconds)} video`)}
          className={`rounded-xl border px-3 py-2.5 text-left transition ${recommended ? 'border-mint/35 bg-mint/10' : 'border-border bg-panel-alt hover:border-violet/40'}`}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Clock size={12} className={recommended ? 'text-mint' : 'text-text-dim'} />
            {formatDuration(seconds)}
          </span>
          {recommended && <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[.1em] text-mint">Recommended</span>}
          <span className="mt-1 block text-[9px] text-text-dim">{Math.ceil(seconds / VIDEO_SCENE_SECONDS)} beats · {silentCost} credits</span>
          {isSignedIn && <span className={`mt-1 block text-[9px] font-semibold ${shortage ? 'text-amber-200' : 'text-mint'}`}>{shortage ? `Voice needs +${shortage}` : 'Balance covers voice'}</span>}
        </button>;
      })}
    </div>

    <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Clock size={13} className="text-violet" />Custom duration</p>
          <p className="mt-0.5 text-[9px] text-text-dim">Type any whole second from 8 to 60. The value is committed after you finish typing.</p>
        </div>
        <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 font-utility text-[9px] text-mint">{formatDuration(previewSeconds)}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => nudgeCustomDuration(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.04] text-white transition hover:border-violet/35 hover:bg-white/[.08] disabled:opacity-40" aria-label="Decrease duration"><Minus size={15} /></button>
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={customText}
            onChange={(event) => setCustomText(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            onBlur={() => commitCustomDuration()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitCustomDuration();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setCustomText(String(committedCustomSeconds));
                event.currentTarget.blur();
              }
            }}
            placeholder="8–60"
            className="h-12 w-full rounded-xl border border-white/[.1] bg-black/20 px-4 pr-12 text-center text-lg font-bold text-white outline-none transition placeholder:text-white/20 focus:border-violet/60 focus:ring-2 focus:ring-violet/20"
            aria-label="Custom video duration in seconds"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[.14em] text-text-dim">sec</span>
        </div>
        <button type="button" disabled={disabled} onClick={() => nudgeCustomDuration(1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.04] text-white transition hover:border-violet/35 hover:bg-white/[.08] disabled:opacity-40" aria-label="Increase duration"><Plus size={15} /></button>
        <Button
          size="sm"
          disabled={disabled || selectedCount === 0}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const safe = commitCustomDuration();
            onChooseDuration(safe, `Custom · ${formatDuration(safe)}`);
          }}
        >
          Use {formatDuration(previewSeconds)}
        </Button>
      </div>
      {(() => { const preview1080 = estimateRenderCredits('video', true, previewSeconds, '1080p'); const preview4k = estimateRenderCredits('video', true, previewSeconds, '4k'); const previewVoice = estimateRenderCredits('video', false, previewSeconds, '1080p'); return <><p className={`mt-2 text-[10px] ${selectedCount > previewScenes ? 'text-amber-200' : 'text-text-dim'}`}>{selectedCount > previewScenes ? `${selectedCount} items cannot each receive a dedicated scene in ${formatDuration(previewSeconds)}. Select ${previewScenes} priority items, or use at least ${formatDuration(recommendedSeconds)}.` : `${previewScenes} timeline beats · ${preview1080} credits at 1080p or ${preview4k} credits at 4K · voice narration adds 6.`}</p>{isSignedIn && <p className={`mt-1 text-[10px] font-semibold ${creditBalance >= previewVoice ? 'text-mint' : 'text-amber-200'}`}>Balance {creditBalance} · {creditBalance >= previewVoice ? 'enough for 1080p with voice' : `add ${previewVoice - creditBalance} credits for 1080p with voice`}</p>}</>; })()}
    </div>
  </div>;
}
