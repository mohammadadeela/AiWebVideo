import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRoute } from 'wouter';
import {
  ArrowLeft, Bot, Captions, Check, ChevronDown, CircleStop, Copy, Crop, Download,
  Film, Image as ImageIcon, Layers3, Loader2, Maximize2, Menu, Mic2, Minus,
  Move, Music2, Pause, Play, Plus, Redo2, RotateCw, Save, Scissors, Send,
  Settings2, SlidersHorizontal, Sparkles, Square, TextCursorInput, Trash2,
  Undo2, Upload, Volume2, WandSparkles, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSeo } from '@/lib/useSeo';
import {
  ApiError,
} from '@/lib/api-client';
import {
  applyStudioEdit,
  assetToLayer,
  cancelStudioOperation,
  createStudioExport,
  fetchStudioExport,
  fetchStudioOperation,
  fetchStudioProject,
  planStudioEdit,
  saveStudioProject,
  studioHistory,
  trackStudioEvent,
  uid,
  uploadStudioAssets,
  type StudioAsset,
  type StudioEditPlan,
  type StudioLayer,
  type StudioProject,
  type StudioProjectState,
} from '@/lib/studio-api';

const CHAT_KEY = (projectId: string) => `aiwebvideo:studio-chat:${projectId}`;
const RECOVERY_KEY = (projectId: string) => `aiwebvideo:studio-recovery:${projectId}`;

type Tool = 'media' | 'text' | 'audio' | 'captions' | 'canvas' | 'ai';
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; at: number };

type ExportState = {
  id: string;
  status: string;
  progress: number;
  url: string | null;
  error: string | null;
} | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

function assetMap(assets: StudioAsset[]) {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

function activeAt(layer: StudioLayer, playhead: number) {
  return playhead >= layer.start && playhead <= layer.end;
}

function visualFilter(layer: StudioLayer) {
  const filters: string[] = [];
  if (layer.effects.includes('blur')) filters.push('blur(6px)');
  if (layer.effects.includes('monochrome')) filters.push('grayscale(1)');
  if (layer.effects.includes('warm')) filters.push('sepia(.18) saturate(1.12)');
  if (layer.effects.includes('cool')) filters.push('hue-rotate(8deg) saturate(.96)');
  if (layer.effects.includes('high-contrast')) filters.push('contrast(1.18)');
  return filters.join(' ') || undefined;
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textStyle(layer: StudioLayer) {
  const style = layer.style ?? {};
  return {
    fontSize: `${safeNumber(style.fontSize, 64)}px`,
    fontWeight: safeNumber(style.weight, 700),
    color: typeof style.color === 'string' ? style.color : '#ffffff',
    textAlign: (typeof style.align === 'string' ? style.align : 'center') as 'left' | 'center' | 'right',
    textShadow: style.shadow === false ? undefined : '0 3px 18px rgba(0,0,0,.55)',
  };
}

function MediaThumb({ asset, selected, onClick }: { asset: StudioAsset; selected?: boolean; onClick: () => void }) {
  const image = asset.mime_type.startsWith('image/');
  const video = asset.mime_type.startsWith('video/');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-xl border text-left transition ${selected ? 'border-violet bg-violet/10' : 'border-white/10 bg-white/[.035] hover:border-white/20'}`}
      title={asset.name}
    >
      {image ? <img src={asset.storage_url} alt="" className="h-full w-full object-cover" draggable={false} /> : video ? (
        <video src={asset.storage_url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center"><Music2 className="text-violet" size={28} /></div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
        <div className="truncate">{asset.name}</div>
      </div>
      <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100"><Plus size={13} /></span>
    </button>
  );
}

function MiniButton({ label, children, onClick, active, disabled }: { label: string; children: React.ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`grid min-h-9 min-w-9 place-items-center rounded-lg border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'border-violet/60 bg-violet/15 text-white' : 'border-white/10 bg-white/[.035] text-text-muted hover:border-white/20 hover:text-white'}`}>
      {children}
    </button>
  );
}

function Field({ label, value, min, max, step = 0.01, onChange, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-muted"><span>{label}</span><span className="tabular-nums text-white/70">{Number(value.toFixed(step < 1 ? 2 : 0))}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="w-full accent-violet" />
    </label>
  );
}

export function StudioEditorPage() {
  const [, params] = useRoute('/studio/project/:projectId');
  const projectId = params?.projectId ?? '';
  useSeo({ title: 'Studio Editor | AiWebVideo', description: 'Edit video and images with AiWebVideo Studio.', path: `/studio/project/${projectId}`, noindex: true });

  const [project, setProject] = useState<StudioProject | null>(null);
  const [state, setState] = useState<StudioProjectState | null>(null);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [revision, setRevision] = useState(1);
  const revisionRef = useRef(1);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const [activeTool, setActiveTool] = useState<Tool>('media');
  const [mobileSheet, setMobileSheet] = useState<Tool | 'inspector' | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiAttachmentIds, setAiAttachmentIds] = useState<string[]>([]);
  const [aiPlan, setAiPlan] = useState<StudioEditPlan | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOperationId, setAiOperationId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportResolution, setExportResolution] = useState<'720p' | '1080p' | '4k'>('720p');
  const [exportState, setExportState] = useState<ExportState>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const dirtyVersion = useRef(0);
  const [dirty, setDirty] = useState(false);
  const pendingLabel = useRef('Autosave');

  const assetsById = useMemo(() => assetMap(assets), [assets]);
  const selectedLayer = useMemo(() => state?.layers.find((layer) => layer.id === state.selectedLayerId) ?? null, [state]);
  const primaryVideoLayer = useMemo(() => state?.layers.find((layer) => layer.type === 'video' && layer.assetId) ?? null, [state]);
  const primaryVideoAsset = primaryVideoLayer?.assetId ? assetsById.get(primaryVideoLayer.assetId) ?? null : null;

  const appendChat = useCallback((role: ChatMessage['role'], text: string) => {
    setChat((current) => [...current, { id: crypto.randomUUID(), role, text, at: Date.now() }].slice(-80));
  }, []);

  const markDirty = useCallback((label = 'Edit') => {
    dirtyVersion.current += 1;
    pendingLabel.current = label;
    setDirty(true);
    setSaveState('saving');
  }, []);

  const updateState = useCallback((updater: (current: StudioProjectState) => StudioProjectState, label = 'Edit') => {
    setState((current) => current ? updater(structuredClone(current)) : current);
    markDirty(label);
  }, [markDirty]);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const loaded = await fetchStudioProject(projectId);
    setProject(loaded);
    setState(loaded.projectState);
    setAssets(loaded.assets);
    setRevision(loaded.revision);
    revisionRef.current = loaded.revision;
    setTitle(loaded.title);
    setPlayhead((value) => clamp(value, 0, loaded.projectState.duration || 0));
    setSaveState('saved');
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchStudioProject(projectId),
      Promise.resolve().then(() => {
        try { return JSON.parse(localStorage.getItem(CHAT_KEY(projectId)) || '[]') as ChatMessage[]; } catch { return [] as ChatMessage[]; }
      }),
    ]).then(([loaded, savedChat]) => {
      if (cancelled) return;
      setProject(loaded);
      setState(loaded.projectState);
      setAssets(loaded.assets);
      setRevision(loaded.revision);
      revisionRef.current = loaded.revision;
      setTitle(loaded.title);
      setChat(Array.isArray(savedChat) ? savedChat.slice(-80) : []);
      void trackStudioEvent({ event: 'studio_opened', projectId });
      const recovery = localStorage.getItem(RECOVERY_KEY(projectId));
      if (recovery) {
        try {
          const parsed = JSON.parse(recovery) as { projectState?: StudioProjectState; title?: string };
          if (parsed.projectState) {
            setState(parsed.projectState);
            if (parsed.title) setTitle(parsed.title);
            setDirty(true);
            setSaveState('offline');
            toast.info('Recovered unsaved Studio changes from this device.');
          }
        } catch { localStorage.removeItem(RECOVERY_KEY(projectId)); }
      }
    }).catch((error) => {
      if (!cancelled) toast.error(error instanceof Error ? error.message : 'Could not open Studio project.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    try { localStorage.setItem(CHAT_KEY(projectId), JSON.stringify(chat.slice(-80))); } catch { /* private mode */ }
  }, [chat, projectId]);

  useEffect(() => {
    if (!dirty || !state || !projectId) return;
    const version = dirtyVersion.current;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      void saveStudioProject(projectId, { revision: revisionRef.current, title, projectState: state, label: pendingLabel.current })
        .then((saved) => {
          setRevision(saved.revision);
          revisionRef.current = saved.revision;
          setProject((current) => current ? { ...current, ...saved, assets: current.assets } : current);
          localStorage.removeItem(RECOVERY_KEY(projectId));
          if (dirtyVersion.current === version) {
            setDirty(false);
            setSaveState('saved');
          }
        })
        .catch(async (error) => {
          if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
            toast.warning('This project changed elsewhere. Loading the newest version.');
            await refresh().catch(() => {});
            return;
          }
          try { localStorage.setItem(RECOVERY_KEY(projectId), JSON.stringify({ title, projectState: state, savedAt: Date.now() })); } catch { /* ignore */ }
          setSaveState(navigator.onLine ? 'error' : 'offline');
        });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [dirty, projectId, refresh, state, title]);

  useEffect(() => {
    const retry = () => {
      if (dirty) {
        dirtyVersion.current += 1;
        setDirty(false);
        window.setTimeout(() => setDirty(true), 0);
      }
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [dirty]);

  useEffect(() => {
    if (!playing || !state) return;
    if (primaryVideoAsset && primaryVideoRef.current) {
      void primaryVideoRef.current.play().catch(() => setPlaying(false));
      return () => primaryVideoRef.current?.pause();
    }
    const started = performance.now() - playhead * 1000;
    let raf = 0;
    const tick = (now: number) => {
      const value = (now - started) / 1000;
      if (value >= state.duration) { setPlayhead(state.duration); setPlaying(false); return; }
      setPlayhead(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, primaryVideoAsset, state?.duration]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); void doHistory(event.shiftKey ? 'redo' : 'undo'); return; }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); void doHistory('redo'); return; }
      if (typing) return;
      if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value); return; }
      if ((event.key === 'Delete' || event.key === 'Backspace') && state?.selectedLayerId) { event.preventDefault(); removeSelected(); return; }
      if (event.key === 'ArrowLeft') setPlayhead((value) => clamp(value - (event.shiftKey ? 1 : .1), 0, state?.duration ?? 0));
      if (event.key === 'ArrowRight') setPlayhead((value) => clamp(value + (event.shiftKey ? 1 : .1), 0, state?.duration ?? 0));
      if (event.key === '=' || event.key === '+') setTimelineZoom((value) => clamp(value + .25, .5, 4));
      if (event.key === '-') setTimelineZoom((value) => clamp(value - .25, .5, 4));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const mutateLayer = useCallback((layerId: string, patch: Partial<StudioLayer>, label = 'Update layer') => {
    updateState((current) => {
      current.layers = current.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer);
      current.selectedLayerId = layerId;
      current.duration = Math.max(current.duration, ...current.layers.map((layer) => layer.end));
      return current;
    }, label);
  }, [updateState]);

  const selectLayer = useCallback((layerId: string) => {
    setState((current) => current ? { ...current, selectedLayerId: layerId } : current);
  }, []);

  const addAsset = useCallback((asset: StudioAsset) => {
    if (!state) return;
    const layer = assetToLayer(asset, state, playhead > 0 ? playhead : 0);
    updateState((current) => {
      current.layers.push(layer);
      current.selectedLayerId = layer.id;
      current.duration = Math.max(current.duration, layer.end);
      return current;
    }, `Added ${asset.name}`);
  }, [playhead, state, updateState]);

  const addText = useCallback((caption = false) => {
    if (!state) return;
    const id = uid(caption ? 'caption' : 'text');
    const start = playhead;
    const end = Math.min(Math.max(state.duration, start + 3), start + (caption ? 3 : 5));
    updateState((current) => {
      current.layers.push({
        id, type: 'text', name: caption ? 'Caption' : 'Text', text: caption ? 'Type caption' : 'Your text',
        start, end, trimStart: 0, trimEnd: null, x: .5, y: caption ? .84 : .5, width: .75, height: .16,
        rotation: 0, opacity: 1, volume: 1, speed: 1,
        style: { fontSize: caption ? 48 : 64, weight: 700, color: '#ffffff', align: 'center', caption }, effects: [], transitionIn: null, transitionOut: null,
      });
      current.selectedLayerId = id;
      current.duration = Math.max(current.duration, end);
      return current;
    }, caption ? 'Added caption' : 'Added text');
  }, [playhead, state, updateState]);

  const duplicateSelected = useCallback(() => {
    if (!selectedLayer) return;
    updateState((current) => {
      const original = current.layers.find((layer) => layer.id === selectedLayer.id);
      if (!original) return current;
      const clone = structuredClone(original);
      clone.id = uid('copy');
      clone.name = `${clone.name} copy`;
      clone.x = clamp(clone.x + .04, .05, .95);
      clone.y = clamp(clone.y + .04, .05, .95);
      current.layers.push(clone);
      current.selectedLayerId = clone.id;
      return current;
    }, 'Duplicated layer');
  }, [selectedLayer, updateState]);

  const removeSelected = useCallback(() => {
    if (!state?.selectedLayerId) return;
    const target = state.selectedLayerId;
    updateState((current) => {
      current.layers = current.layers.filter((layer) => layer.id !== target);
      current.selectedLayerId = current.layers.at(-1)?.id ?? null;
      return current;
    }, 'Deleted layer');
  }, [state?.selectedLayerId, updateState]);

  const splitSelected = useCallback(() => {
    if (!selectedLayer || playhead <= selectedLayer.start || playhead >= selectedLayer.end) {
      toast.info('Move the playhead inside the selected clip first.');
      return;
    }
    updateState((current) => {
      const index = current.layers.findIndex((layer) => layer.id === selectedLayer.id);
      if (index < 0) return current;
      const original = current.layers[index];
      const clone = structuredClone(original);
      clone.id = uid('split');
      clone.start = playhead;
      clone.trimStart = original.trimStart + (playhead - original.start) * original.speed;
      original.end = playhead;
      current.layers.splice(index + 1, 0, clone);
      current.selectedLayerId = clone.id;
      return current;
    }, 'Split clip');
  }, [playhead, selectedLayer, updateState]);

  async function doHistory(direction: 'undo' | 'redo') {
    if (!projectId || dirty) {
      toast.info(dirty ? 'Saving this edit first…' : 'History is unavailable.');
      return;
    }
    try {
      const result = await studioHistory(projectId, direction);
      setState(result.projectState);
      setRevision(result.revision);
      revisionRef.current = result.revision;
      setSaveState('saved');
    } catch (error) {
      toast.info(error instanceof Error ? error.message : direction === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.');
    }
  }

  async function handleFiles(files: File[]) {
    if (!projectId || !files.length) return;
    setUploading(true);
    try {
      const response = await uploadStudioAssets(projectId, files);
      setAssets((current) => [...current, ...response.assets]);
      for (const asset of response.assets) addAsset(asset);
      toast.success(`${response.assets.length} file${response.assets.length === 1 ? '' : 's'} added to Studio.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally { setUploading(false); }
  }

  function canvasPointerDown(event: React.PointerEvent, layer: StudioLayer) {
    if (!canvasRef.current || layer.type === 'audio') return;
    event.preventDefault();
    event.stopPropagation();
    selectLayer(layer.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, layerX: layer.x, layerY: layer.y };
    const onMove = (move: PointerEvent) => {
      const dx = (move.clientX - start.x) / rect.width;
      const dy = (move.clientY - start.y) / rect.height;
      setState((current) => current ? { ...current, layers: current.layers.map((item) => item.id === layer.id ? { ...item, x: clamp(start.layerX + dx, .02, .98), y: clamp(start.layerY + dy, .02, .98) } : item), selectedLayerId: layer.id } : current);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      markDirty('Moved layer');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function resizePointerDown(event: React.PointerEvent, layer: StudioLayer) {
    if (!canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const start = { x: event.clientX, width: layer.width, height: layer.height };
    const onMove = (move: PointerEvent) => {
      const delta = (move.clientX - start.x) / rect.width;
      const next = clamp(start.width + delta, .04, 1.5);
      setState((current) => current ? { ...current, layers: current.layers.map((item) => item.id === layer.id ? { ...item, width: next, height: clamp(start.height + delta, .04, 1.5) } : item) } : current);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      markDirty('Resized layer');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  async function sendAi() {
    const instruction = aiInstruction.trim();
    if (!instruction || !projectId || aiBusy) return;
    appendChat('user', instruction);
    setAiInstruction('');
    setAiBusy(true);
    setAiPlan(null);
    try {
      const plan = await planStudioEdit(projectId, instruction, aiAttachmentIds);
      const destructive = plan.commands.some((command) => ['deleteClip','trimClip','setProjectDuration','changeAspectRatio'].includes(command.type));
      const shouldConfirm = plan.execution === 'paid' || plan.requiresConfirmation || destructive || plan.commands.length > 2;
      if (shouldConfirm) {
        setAiPlan(plan);
        setAiInstruction(instruction);
        appendChat('assistant', plan.execution === 'paid' ? `I can do that. This edit uses AI — ${plan.costCredits} credits. Review the plan and apply it when ready.` : `I prepared the edit plan: ${plan.summary}. Review it and apply when ready.`);
      } else {
        await applyCurrentAi(instruction, plan);
      }
    } catch (error) {
      appendChat('assistant', error instanceof Error ? error.message : 'I could not plan that edit.');
    } finally { setAiBusy(false); }
  }

  async function applyCurrentAi(instruction = aiInstruction.trim(), existingPlan = aiPlan) {
    if (!instruction || !projectId || aiBusy) return;
    setAiBusy(true);
    try {
      const key = `studio:${projectId}:${crypto.randomUUID()}`;
      const result = await applyStudioEdit(projectId, instruction, aiAttachmentIds, key);
      if (result.status === 'completed' && result.project) {
        setProject(result.project);
        setState(result.project.projectState);
        setAssets(result.project.assets);
        setRevision(result.project.revision);
        revisionRef.current = result.project.revision;
        setDirty(false);
        setSaveState('saved');
        appendChat('assistant', existingPlan?.summary ? `Done. ${existingPlan.summary}.` : 'Done. The edit is on your timeline and remains fully editable.');
        setAiPlan(null);
        setAiInstruction('');
        setAiAttachmentIds([]);
        return;
      }
      if (result.operationId) {
        setAiOperationId(result.operationId);
        appendChat('assistant', `AI processing started${result.requiredCredits ? ` — ${result.requiredCredits} credits reserved` : ''}. I’ll keep the current version until the new result succeeds.`);
      }
      setAiPlan(null);
    } catch (error) {
      appendChat('assistant', error instanceof Error ? error.message : 'The edit could not be applied.');
    } finally { setAiBusy(false); }
  }

  useEffect(() => {
    if (!aiOperationId) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const operation = await fetchStudioOperation(aiOperationId);
        if (cancelled) return;
        if (operation.status === 'completed') {
          appendChat('assistant', 'Done. The AI result has been added without deleting the original, so you can compare or undo it.');
          setAiOperationId(null);
          await refresh();
          return;
        }
        if (operation.status === 'failed' || operation.status === 'cancelled') {
          appendChat('assistant', operation.error || 'The AI edit stopped. Your previous project state is unchanged.');
          setAiOperationId(null);
          await refresh();
          return;
        }
        timer = window.setTimeout(poll, 1800);
      } catch {
        timer = window.setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [aiOperationId, appendChat, refresh]);

  async function cancelAi() {
    if (!aiOperationId) return;
    try {
      const response = await cancelStudioOperation(aiOperationId);
      toast.warning(response.warning);
      appendChat('assistant', response.warning);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not request cancellation.'); }
  }

  async function startExport() {
    if (!projectId || !project || exportState?.status && !['completed','failed','cancelled'].includes(exportState.status)) return;
    try {
      const response = await createStudioExport(projectId, exportResolution, project.kind === 'image' ? 'png' : 'mp4');
      setExportState({ id: response.exportId, status: response.status, progress: 0, url: null, error: null });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start export.'); }
  }

  useEffect(() => {
    const id = exportState?.id;
    if (!id || ['completed','failed','cancelled'].includes(exportState.status)) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const result = await fetchStudioExport(id);
        if (cancelled) return;
        setExportState({ id, status: result.status, progress: result.progress, url: result.storage_url, error: result.error });
        if (result.status === 'completed') {
          void trackStudioEvent({ event: 'studio_exported', projectId, metadata: { resolution: result.resolution, format: result.format } });
          toast.success('Studio export is ready.');
          return;
        }
        if (result.status === 'failed' || result.status === 'cancelled') return;
        timer = window.setTimeout(poll, 1600);
      } catch { timer = window.setTimeout(poll, 2500); }
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [exportState?.id, exportState?.status, projectId]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-bg text-text-muted"><Loader2 className="animate-spin" /></div>;
  if (!project || !state) return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 text-center"><div><h1 className="text-xl font-semibold text-white">Studio project unavailable</h1><Link href="/studio" className="mt-4 inline-block text-violet hover:underline">Back to Studio</Link></div></div>
  );

  const visibleLayers = state.layers.filter((layer) => layer.type !== 'audio' && activeAt(layer, playhead));
  const duration = Math.max(.1, state.duration || 1);
  const canvasAspect = `${state.canvas.width} / ${state.canvas.height}`;
  const selectedAssetId = selectedLayer?.assetId ?? null;

  const leftContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 p-2">
        {([
          ['media', ImageIcon, 'Media'], ['text', TextCursorInput, 'Text'], ['audio', Music2, 'Audio'], ['captions', Captions, 'Captions'], ['canvas', Maximize2, 'Canvas'], ['ai', Bot, 'AI'],
        ] as const).map(([tool, Icon, label]) => (
          <button key={tool} type="button" onClick={() => setActiveTool(tool)} className={`flex min-w-max items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition ${activeTool === tool ? 'bg-violet/15 text-violet' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}><Icon size={14} />{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTool === 'media' && <>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet/35 bg-violet/[.07] px-3 py-3 text-xs font-medium text-violet transition hover:bg-violet/10"><Upload size={15} />{uploading ? 'Uploading…' : 'Upload media'}</button>
          <div className="grid grid-cols-2 gap-2">{assets.filter((asset) => !asset.mime_type.startsWith('audio/')).map((asset) => <MediaThumb key={asset.id} asset={asset} selected={selectedAssetId === asset.id} onClick={() => addAsset(asset)} />)}</div>
          {!assets.some((asset) => !asset.mime_type.startsWith('audio/')) && <p className="px-2 py-8 text-center text-xs leading-5 text-text-muted">Upload videos, images, product photos, logos or screenshots. Uploading and manual editing use no AI credits.</p>}
        </>}
        {activeTool === 'text' && <div className="space-y-2"><button type="button" onClick={() => addText(false)} className="w-full rounded-xl border border-white/10 bg-white/[.04] p-4 text-left hover:border-violet/35"><div className="text-base font-semibold text-white">Add heading</div><div className="mt-1 text-xs text-text-muted">Real editable text — no image-generated lettering.</div></button><button type="button" onClick={() => addText(false)} className="w-full rounded-xl border border-white/10 bg-white/[.04] p-3 text-left text-sm text-white/90">Add body text</button></div>}
        {activeTool === 'audio' && <><button type="button" onClick={() => fileInputRef.current?.click()} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet/35 p-3 text-xs text-violet"><Upload size={14} />Upload audio</button><div className="space-y-2">{assets.filter((asset) => asset.mime_type.startsWith('audio/')).map((asset) => <button key={asset.id} type="button" onClick={() => addAsset(asset)} className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] p-3 text-left text-xs text-white/85"><Music2 size={15} className="text-violet" /><span className="truncate">{asset.name}</span><Plus className="ml-auto" size={13} /></button>)}</div></>}
        {activeTool === 'captions' && <div className="space-y-3"><button type="button" onClick={() => addText(true)} className="w-full rounded-xl border border-white/10 bg-white/[.04] p-4 text-left"><div className="font-semibold text-white">Add manual caption</div><div className="mt-1 text-xs leading-5 text-text-muted">Precise timing and real text rendering. AI transcription is hidden until its provider is enabled.</div></button></div>}
        {activeTool === 'canvas' && <div className="space-y-4"><div><div className="mb-2 text-xs font-medium text-white">Aspect ratio</div><div className="grid grid-cols-3 gap-2">{(['9:16','16:9','1:1'] as const).map((ratio) => <button key={ratio} type="button" onClick={() => updateState((current) => { current.canvas.aspectRatio = ratio; if (ratio === '9:16') { current.canvas.width = 1080; current.canvas.height = 1920; } else if (ratio === '16:9') { current.canvas.width = 1920; current.canvas.height = 1080; } else { current.canvas.width = 1080; current.canvas.height = 1080; } return current; }, 'Changed canvas ratio')} className={`rounded-lg border px-2 py-2 text-xs ${state.canvas.aspectRatio === ratio ? 'border-violet bg-violet/15 text-white' : 'border-white/10 text-text-muted'}`}>{ratio}</button>)}</div></div><label className="block text-xs text-text-muted">Background<input type="color" value={state.canvas.background} onChange={(event) => updateState((current) => { current.canvas.background = event.currentTarget.value; return current; }, 'Changed canvas color')} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-transparent" /></label></div>}
        {activeTool === 'ai' && <div className="rounded-xl border border-violet/20 bg-violet/[.06] p-4"><Sparkles size={18} className="text-violet" /><h3 className="mt-3 font-semibold text-white">AI Edit</h3><p className="mt-1 text-xs leading-5 text-text-muted">Tell Studio exactly what to change. Free transforms stay local; generative edits show their credit cost before provider work starts.</p><button type="button" onClick={() => setMobileSheet('ai')} className="mt-3 rounded-lg bg-violet px-3 py-2 text-xs font-semibold text-white">Open AI Edit</button></div>}
      </div>
    </div>
  );

  const inspector = selectedLayer ? (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between"><div><div className="text-xs text-text-muted">Selected</div><div className="max-w-[180px] truncate text-sm font-semibold text-white">{selectedLayer.name}</div></div><div className="flex gap-1"><MiniButton label="Duplicate" onClick={duplicateSelected}><Copy size={14} /></MiniButton><MiniButton label="Delete" onClick={removeSelected}><Trash2 size={14} /></MiniButton></div></div>
      {selectedLayer.type === 'text' && <><label className="block text-xs text-text-muted">Text<textarea value={selectedLayer.text ?? ''} onChange={(event) => mutateLayer(selectedLayer.id, { text: event.currentTarget.value }, 'Edited text')} rows={3} className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-violet/45" /></label><label className="block text-xs text-text-muted">Color<input type="color" value={typeof selectedLayer.style.color === 'string' ? selectedLayer.style.color : '#ffffff'} onChange={(event) => mutateLayer(selectedLayer.id, { style: { ...selectedLayer.style, color: event.currentTarget.value } }, 'Changed text color')} className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-transparent" /></label><Field label="Font size" min={12} max={180} step={1} value={safeNumber(selectedLayer.style.fontSize, 64)} onChange={(value) => mutateLayer(selectedLayer.id, { style: { ...selectedLayer.style, fontSize: value } }, 'Changed font size')} suffix="px" /></>}
      {selectedLayer.type !== 'audio' && <><Field label="Horizontal" min={.02} max={.98} value={selectedLayer.x} onChange={(value) => mutateLayer(selectedLayer.id, { x: value }, 'Moved layer')} /><Field label="Vertical" min={.02} max={.98} value={selectedLayer.y} onChange={(value) => mutateLayer(selectedLayer.id, { y: value }, 'Moved layer')} /><Field label="Scale" min={.04} max={1.5} value={selectedLayer.width} onChange={(value) => mutateLayer(selectedLayer.id, { width: value, height: value }, 'Resized layer')} /><Field label="Rotation" min={-180} max={180} step={1} value={selectedLayer.rotation} onChange={(value) => mutateLayer(selectedLayer.id, { rotation: value }, 'Rotated layer')} suffix="°" /><Field label="Opacity" min={0} max={1} value={selectedLayer.opacity} onChange={(value) => mutateLayer(selectedLayer.id, { opacity: value }, 'Changed opacity')} /></>}
      <div className="grid grid-cols-2 gap-3"><label className="text-[11px] text-text-muted">Start<input type="number" min={0} step="0.1" value={Number(selectedLayer.start.toFixed(2))} onChange={(event) => mutateLayer(selectedLayer.id, { start: Math.max(0, Number(event.currentTarget.value)) }, 'Changed timing')} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-xs text-white" /></label><label className="text-[11px] text-text-muted">End<input type="number" min={selectedLayer.start + .05} step="0.1" value={Number(selectedLayer.end.toFixed(2))} onChange={(event) => mutateLayer(selectedLayer.id, { end: Math.max(selectedLayer.start + .05, Number(event.currentTarget.value)) }, 'Changed timing')} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-xs text-white" /></label></div>
      {(selectedLayer.type === 'audio' || selectedLayer.type === 'video') && <Field label="Volume" min={0} max={2} value={selectedLayer.volume} onChange={(value) => mutateLayer(selectedLayer.id, { volume: value }, 'Changed volume')} />}
      {selectedLayer.type === 'video' && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={splitSelected} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 p-2 text-xs text-white/85"><Scissors size={13} />Split</button><button type="button" onClick={() => mutateLayer(selectedLayer.id, { trimStart: selectedLayer.trimStart + .25 }, 'Trimmed clip')} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 p-2 text-xs text-white/85"><Crop size={13} />Trim +.25s</button></div>}
      {selectedLayer.type !== 'audio' && <div><div className="mb-2 text-xs font-medium text-white">Looks</div><div className="flex flex-wrap gap-2">{(['blur','monochrome','warm','cool','high-contrast'] as const).map((effect) => <button key={effect} type="button" onClick={() => mutateLayer(selectedLayer.id, { effects: selectedLayer.effects.includes(effect) ? selectedLayer.effects.filter((item) => item !== effect) : [...selectedLayer.effects, effect] }, 'Changed effect')} className={`rounded-full border px-2.5 py-1 text-[10px] ${selectedLayer.effects.includes(effect) ? 'border-violet/55 bg-violet/15 text-white' : 'border-white/10 text-text-muted'}`}>{effect}</button>)}</div></div>}
    </div>
  ) : <div className="p-6 text-center text-xs leading-5 text-text-muted">Select a layer on the canvas or timeline to edit precise properties.</div>;

  const aiPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#0b0811]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-violet/15 text-violet"><WandSparkles size={16} /></span><div><div className="text-sm font-semibold text-white">AI Edit</div><div className="text-[10px] text-text-muted">Understands your real project</div></div></div><button type="button" className="lg:hidden" onClick={() => setMobileSheet(null)}><X size={18} /></button></div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {!chat.length && <div className="rounded-xl border border-white/10 bg-white/[.025] p-4 text-xs leading-5 text-text-muted"><div className="font-medium text-white">Try an exact edit</div><p className="mt-2">“Put this picture on the video at 13 seconds on the left and keep it for 4 seconds.”</p><p className="mt-2">Then: “A little smaller.” or “Move it slightly higher.”</p></div>}
        {chat.map((message) => <div key={message.id} className={`rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'ml-6 bg-violet/15 text-white' : 'mr-6 border border-white/10 bg-white/[.035] text-white/85'}`}>{message.text}</div>)}
        {aiOperationId && <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-3 text-xs text-amber-100"><div className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" />AI processing</div><button type="button" onClick={cancelAi} className="mt-2 text-[11px] underline underline-offset-2">Request cancellation</button><p className="mt-2 text-[10px] leading-4 text-amber-100/60">Processing that already started may still consume the reserved credits.</p></div>}
        {aiPlan && <div className="rounded-xl border border-violet/30 bg-violet/[.07] p-3"><div className="text-xs font-semibold text-white">AI will</div><div className="mt-2 space-y-1.5 text-[11px] text-white/75">{aiPlan.commands.length ? aiPlan.commands.map((command, index) => <div key={index}>• {command.label || command.type}</div>) : <div>• {aiPlan.summary}</div>}</div>{aiPlan.execution === 'paid' && <div className="mt-3 rounded-lg bg-black/25 px-2.5 py-2 text-xs font-semibold text-violet">This edit uses AI — {aiPlan.costCredits} credits</div>}<div className="mt-3 flex gap-2"><button type="button" disabled={aiBusy} onClick={() => void applyCurrentAi()} className="flex-1 rounded-lg bg-violet px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{aiBusy ? 'Applying…' : aiPlan.execution === 'paid' ? `Apply edit — ${aiPlan.costCredits} credits` : 'Apply edit'}</button><button type="button" onClick={() => setAiPlan(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-text-muted">Cancel</button></div></div>}
      </div>
      <div className="border-t border-white/10 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        {!!assets.length && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{assets.slice(0,20).map((asset) => { const selected = aiAttachmentIds.includes(asset.id); return <button type="button" key={asset.id} onClick={() => setAiAttachmentIds((current) => selected ? current.filter((id) => id !== asset.id) : [...current, asset.id].slice(-10))} className={`min-w-max rounded-full border px-2.5 py-1 text-[10px] ${selected ? 'border-violet bg-violet/15 text-white' : 'border-white/10 text-text-muted'}`}>{selected ? '✓ ' : ''}{asset.name}</button>; })}</div>}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[.035] p-2 focus-within:border-violet/40"><textarea value={aiInstruction} onChange={(event) => setAiInstruction(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendAi(); } }} rows={2} placeholder="Tell AI exactly what to edit…" className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-white outline-none placeholder:text-white/30" /><button type="button" disabled={aiBusy || !aiInstruction.trim()} onClick={() => void sendAi()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet text-white disabled:opacity-35"><Send size={16} /></button></div>
      </div>
    </div>
  );

  return (
    <div
      className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#060409] text-text-primary"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFiles(Array.from(event.dataTransfer.files)); }}
    >
      <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg" onChange={(event) => { void handleFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#09060d]/95 px-2 backdrop-blur-xl sm:px-3">
        <Link href="/studio" aria-label="Back to Studio" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white"><ArrowLeft size={18} /></Link>
        <button type="button" onClick={() => setRenameOpen(true)} className="min-w-0 max-w-[40vw] rounded-lg px-2 py-1 text-left hover:bg-white/5"><div className="truncate text-sm font-semibold text-white">{title}</div><div className="hidden text-[9px] text-text-muted sm:block">{state.canvas.aspectRatio} · {formatTime(state.duration)}</div></button>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-1 hidden items-center gap-1 text-[10px] text-text-muted sm:flex">{saveState === 'saving' ? <Loader2 size={11} className="animate-spin" /> : saveState === 'saved' ? <Check size={11} /> : <Save size={11} />}{saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : saveState === 'offline' ? 'Offline copy' : 'Unsaved'}</div>
          <MiniButton label="Undo" onClick={() => void doHistory('undo')} disabled={dirty}><Undo2 size={15} /></MiniButton>
          <MiniButton label="Redo" onClick={() => void doHistory('redo')} disabled={dirty}><Redo2 size={15} /></MiniButton>
          <button type="button" onClick={() => setMobileSheet('ai')} className="hidden min-h-9 items-center gap-1.5 rounded-lg border border-violet/30 bg-violet/[.08] px-3 text-xs font-medium text-violet sm:flex lg:hidden"><Sparkles size={14} />AI Edit</button>
          <button type="button" onClick={() => setExportOpen(true)} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90"><Download size={14} /><span className="hidden sm:inline">Export</span></button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <aside className="hidden w-[300px] shrink-0 border-r border-white/10 bg-[#0a0710] lg:block">{leftContent}</aside>
        <section className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(105,67,190,.10),transparent_55%)] p-3 sm:p-5">
            <div className="mx-auto flex h-full max-w-5xl items-center justify-center">
              <div ref={canvasRef} style={{ aspectRatio: canvasAspect, background: state.canvas.background }} className="relative max-h-full max-w-full overflow-hidden rounded-lg shadow-2xl shadow-black/60 ring-1 ring-white/10" onPointerDown={() => setState((current) => current ? { ...current, selectedLayerId: null } : current)}>
                <div className="absolute inset-0" />
                {visibleLayers.map((layer) => {
                  const selected = layer.id === state.selectedLayerId;
                  const asset = layer.assetId ? assetsById.get(layer.assetId) : null;
                  const commonStyle: React.CSSProperties = {
                    position: 'absolute', left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, width: `${layer.width * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${layer.rotation}deg)`, opacity: layer.opacity,
                    filter: visualFilter(layer), zIndex: state.layers.indexOf(layer) + 1,
                  };
                  if (layer === primaryVideoLayer && asset) {
                    return <div key={layer.id} style={{ ...commonStyle, width: `${Math.max(layer.width,1) * 100}%`, height: `${Math.max(layer.height,1) * 100}%` }} onPointerDown={(event) => canvasPointerDown(event, layer)} className={selected ? 'ring-2 ring-violet' : ''}><video ref={primaryVideoRef} src={asset.storage_url} muted={layer.volume === 0} playsInline preload="metadata" onTimeUpdate={(event) => { if (playing) setPlayhead(clamp(event.currentTarget.currentTime + layer.start, 0, state.duration)); }} onEnded={() => setPlaying(false)} className="h-full w-full object-contain" /></div>;
                  }
                  if ((layer.type === 'image' || layer.type === 'video') && asset) {
                    return <div key={layer.id} style={commonStyle} onPointerDown={(event) => canvasPointerDown(event, layer)} className={`group ${selected ? 'ring-2 ring-violet' : ''}`}>{layer.type === 'image' ? <img src={asset.storage_url} alt="" draggable={false} className="block h-auto w-full select-none object-contain" /> : <video src={asset.storage_url} muted playsInline className="block h-auto w-full object-contain" />}{selected && <button type="button" aria-label="Resize" onPointerDown={(event) => resizePointerDown(event, layer)} className="absolute -bottom-2 -right-2 size-4 rounded-full border-2 border-white bg-violet shadow" />}</div>;
                  }
                  if (layer.type === 'text') {
                    return <div key={layer.id} style={{ ...commonStyle, ...textStyle(layer), width: `${layer.width * 100}%`, minWidth: 40, whiteSpace: 'pre-wrap', lineHeight: 1.08 }} onPointerDown={(event) => canvasPointerDown(event, layer)} className={`cursor-move select-none ${selected ? 'outline outline-2 outline-violet outline-offset-3' : ''}`}>{layer.text}{selected && <button type="button" aria-label="Resize" onPointerDown={(event) => resizePointerDown(event, layer)} className="absolute -bottom-2 -right-2 size-4 rounded-full border-2 border-white bg-violet shadow" />}</div>;
                  }
                  return null;
                })}
                {!visibleLayers.length && <div className="absolute inset-0 grid place-items-center p-8 text-center text-white/35"><div><Upload className="mx-auto" size={28} /><div className="mt-3 text-sm font-medium">Drop media here</div><div className="mt-1 text-[11px]">or use Media to start</div></div></div>}
              </div>
            </div>
            {dragging && <div className="absolute inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-violet bg-violet/15 text-center backdrop-blur-sm"><div><Upload className="mx-auto text-violet" size={34} /><div className="mt-3 font-semibold text-white">Drop media into Studio</div><div className="mt-1 text-xs text-white/60">Uploads are free. AI credits are only used for paid AI operations.</div></div></div>}
          </div>

          <div className="shrink-0 border-t border-white/10 bg-[#0a0710]">
            <div className="flex h-11 items-center gap-2 border-b border-white/10 px-3">
              <button type="button" onClick={() => setPlaying((value) => !value)} className="grid size-8 place-items-center rounded-full bg-white text-black">{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-px" />}</button>
              <span className="w-[96px] text-xs tabular-nums text-white/80">{formatTime(playhead)} <span className="text-white/35">/ {formatTime(state.duration)}</span></span>
              <input type="range" min={0} max={duration} step="0.01" value={clamp(playhead,0,duration)} onChange={(event) => { const value = Number(event.currentTarget.value); setPlayhead(value); if (primaryVideoRef.current && primaryVideoLayer) primaryVideoRef.current.currentTime = clamp(value - primaryVideoLayer.start + primaryVideoLayer.trimStart, 0, primaryVideoRef.current.duration || 99999); }} className="min-w-0 flex-1 accent-violet" />
              <div className="hidden items-center gap-1 sm:flex"><ZoomOut size={12} className="text-text-muted" /><input type="range" min={.5} max={4} step={.25} value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.currentTarget.value))} className="w-20 accent-violet" /><ZoomIn size={12} className="text-text-muted" /></div>
            </div>
            <div className="h-[152px] overflow-auto sm:h-[180px]">
              <div className="relative min-w-full" style={{ width: `${Math.max(100, timelineZoom * 100)}%` }}>
                <div className="sticky top-0 z-10 flex h-5 border-b border-white/5 bg-[#0a0710]/95 text-[9px] text-white/35">{Array.from({ length: Math.max(2, Math.ceil(duration / 5) + 1) }, (_, index) => { const sec = Math.min(duration, index * 5); return <span key={index} className="absolute" style={{ left: `${(sec / duration) * 100}%` }}>{sec}s</span>; })}</div>
                <div className="relative py-1.5">
                  <div className="pointer-events-none absolute inset-y-0 z-30 w-px bg-violet" style={{ left: `${(playhead / duration) * 100}%` }} />
                  {state.layers.map((layer, index) => {
                    const left = (layer.start / duration) * 100;
                    const width = Math.max(.6, ((layer.end - layer.start) / duration) * 100);
                    const selected = layer.id === state.selectedLayerId;
                    return <div key={layer.id} className="relative h-7 border-b border-white/[.035]"><button type="button" onClick={() => { selectLayer(layer.id); setPlayhead(clamp(layer.start,0,duration)); }} style={{ left: `${left}%`, width: `${width}%` }} className={`absolute inset-y-1 flex min-w-4 items-center gap-1 overflow-hidden rounded-md border px-1.5 text-[9px] transition ${selected ? 'border-violet bg-violet/25 text-white' : layer.type === 'audio' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : layer.type === 'text' ? 'border-amber-400/20 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-white/[.07] text-white/70'}`} title={`${layer.name} · ${formatTime(layer.start)}–${formatTime(layer.end)}`}>{layer.type === 'audio' ? <Music2 size={10} /> : layer.type === 'text' ? <TextCursorInput size={10} /> : layer.type === 'video' ? <Film size={10} /> : <ImageIcon size={10} />}<span className="truncate">{layer.name}</span></button></div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
        <aside className="hidden w-[310px] shrink-0 border-l border-white/10 bg-[#0a0710] xl:block">{mobileSheet === 'ai' || activeTool === 'ai' ? aiPanel : <div className="h-full overflow-y-auto"><div className="border-b border-white/10 px-4 py-3 text-xs font-semibold text-white">Inspector</div>{inspector}</div>}</aside>
      </main>

      <nav className="z-30 flex h-14 shrink-0 items-center justify-around border-t border-white/10 bg-[#0a0710] px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {([
          ['media', ImageIcon, 'Edit'], ['ai', Sparkles, 'AI Edit'], ['text', TextCursorInput, 'Text'], ['audio', Music2, 'Audio'], ['captions', Captions, 'Captions'], ['canvas', Maximize2, 'Canvas'],
        ] as const).map(([tool, Icon, label]) => <button key={tool} type="button" onClick={() => { setActiveTool(tool); setMobileSheet(tool === 'ai' ? 'ai' : tool); }} className={`flex min-w-[52px] flex-col items-center gap-1 rounded-lg py-1 text-[9px] ${activeTool === tool ? 'text-violet' : 'text-text-muted'}`}><Icon size={16} />{label}</button>)}
        {selectedLayer && <button type="button" onClick={() => setMobileSheet('inspector')} className="flex min-w-[52px] flex-col items-center gap-1 rounded-lg py-1 text-[9px] text-text-muted"><SlidersHorizontal size={16} />Adjust</button>}
      </nav>

      {mobileSheet && <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] lg:hidden" onPointerDown={(event) => { if (event.currentTarget === event.target) setMobileSheet(null); }}><div className={`absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0a0710] shadow-2xl ${mobileSheet === 'ai' ? 'h-[76dvh]' : 'h-[62dvh]'}`}><div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />{mobileSheet === 'ai' ? aiPanel : mobileSheet === 'inspector' ? <div className="h-full overflow-y-auto pb-8"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Adjust<button type="button" onClick={() => setMobileSheet(null)}><X size={18} /></button></div>{inspector}</div> : <div className="h-full overflow-y-auto pb-8"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">{mobileSheet[0].toUpperCase() + mobileSheet.slice(1)}<button type="button" onClick={() => setMobileSheet(null)}><X size={18} /></button></div>{leftContent}</div>}</div></div>}

      {exportOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onPointerDown={(event) => { if (event.currentTarget === event.target) setExportOpen(false); }}><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0911] p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Export</h2><p className="mt-1 text-xs text-text-muted">Final render uses source-quality media + your edit instructions.</p></div><button type="button" onClick={() => setExportOpen(false)}><X size={18} /></button></div><div className="mt-5 grid grid-cols-3 gap-2">{(['720p','1080p','4k'] as const).map((resolution) => <button type="button" key={resolution} onClick={() => setExportResolution(resolution)} className={`rounded-xl border p-3 text-sm font-semibold ${exportResolution === resolution ? 'border-violet bg-violet/15 text-white' : 'border-white/10 text-text-muted'}`}>{resolution}<span className="mt-1 block text-[9px] font-normal opacity-60">{resolution === '720p' ? 'Free export' : resolution === '1080p' ? 'Paid plans' : 'Pro / Agency'}</span></button>)}</div>{exportState && <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3"><div className="flex items-center justify-between text-xs"><span className="capitalize text-white">{exportState.status}</span><span className="tabular-nums text-text-muted">{exportState.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-violet transition-all" style={{ width: `${exportState.progress}%` }} /></div>{exportState.error && <p className="mt-2 text-xs text-red-300">{exportState.error}</p>}{exportState.url && <a href={`${exportState.url}&download=1`} className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black"><Download size={14} />Download file</a>}</div>}<button type="button" onClick={() => void startExport()} disabled={Boolean(exportState && !['completed','failed','cancelled'].includes(exportState.status))} className="mt-4 w-full rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{exportState && !['completed','failed','cancelled'].includes(exportState.status) ? 'Rendering…' : 'Start export'}</button></div></div>}

      {renameOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onPointerDown={(event) => { if (event.currentTarget === event.target) setRenameOpen(false); }}><form onSubmit={(event) => { event.preventDefault(); setRenameOpen(false); markDirty('Renamed project'); }} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0911] p-5"><label className="text-xs text-text-muted">Project title<input autoFocus value={title} maxLength={120} onChange={(event) => setTitle(event.currentTarget.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-violet/45" /></label><button type="submit" className="mt-4 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black">Save title</button></form></div>}
    </div>
  );
}
