import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Film,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Menu,
  MonitorPlay,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Send,
  Sparkles,
  TextCursorInput,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, fetchMe, fetchUserJobs, type UserJobSummary } from '@/lib/api-client';
import { useSeo } from '@/lib/useSeo';
import {
  applyStudioEdit,
  assetToLayer,
  cancelStudioOperation,
  createStudioExport,
  createStudioProject,
  fetchStudioExport,
  fetchStudioOperation,
  fetchStudioProject,
  importStudioJob,
  listStudioProjects,
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
  type StudioUploadProgress,
} from '@/lib/studio-api';

const EDIT_IDEAS = [
  { label: 'Logo at 13s', prompt: 'Put the attached logo on the left at 13 seconds for 4 seconds', needsAsset: true },
  { label: 'Smaller overlay', prompt: 'Make it slightly smaller', needsAsset: false },
  { label: 'Move higher', prompt: 'Move it slightly higher', needsAsset: false },
  { label: 'Vertical TikTok', prompt: 'Make this a 15-second TikTok vertical video', needsAsset: false },
  { label: 'CTA title', prompt: 'Finish with text "Shop now"', needsAsset: false },
  { label: 'Remove background', prompt: 'Remove the background from the selected image', needsAsset: false },
  { label: 'Luxury background', prompt: 'Replace the background with a premium dark luxury studio background', needsAsset: false },
  { label: 'Clean product light', prompt: 'Edit this image and relight it as premium ecommerce product photography', needsAsset: false },
  { label: 'Upscale image', prompt: 'Upscale the selected image and increase the resolution', needsAsset: false },
  { label: 'Erase object', prompt: 'Erase the object from the selected image and fill the area naturally', needsAsset: false },
  { label: 'New hero image', prompt: 'Generate a new image of a premium product pedestal with cinematic studio lighting', needsAsset: false },
] as const;

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg';

type Account = Awaited<ReturnType<typeof fetchMe>>;
type RightTab = 'ai' | 'inspector';
type LeftTab = 'media' | 'projects';
type ExportStatus = { id: string; status: string; progress: number; url: string | null; error: string | null } | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function assetIcon(asset: StudioAsset) {
  if (asset.mime_type.startsWith('video/')) return Film;
  if (asset.mime_type.startsWith('audio/')) return Music2;
  return ImageIcon;
}

function projectLabel(project: Omit<StudioProject, 'assets'>) {
  return `${project.kind === 'video' ? `${Math.round(project.durationSeconds)}s` : 'Image'} · ${project.aspectRatio}`;
}

function applyMediaRatio(state: StudioProjectState, asset: StudioAsset) {
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  if (!width || !height || state.layers.some((layer) => layer.type === 'video' || layer.type === 'image')) return state;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) {
    state.canvas = { ...state.canvas, width: 1080, height: 1080, aspectRatio: '1:1' };
  } else if (ratio > 1) {
    state.canvas = { ...state.canvas, width: 1920, height: 1080, aspectRatio: '16:9' };
  } else {
    state.canvas = { ...state.canvas, width: 1080, height: 1920, aspectRatio: '9:16' };
  }
  return state;
}

function LayerThumb({ asset }: { asset: StudioAsset }) {
  if (asset.mime_type.startsWith('image/')) return <img src={asset.storage_url} alt="" className="h-full w-full object-cover" draggable={false} />;
  if (asset.mime_type.startsWith('video/')) return <video src={`${asset.storage_url}#t=0.001`} muted playsInline preload="metadata" className="h-full w-full object-cover" />;
  const Icon = assetIcon(asset);
  return <div className="grid h-full place-items-center bg-white/[.035]"><Icon size={20} className="text-violet" /></div>;
}

function Slider({ label, value, min, max, step = 0.01, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-text-muted"><span>{label}</span><span className="tabular-nums text-white/70">{Number(value.toFixed(step < 1 ? 2 : 0))}{suffix}</span></div>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.currentTarget.value))} className="w-full accent-violet" />
    </label>
  );
}

export function StudioWorkspacePage() {
  const [, params] = useRoute('/studio/project/:projectId');
  const routeProjectId = params?.projectId ?? null;
  const [, navigate] = useLocation();
  useSeo({ title: 'AI Video & Image Editor | AiWebVideo', description: 'Edit videos and images with timeline, layers and AI Edit.', path: routeProjectId ? `/studio/project/${routeProjectId}` : '/studio', noindex: true });

  const [account, setAccount] = useState<Account | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const [projects, setProjects] = useState<Array<Omit<StudioProject, 'assets'>>>([]);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [state, setState] = useState<StudioProjectState | null>(null);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [revision, setRevision] = useState(1);
  const revisionRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('projects');
  const [rightTab, setRightTab] = useState<RightTab>('ai');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyVersion = useRef(0);
  const pendingLabel = useRef('Edit');
  const [saveLabel, setSaveLabel] = useState<'saved' | 'saving' | 'error'>('saved');
  const [uploadProgress, setUploadProgress] = useState<StudioUploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiAttachmentIds, setAiAttachmentIds] = useState<string[]>([]);
  const [aiPlan, setAiPlan] = useState<StudioEditPlan | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOperationId, setAiOperationId] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState('Describe an edit in plain English. Precise timeline edits are free; generative AI shows the exact credit cost first.');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportResolution, setExportResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [exportState, setExportState] = useState<ExportStatus>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedLayer = useMemo(() => state?.layers.find((layer) => layer.id === state.selectedLayerId) ?? null, [state]);
  const doneJobs = useMemo(() => jobs.filter((job) => job.status === 'done').slice(0, 30), [jobs]);

  const refreshLists = useCallback(async () => {
    const [me, studio, history] = await Promise.all([fetchMe(), listStudioProjects(), fetchUserJobs()]);
    setAccount(me);
    setProjects(studio.projects);
    setJobs(history.jobs);
    setSignedIn(true);
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    setLoadingProject(true);
    try {
      const loaded = await fetchStudioProject(projectId);
      setProject(loaded);
      setState(loaded.projectState);
      setAssets(loaded.assets);
      setRevision(loaded.revision);
      revisionRef.current = loaded.revision;
      setPlayhead(0);
      setDirty(false);
      setSaveLabel('saved');
      setLeftTab('media');
      void trackStudioEvent({ event: 'studio_opened', projectId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open editor project.');
      setProject(null);
      setState(null);
      setAssets([]);
    } finally {
      setLoadingProject(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refreshLists()
      .then(async () => {
        if (!cancelled && routeProjectId) {
          await loadProject(routeProjectId);
        }
      })
      .catch(() => { if (!cancelled) setSignedIn(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [routeProjectId, loadProject, refreshLists]);

  const markState = useCallback((next: StudioProjectState, label: string) => {
    setState(next);
    pendingLabel.current = label;
    dirtyVersion.current += 1;
    setDirty(true);
    setSaveLabel('saving');
  }, []);

  const updateState = useCallback((mutator: (draft: StudioProjectState) => void, label: string) => {
    setState((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      mutator(next);
      pendingLabel.current = label;
      dirtyVersion.current += 1;
      setDirty(true);
      setSaveLabel('saving');
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dirty || !state || !project) return;
    const version = dirtyVersion.current;
    const timer = window.setTimeout(() => {
      void saveStudioProject(project.id, {
        revision: revisionRef.current,
        projectState: state,
        label: pendingLabel.current,
      }).then((saved) => {
        revisionRef.current = saved.revision;
        setRevision(saved.revision);
        setProject((current) => current ? { ...current, ...saved, assets: current.assets } : current);
        if (dirtyVersion.current === version) {
          setDirty(false);
          setSaveLabel('saved');
        }
      }).catch(async (error) => {
        setSaveLabel('error');
        if (error instanceof ApiError && error.status === 409) {
          toast.warning('This editor changed in another tab. Reloading the latest version.');
          await loadProject(project.id);
        }
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [dirty, state, project, loadProject]);

  useEffect(() => {
    if (playing) return;
    for (const layer of state?.layers ?? []) {
      const video = videoRefs.current.get(layer.id);
      const audio = audioRefs.current.get(layer.id);
      const media = video ?? audio;
      if (!media) continue;
      const target = clamp(playhead - layer.start + layer.trimStart, 0, Math.max(0, media.duration || 0));
      if (Number.isFinite(target) && Math.abs(media.currentTime - target) > 0.18) media.currentTime = target;
    }
  }, [playhead, playing, state]);

  useEffect(() => {
    if (!playing || !state) return;
    const primaryVideo = state.layers.find((layer) => layer.type === 'video' && videoRefs.current.has(layer.id));
    if (primaryVideo) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setPlayhead((current) => {
        const next = current + delta;
        if (next >= state.duration) {
          setPlaying(false);
          return state.duration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, state]);

  async function togglePlayback() {
    if (!state) return;
    if (playing) {
      videoRefs.current.forEach((media) => media.pause());
      audioRefs.current.forEach((media) => media.pause());
      setPlaying(false);
      return;
    }
    if (playhead >= state.duration) setPlayhead(0);
    setPlaying(true);
    for (const layer of state.layers) {
      if (playhead < layer.start || playhead > layer.end) continue;
      const media = videoRefs.current.get(layer.id) ?? audioRefs.current.get(layer.id);
      if (!media) continue;
      media.volume = clamp(layer.volume, 0, 1);
      try { await media.play(); } catch { /* browser may require another tap for audio */ }
    }
  }

  function onPrimaryTime(layer: StudioLayer, media: HTMLVideoElement) {
    if (!playing) return;
    const firstVideo = state?.layers.find((item) => item.type === 'video');
    if (firstVideo?.id !== layer.id) return;
    const next = layer.start + Math.max(0, media.currentTime - layer.trimStart);
    setPlayhead(clamp(next, 0, state?.duration ?? next));
    if (next >= layer.end) setPlaying(false);
  }

  async function createBlank(kind: 'video' | 'image') {
    setCreating(kind);
    try {
      const created = await createStudioProject({ kind, aspectRatio: kind === 'video' ? '9:16' : '1:1' });
      await refreshLists();
      navigate(`/studio/project/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create editor project.');
    } finally {
      setCreating(null);
    }
  }

  async function openPast(job: UserJobSummary) {
    setCreating(`job:${job.id}`);
    try {
      const existing = projects.find((item) => item.sourceJobId === job.id);
      const opened = existing ?? await importStudioJob(job.id);
      await refreshLists();
      navigate(`/studio/project/${opened.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open this production in the editor.');
    } finally {
      setCreating(null);
    }
  }

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      if (!project || !state) {
        const kind = files.some((file) => file.type.startsWith('video/')) ? 'video' : 'image';
        const created = await createStudioProject({ kind, title: `${files[0].name.replace(/\.[^.]+$/, '')} edit`, aspectRatio: kind === 'video' ? '9:16' : '1:1' });
        const uploaded = await uploadStudioAssets(created.id, files, { signal: controller.signal, onProgress: setUploadProgress });
        const next = structuredClone(created.projectState);
        for (const asset of uploaded.assets) {
          applyMediaRatio(next, asset);
          const layer = assetToLayer(asset, next, 0);
          next.layers.push(layer);
          if (!next.selectedLayerId) next.selectedLayerId = layer.id;
          if (layer.type === 'video' || layer.type === 'audio') next.duration = Math.max(next.duration, layer.end);
        }
        await saveStudioProject(created.id, { revision: created.revision, projectState: next, label: 'Added uploaded media' });
        await refreshLists();
        navigate(`/studio/project/${created.id}`);
        return;
      }

      const uploaded = await uploadStudioAssets(project.id, files, { signal: controller.signal, onProgress: setUploadProgress });
      setAssets((current) => [...current, ...uploaded.assets]);
      const next = structuredClone(state);
      for (const asset of uploaded.assets) {
        applyMediaRatio(next, asset);
        const layer = assetToLayer(asset, next, playhead);
        next.layers.push(layer);
        next.selectedLayerId = layer.id;
        next.duration = Math.max(next.duration, layer.end);
      }
      markState(next, 'Added media');
      setLeftTab('media');
      toast.success(uploaded.assets.length === 1 ? 'Media added to the timeline.' : `${uploaded.assets.length} files added to the timeline.`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      uploadAbort.current = null;
    }
  }

  function addAssetToTimeline(asset: StudioAsset) {
    if (!state) return;
    const next = structuredClone(state);
    const layer = assetToLayer(asset, next, playhead);
    next.layers.push(layer);
    next.selectedLayerId = layer.id;
    next.duration = Math.max(next.duration, layer.end);
    markState(next, `Added ${asset.name}`);
  }

  function addText() {
    if (!state) return;
    const start = playhead;
    const layer: StudioLayer = {
      id: uid('text'), type: 'text', name: 'Text', start, end: Math.min(Math.max(state.duration, start + 3), start + 5),
      trimStart: 0, trimEnd: null, x: .5, y: .5, width: .72, height: .16, rotation: 0, opacity: 1, volume: 1, speed: 1,
      text: 'Your text', style: { fontSize: 64, weight: 700, color: '#ffffff', align: 'center' }, effects: [], transitionIn: null, transitionOut: null,
    };
    const next = structuredClone(state);
    next.layers.push(layer);
    next.selectedLayerId = layer.id;
    next.duration = Math.max(next.duration, layer.end);
    markState(next, 'Added text');
  }

  function patchSelected(patch: Partial<StudioLayer>, label: string) {
    if (!selectedLayer) return;
    updateState((draft) => {
      const layer = draft.layers.find((item) => item.id === selectedLayer.id);
      if (layer) Object.assign(layer, patch);
    }, label);
  }

  function duplicateSelected() {
    if (!selectedLayer) return;
    updateState((draft) => {
      const source = draft.layers.find((item) => item.id === selectedLayer.id);
      if (!source) return;
      const copy = { ...structuredClone(source), id: uid('copy'), name: `${source.name} copy`, x: clamp(source.x + .04, .05, .95), y: clamp(source.y + .04, .05, .95) };
      draft.layers.push(copy);
      draft.selectedLayerId = copy.id;
    }, 'Duplicated layer');
  }

  function deleteSelected() {
    if (!selectedLayer) return;
    updateState((draft) => {
      draft.layers = draft.layers.filter((item) => item.id !== selectedLayer.id);
      draft.selectedLayerId = null;
    }, 'Deleted layer');
  }

  function splitSelected() {
    if (!selectedLayer || selectedLayer.type !== 'video' || playhead <= selectedLayer.start || playhead >= selectedLayer.end) return;
    updateState((draft) => {
      const layer = draft.layers.find((item) => item.id === selectedLayer.id);
      if (!layer) return;
      const clone = structuredClone(layer);
      clone.id = uid('split');
      clone.name = `${layer.name} B`;
      clone.start = playhead;
      clone.trimStart = layer.trimStart + (playhead - layer.start);
      layer.end = playhead;
      draft.layers.push(clone);
      draft.selectedLayerId = clone.id;
    }, 'Split clip');
  }

  async function history(direction: 'undo' | 'redo') {
    if (!project) return;
    try {
      setDirty(false);
      const result = await studioHistory(project.id, direction);
      setState(result.projectState);
      setRevision(result.revision);
      revisionRef.current = result.revision;
      setSaveLabel('saved');
    } catch (error) {
      toast.message(error instanceof Error ? error.message : `Nothing to ${direction}.`);
    }
  }

  async function planAi() {
    if (!project || !aiInstruction.trim()) return;
    setAiBusy(true);
    try {
      const plan = await planStudioEdit(project.id, aiInstruction.trim(), aiAttachmentIds);
      setAiPlan(plan);
      setAiNote(plan.execution === 'paid'
        ? `${plan.summary}. This uses generative AI and costs ${plan.costCredits} credits.`
        : `${plan.summary}. This is a precise local timeline edit and costs 0 credits.`);
    } catch (error) {
      setAiPlan(null);
      setAiNote(error instanceof Error ? error.message : 'I could not understand that edit.');
    } finally {
      setAiBusy(false);
    }
  }

  async function applyAi() {
    if (!project || !aiPlan || !aiInstruction.trim()) return;
    if (aiPlan.execution === 'paid' && (account?.creditsBalance ?? 0) < aiPlan.costCredits) {
      setAiNote(`You need ${aiPlan.costCredits} credits for this AI edit. Add credits before it starts; nothing has been charged.`);
      return;
    }
    setAiBusy(true);
    try {
      const result = await applyStudioEdit(project.id, aiInstruction.trim(), aiAttachmentIds, crypto.randomUUID());
      if (result.project) {
        setProject(result.project);
        setState(result.project.projectState);
        setAssets(result.project.assets);
        setRevision(result.project.revision);
        revisionRef.current = result.project.revision;
        setAiNote('Done. The edit is on your timeline and remains editable.');
        setAiInstruction('');
        setAiPlan(null);
        return;
      }
      if (result.operationId) {
        setAiOperationId(result.operationId);
        setAiNote(`AI processing started${result.requiredCredits ? ` · ${result.requiredCredits} credits reserved` : ''}. Your current version stays safe until the new result succeeds.`);
        setAiPlan(null);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_CREDITS') {
        setAiNote(`${error.message} Nothing was charged.`);
      } else {
        setAiNote(error instanceof Error ? error.message : 'The AI edit could not start.');
      }
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    if (!aiOperationId || !project) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const operation = await fetchStudioOperation(aiOperationId);
        if (cancelled) return;
        if (operation.status === 'completed') {
          setAiNote('AI edit completed. The result was added non-destructively and the original remains available.');
          setAiOperationId(null);
          await Promise.all([loadProject(project.id), refreshLists()]);
          return;
        }
        if (operation.status === 'failed' || operation.status === 'cancelled') {
          setAiNote(operation.error || 'The AI edit stopped. Your previous project state is unchanged.');
          setAiOperationId(null);
          await refreshLists();
          return;
        }
        timer = window.setTimeout(poll, 1800);
      } catch {
        timer = window.setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [aiOperationId, project, loadProject, refreshLists]);

  async function stopAi() {
    if (!aiOperationId) return;
    try {
      const result = await cancelStudioOperation(aiOperationId);
      setAiNote(result.warning);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not request cancellation.');
    }
  }

  async function startExport() {
    if (!project || (exportState && !['completed', 'failed', 'cancelled'].includes(exportState.status))) return;
    try {
      const result = await createStudioExport(project.id, exportResolution, project.kind === 'image' ? 'png' : 'mp4');
      setExportState({ id: result.exportId, status: result.status, progress: 0, url: null, error: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start export.');
    }
  }

  useEffect(() => {
    if (!exportState?.id || ['completed', 'failed', 'cancelled'].includes(exportState.status)) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const result = await fetchStudioExport(exportState.id);
        if (cancelled) return;
        setExportState({ id: result.id, status: result.status, progress: result.progress, url: result.storage_url, error: result.error });
        if (result.status === 'completed') {
          void trackStudioEvent({ event: 'studio_exported', projectId: project?.id, metadata: { resolution: result.resolution, format: result.format } });
          return;
        }
        if (!['failed', 'cancelled'].includes(result.status)) timer = window.setTimeout(poll, 1500);
      } catch {
        timer = window.setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [exportState?.id, exportState?.status, project?.id]);

  function selectIdea(prompt: string, needsAsset: boolean) {
    setRightTab('ai');
    setRightOpen(true);
    setAiInstruction(prompt);
    setAiPlan(null);
    if (needsAsset && !aiAttachmentIds.length) {
      const preferred = assets.find((asset) => asset.kind === 'logo') ?? assets.find((asset) => asset.mime_type.startsWith('image/'));
      if (preferred) setAiAttachmentIds([preferred.id]);
      else setAiNote('Upload or choose an image/logo first, then use this edit idea.');
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#090710] text-text-muted"><Loader2 className="animate-spin" /></div>;

  if (!signedIn) return (
    <div className="grid min-h-screen place-items-center bg-[#090710] px-5">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#120e1d] p-7 text-center shadow-2xl">
        <Layers3 className="mx-auto text-violet" size={34} />
        <h1 className="mt-4 text-2xl font-semibold text-white">Sign in to open the editor</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">Your uploaded media, edits and exports stay private in your AiWebVideo account.</p>
        <Link href="/?signin=1" className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 text-sm font-semibold text-white">Sign in</Link>
      </div>
    </div>
  );

  const duration = Math.max(.1, state?.duration ?? 1);
  const visibleLayers = state?.layers.filter((layer) => playhead >= layer.start && playhead <= layer.end) ?? [];
  const canvasStyle: CSSProperties = state ? { aspectRatio: `${state.canvas.width} / ${state.canvas.height}`, background: state.canvas.background } : { aspectRatio: '9 / 16' };
  const paidBlocked = Boolean(aiPlan?.execution === 'paid' && (account?.creditsBalance ?? 0) < (aiPlan?.costCredits ?? 0));

  return (
    <div className="flex h-[100dvh] min-h-[680px] flex-col overflow-hidden bg-[#090710] text-text-primary">
      <input ref={fileInputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(event) => { void addFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />

      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/[.08] bg-[#0c0913]/95 px-2.5 backdrop-blur-xl sm:px-4">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/5" title="AiWebVideo home">
          <img src="/logo.svg" alt="AiWebVideo" className="h-7 w-7" />
          <span className="hidden text-sm font-semibold text-white sm:inline">AiWebVideo</span>
        </Link>
        <span className="hidden text-white/15 sm:inline">/</span>
        <button type="button" onClick={() => { setLeftTab('projects'); setLeftOpen(true); }} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-white/80 hover:bg-white/5 sm:flex"><Layers3 size={14} className="text-violet" />Editor</button>

        <div className="mx-1 h-5 w-px bg-white/10" />
        <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] text-text-muted transition hover:bg-white/5 hover:text-white md:flex"><ArrowLeft size={13} />Workspace</Link>
        <Link href="/?create=video#generate" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] text-text-muted transition hover:bg-white/5 hover:text-white md:flex"><Sparkles size={13} />Generate</Link>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-xs font-semibold text-white">{project?.title ?? 'AI Video & Image Editor'}</div>
          <div className="mt-0.5 text-[8px] text-text-dim">{project ? `${project.kind} · ${state?.canvas.aspectRatio ?? project.aspectRatio} · rev ${revision}` : 'Upload media or choose a past production'}</div>
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <button type="button" onClick={() => void history('undo')} disabled={!project} className="grid h-9 w-9 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-25" title="Undo"><Undo2 size={15} /></button>
          <button type="button" onClick={() => void history('redo')} disabled={!project} className="grid h-9 w-9 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-25" title="Redo"><Redo2 size={15} /></button>
          <span className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[9px] ${saveLabel === 'error' ? 'text-pink' : saveLabel === 'saving' ? 'text-amber-200' : 'text-text-dim'}`}><Save size={11} />{saveLabel === 'saving' ? 'Saving…' : saveLabel === 'error' ? 'Save issue' : 'Saved'}</span>
        </div>

        <button type="button" onClick={() => { setRightTab('ai'); setRightOpen(true); }} disabled={!project} className="hidden h-9 items-center gap-1.5 rounded-xl border border-violet/25 bg-violet/[.09] px-3 text-[10px] font-semibold text-violet transition hover:bg-violet/[.15] disabled:opacity-30 lg:flex"><WandSparkles size={13} />AI Edit</button>
        <span className="hidden rounded-full border border-white/[.08] bg-white/[.035] px-2.5 py-1.5 text-[9px] font-semibold text-white/70 lg:inline">{account?.creditsBalance ?? 0} credits</span>
        <button type="button" onClick={() => setExportOpen((value) => !value)} disabled={!project} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-bold text-black transition hover:bg-white/90 disabled:opacity-35"><Download size={13} />Export</button>
        <button type="button" onClick={() => setLeftOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white lg:hidden" title="Menu"><Menu size={17} /></button>
      </header>

      {uploading && uploadProgress && (
        <div className="z-40 shrink-0 border-b border-violet/20 bg-[#130d20] px-3 py-2 sm:px-5">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet/10 text-violet"><Upload size={14} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-[10px]"><span className="truncate font-semibold text-white">{uploadProgress.phase === 'processing' ? 'Processing media' : `Uploading ${uploadProgress.fileName}`}</span><span className="tabular-nums text-violet">{uploadProgress.overallProgress}%</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-violet transition-[width] duration-300" style={{ width: `${uploadProgress.overallProgress}%` }} /></div>
              <div className="mt-1 flex justify-between text-[8px] text-text-dim"><span>{formatBytes(uploadProgress.uploadedBytes)} / {formatBytes(uploadProgress.totalBytes)}</span><span>{uploadProgress.phase === 'processing' ? 'Checking video and preparing preview…' : 'Large videos upload in safe chunks'}</span></div>
            </div>
            <button type="button" onClick={() => uploadAbort.current?.abort()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white" title="Cancel upload"><X size={14} /></button>
          </div>
        </div>
      )}

      {exportOpen && project && (
        <div className="absolute right-3 top-16 z-50 w-[min(92vw,330px)] rounded-2xl border border-white/10 bg-[#151021] p-4 shadow-2xl">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Export project</p><p className="mt-0.5 text-[9px] text-text-dim">Server-rendered from your timeline</p></div><button onClick={() => setExportOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-white/5"><X size={14} /></button></div>
          <div className="mt-4 grid grid-cols-3 gap-2">{(['720p','1080p','4k'] as const).map((value) => <button key={value} onClick={() => setExportResolution(value)} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${exportResolution === value ? 'border-violet/55 bg-violet/15 text-white' : 'border-white/10 text-text-muted'}`}>{value === '4k' ? '4K' : value}</button>)}</div>
          {exportState && <div className="mt-3 rounded-xl bg-black/20 p-3 text-[10px] text-text-muted"><div className="flex justify-between"><span>{exportState.status}</span><span>{exportState.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-violet" style={{ width: `${exportState.progress}%` }} /></div>{exportState.error && <p className="mt-2 text-pink">{exportState.error}</p>}{exportState.url && <a href={`${exportState.url}&download=1`} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-violet"><Download size={12} />Download export</a>}</div>}
          <button type="button" onClick={() => void startExport()} className="mt-3 w-full rounded-xl bg-violet px-3 py-2.5 text-xs font-semibold text-white">Start {exportResolution} export</button>
        </div>
      )}

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={`${leftOpen ? 'flex' : 'hidden'} absolute inset-y-14 left-0 z-40 w-[88vw] max-w-[330px] flex-col border-r border-white/[.08] bg-[#0d0a14] shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:flex lg:w-[280px] lg:shadow-none xl:w-[300px]`}>
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/[.08] p-2">
            <button onClick={() => setLeftTab('projects')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold ${leftTab === 'projects' ? 'bg-violet/12 text-violet' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}><FolderOpen size={13} />Projects</button>
            <button onClick={() => setLeftTab('media')} disabled={!project} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold disabled:opacity-25 ${leftTab === 'media' ? 'bg-violet/12 text-violet' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}><ImageIcon size={13} />Media</button>
            <button onClick={() => setLeftOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-white/5 lg:hidden"><X size={14} /></button>
          </div>

          {leftTab === 'projects' ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-xl border border-violet/25 bg-violet/[.07] p-3 text-left hover:bg-violet/[.11]"><Upload size={16} className="text-violet" /><div className="mt-2 text-[11px] font-semibold text-white">Upload & edit</div><div className="mt-1 text-[8px] text-text-dim">Video, image or audio</div></button>
                <button onClick={() => void createBlank('video')} disabled={Boolean(creating)} className="rounded-xl border border-white/10 bg-white/[.025] p-3 text-left hover:bg-white/[.045]"><Plus size={16} className="text-mint" /><div className="mt-2 text-[11px] font-semibold text-white">New project</div><div className="mt-1 text-[8px] text-text-dim">Blank timeline</div></button>
              </div>

              <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-text-dim">Editor projects</p><span className="text-[8px] text-text-dim">{projects.length}</span></div>
              <div className="mt-2 space-y-1.5">
                {projects.slice(0, 12).map((item) => <button key={item.id} onClick={() => navigate(`/studio/project/${item.id}`)} className={`w-full rounded-xl border p-2.5 text-left transition ${item.id === project?.id ? 'border-violet/40 bg-violet/[.09]' : 'border-white/[.06] bg-white/[.018] hover:border-white/10 hover:bg-white/[.035]'}`}><div className="truncate text-[11px] font-semibold text-white">{item.title}</div><div className="mt-1 text-[8px] text-text-dim">{projectLabel(item)}</div></button>)}
                {!projects.length && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[9px] leading-4 text-text-dim">No editor projects yet. Upload media or open a finished production below.</p>}
              </div>

              <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-text-dim">Past productions</p><Clock3 size={12} className="text-text-dim" /></div>
              <p className="mt-1 text-[8px] leading-4 text-text-dim">Open a finished AiWebVideo generation directly in this editor.</p>
              <div className="mt-2 space-y-2">
                {doneJobs.slice(0, 14).map((job) => (
                  <button key={job.id} onClick={() => void openPast(job)} disabled={creating === `job:${job.id}`} className="flex w-full items-center gap-2.5 rounded-xl border border-white/[.06] bg-white/[.018] p-2 text-left transition hover:border-violet/25 hover:bg-violet/[.04] disabled:opacity-50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/30">{job.screenshotUrl ? <img src={job.screenshotUrl} alt="" className="h-full w-full object-cover" /> : <Film size={15} className="text-violet" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-white">{job.title || 'AiWebVideo production'}</span><span className="mt-0.5 block text-[8px] text-text-dim">{job.mode || 'video'} · finished</span></span>
                    {creating === `job:${job.id}` ? <Loader2 size={12} className="animate-spin text-violet" /> : <MonitorPlay size={12} className="text-violet" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet/30 bg-violet/[.055] px-3 py-3 text-[10px] font-semibold text-violet hover:bg-violet/[.1]"><Upload size={14} />{uploading ? 'Uploading…' : 'Upload media'}</button>
              <div className="grid grid-cols-2 gap-2">
                {assets.map((asset) => (
                  <button key={asset.id} onClick={() => addAssetToTimeline(asset)} className="group overflow-hidden rounded-xl border border-white/[.07] bg-white/[.025] text-left transition hover:border-violet/30">
                    <div className="relative aspect-square overflow-hidden"><LayerThumb asset={asset} /><span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100"><Plus size={12} /></span></div>
                    <div className="p-2"><div className="truncate text-[9px] font-medium text-white/85">{asset.name}</div><div className="mt-0.5 text-[7px] text-text-dim">{formatBytes(Number(asset.size_bytes || 0))}</div></div>
                  </button>
                ))}
              </div>
              {!assets.length && <p className="px-3 py-8 text-center text-[9px] leading-5 text-text-dim">Your project media appears here. Uploaded files are private and are placed on the timeline automatically.</p>}
            </div>
          )}
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_12%,rgba(113,73,190,.10),transparent_42%)]">
          {!project || !state ? (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-5 sm:p-8">
              <div className="w-full max-w-3xl text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-violet/25 bg-violet/[.09] text-violet"><Layers3 size={25} /></div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your editor is ready</h1>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-muted">There is no separate Studio landing page anymore. Upload media or choose one of your past productions and it opens directly here on the timeline.</p>
                <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
                  <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-violet/35 bg-violet/[.09] p-5 text-left transition hover:bg-violet/[.14]"><Upload size={19} className="text-violet" /><div className="mt-3 text-sm font-semibold text-white">Upload video or image</div><div className="mt-1 text-[10px] leading-5 text-text-dim">Large videos supported with chunked upload and real progress.</div></button>
                  <button onClick={() => { setLeftTab('projects'); setLeftOpen(true); }} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-left transition hover:bg-white/[.045]"><Clock3 size={19} className="text-mint" /><div className="mt-3 text-sm font-semibold text-white">Use a past production</div><div className="mt-1 text-[10px] leading-5 text-text-dim">Open any finished generation without downloading and re-uploading.</div></button>
                </div>
                <div className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-2 text-[9px] text-text-dim"><span className="rounded-full border border-white/[.07] px-2.5 py-1">Timeline & layers</span><span className="rounded-full border border-white/[.07] px-2.5 py-1">Text & audio</span><span className="rounded-full border border-white/[.07] px-2.5 py-1">AI Edit</span><span className="rounded-full border border-white/[.07] px-2.5 py-1">Undo / redo</span><span className="rounded-full border border-white/[.07] px-2.5 py-1">Export</span></div>
              </div>
            </div>
          ) : loadingProject ? (
            <div className="grid min-h-0 flex-1 place-items-center"><Loader2 className="animate-spin text-violet" /></div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-5 lg:p-7">
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[.06] bg-[#05040a] shadow-[inset_0_0_80px_rgba(0,0,0,.35)]">
                  <div className="relative max-h-[calc(100%-28px)] max-w-[calc(100%-28px)] overflow-hidden rounded-xl border border-white/[.08] shadow-2xl" style={{ ...canvasStyle, height: state.canvas.aspectRatio === '9:16' ? '88%' : 'auto', width: state.canvas.aspectRatio === '9:16' ? 'auto' : state.canvas.aspectRatio === '1:1' ? '72%' : '88%' }}>
                    <div className="absolute inset-0" style={{ background: state.canvas.background }} />
                    {visibleLayers.map((layer) => {
                      const asset = layer.assetId ? assetById.get(layer.assetId) : null;
                      const selected = layer.id === state.selectedLayerId;
                      const baseStyle: CSSProperties = {
                        position: 'absolute',
                        left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
                        width: `${layer.width * 100}%`, height: `${layer.height * 100}%`,
                        transform: `translate(-50%,-50%) rotate(${layer.rotation}deg)`, opacity: layer.opacity,
                        zIndex: state.layers.indexOf(layer) + 1,
                      };
                      return (
                        <button key={layer.id} type="button" onClick={(event) => { event.stopPropagation(); updateState((draft) => { draft.selectedLayerId = layer.id; }, 'Selected layer'); setRightTab('inspector'); }} className={`overflow-hidden ${selected ? 'ring-2 ring-violet ring-offset-2 ring-offset-transparent' : ''}`} style={baseStyle}>
                          {layer.type === 'text' ? <div className="flex h-full w-full items-center justify-center px-2 text-center" style={{ color: String(layer.style.color || '#fff'), fontSize: `${Math.max(12, Number(layer.style.fontSize || 64) * .28)}px`, fontWeight: Number(layer.style.weight || 700) }}>{layer.text}</div> : asset?.mime_type.startsWith('image/') ? <img src={asset.storage_url} alt="" className="h-full w-full object-contain" draggable={false} /> : asset?.mime_type.startsWith('video/') ? <video ref={(node) => { if (node) videoRefs.current.set(layer.id, node); else videoRefs.current.delete(layer.id); }} src={asset.storage_url} muted={layer.volume <= 0} playsInline preload="auto" onTimeUpdate={(event) => onPrimaryTime(layer, event.currentTarget)} className="h-full w-full object-contain" /> : null}
                        </button>
                      );
                    })}
                    {state.layers.filter((layer) => layer.type === 'audio' && layer.assetId).map((layer) => {
                      const asset = assetById.get(layer.assetId!);
                      return asset ? <audio key={layer.id} ref={(node) => { if (node) audioRefs.current.set(layer.id, node); else audioRefs.current.delete(layer.id); }} src={asset.storage_url} preload="auto" /> : null;
                    })}
                    {!visibleLayers.length && <div className="absolute inset-0 grid place-items-center p-5 text-center"><div><ImageIcon size={24} className="mx-auto text-white/15" /><p className="mt-2 text-[10px] text-text-dim">Nothing is visible at {formatTime(playhead)}. Move the playhead or add media.</p></div></div>}
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/[.08] bg-[#0c0913]">
                <div className="flex h-11 items-center gap-2 border-b border-white/[.06] px-3 sm:px-4">
                  <button onClick={() => void togglePlayback()} className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.06] text-white hover:bg-white/[.1]">{playing ? <Pause size={14} /> : <Play size={14} />}</button>
                  <span className="min-w-[72px] text-[10px] tabular-nums text-white/80">{formatTime(playhead)} / {formatTime(state.duration)}</span>
                  <input type="range" min={0} max={duration} step={.02} value={playhead} onChange={(event) => { setPlaying(false); videoRefs.current.forEach((media) => media.pause()); audioRefs.current.forEach((media) => media.pause()); setPlayhead(Number(event.currentTarget.value)); }} className="min-w-0 flex-1 accent-violet" />
                  <button onClick={addText} className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[9px] text-text-muted hover:text-white sm:flex"><TextCursorInput size={12} />Text</button>
                  <button onClick={() => fileInputRef.current?.click()} className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[9px] text-text-muted hover:text-white sm:flex"><Plus size={12} />Media</button>
                </div>
                <div className="h-[150px] overflow-auto p-2.5 sm:h-[170px] sm:p-3">
                  <div className="relative min-w-[660px] space-y-1.5">
                    <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-violet" style={{ left: `${(playhead / duration) * 100}%` }} />
                    {state.layers.length ? state.layers.map((layer) => {
                      const start = (layer.start / duration) * 100;
                      const width = Math.max(.8, ((layer.end - layer.start) / duration) * 100);
                      return <div key={layer.id} className="relative h-8 rounded-lg bg-white/[.025]"><span className="absolute left-2 top-1/2 w-20 -translate-y-1/2 truncate text-[8px] text-text-dim">{layer.name}</span><button onClick={() => { updateState((draft) => { draft.selectedLayerId = layer.id; }, 'Selected layer'); setRightTab('inspector'); setRightOpen(true); }} className={`absolute inset-y-1 rounded-md border px-2 text-left text-[8px] font-medium transition ${state.selectedLayerId === layer.id ? 'border-violet/60 bg-violet/20 text-white' : layer.type === 'audio' ? 'border-mint/20 bg-mint/[.08] text-mint' : 'border-white/10 bg-white/[.055] text-white/70 hover:border-violet/30'}`} style={{ left: `${start}%`, width: `${width}%` }}><span className="block truncate">{layer.type} · {layer.name}</span></button></div>;
                    }) : <div className="grid h-24 place-items-center rounded-xl border border-dashed border-white/10 text-[9px] text-text-dim">Upload media to start your timeline.</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className={`${rightOpen ? 'flex' : 'hidden'} absolute inset-y-14 right-0 z-40 w-[92vw] max-w-[380px] flex-col border-l border-white/[.08] bg-[#0d0a14] shadow-2xl xl:relative xl:inset-auto xl:z-auto xl:flex xl:w-[340px] xl:shadow-none 2xl:w-[370px]`}>
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/[.08] p-2">
            <button onClick={() => setRightTab('ai')} disabled={!project} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold disabled:opacity-25 ${rightTab === 'ai' ? 'bg-violet/12 text-violet' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}><WandSparkles size={13} />AI Edit</button>
            <button onClick={() => setRightTab('inspector')} disabled={!project} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold disabled:opacity-25 ${rightTab === 'inspector' ? 'bg-violet/12 text-violet' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}><Layers3 size={13} />Adjust</button>
            <button onClick={() => setRightOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-white/5 xl:hidden"><X size={14} /></button>
          </div>

          {!project || !state ? <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-[10px] leading-5 text-text-dim">Choose a project first. AI Edit and precise controls will appear here.</div> : rightTab === 'ai' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
                <div className="rounded-2xl border border-violet/20 bg-violet/[.055] p-3.5">
                  <div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet"><Bot size={16} /></span><div><div className="text-[11px] font-semibold text-white">Tell AI exactly what to change</div><div className="mt-1 text-[9px] leading-4 text-text-dim">Example: “put this photo on the left at 13 seconds for 4 seconds.” Free transforms stay local. Generative edits show the price before starting.</div></div></div>
                </div>

                <div className="mt-4 flex items-center justify-between"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-text-dim">Quick edit ideas</p><span className="text-[8px] text-text-dim">Tap to fill</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">{EDIT_IDEAS.map((idea) => <button key={idea.label} onClick={() => selectIdea(idea.prompt, idea.needsAsset)} className="rounded-full border border-white/[.08] bg-white/[.025] px-2.5 py-1.5 text-[8px] font-medium text-white/70 transition hover:border-violet/30 hover:bg-violet/[.07] hover:text-white">{idea.label}</button>)}</div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-text-dim">References</p><span className="text-[8px] text-text-dim">Optional · {aiAttachmentIds.length}/10</span></div>
                  <div className="chat-scroll flex gap-2 overflow-x-auto pb-1">{assets.filter((asset) => asset.mime_type.startsWith('image/')).map((asset) => { const selected = aiAttachmentIds.includes(asset.id); return <button key={asset.id} onClick={() => setAiAttachmentIds((current) => selected ? current.filter((id) => id !== asset.id) : [...current, asset.id].slice(0, 10))} className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${selected ? 'border-violet ring-1 ring-violet' : 'border-white/10'}`}><img src={asset.storage_url} alt="" className="h-full w-full object-cover" />{selected && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-violet text-white"><Check size={9} /></span>}</button>; })}{!assets.some((asset) => asset.mime_type.startsWith('image/')) && <button onClick={() => fileInputRef.current?.click()} className="flex h-14 min-w-36 items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 text-[8px] text-text-dim"><Upload size={11} />Add image reference</button>}</div>
                </div>

                <div className="mt-4 rounded-xl border border-white/[.07] bg-black/20 p-3 text-[9px] leading-4 text-text-muted">{aiNote}</div>

                {aiPlan && (
                  <div className={`mt-3 rounded-xl border p-3 ${aiPlan.execution === 'paid' ? 'border-amber-300/20 bg-amber-300/[.04]' : 'border-mint/20 bg-mint/[.04]'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-white">{aiPlan.execution === 'paid' ? 'Generative AI edit' : 'Timeline edit'}</span><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${aiPlan.execution === 'paid' ? 'bg-amber-300/10 text-amber-200' : 'bg-mint/10 text-mint'}`}>{aiPlan.costCredits} credits</span></div>
                    <p className="mt-2 text-[8px] leading-4 text-text-dim">{aiPlan.summary}</p>
                    {paidBlocked && <div className="mt-2 rounded-lg border border-pink/20 bg-pink/[.05] p-2 text-[8px] leading-4 text-pink">You have {account?.creditsBalance ?? 0} credits. This edit needs {aiPlan.costCredits}. It cannot start until you add credits.</div>}
                    <div className="mt-3 flex gap-2"><button onClick={() => setAiPlan(null)} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-[9px] text-text-muted">Cancel</button>{paidBlocked ? <Link href="/pricing" className="flex flex-1 items-center justify-center rounded-lg bg-violet px-3 py-2 text-[9px] font-semibold text-white">Add credits</Link> : <button onClick={() => void applyAi()} disabled={aiBusy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-50">{aiBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Apply edit</button>}</div>
                  </div>
                )}

                {aiOperationId && <button onClick={() => void stopAi()} className="mt-3 w-full rounded-lg border border-pink/20 bg-pink/[.04] px-3 py-2 text-[9px] font-semibold text-pink">Stop AI processing</button>}
              </div>

              <div className="shrink-0 border-t border-white/[.08] p-3">
                <div className="rounded-2xl border border-white/10 bg-[#090710] p-2.5 focus-within:border-violet/35">
                  <textarea value={aiInstruction} onChange={(event) => { setAiInstruction(event.currentTarget.value); setAiPlan(null); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void planAi(); } }} rows={3} placeholder="Describe the edit…" className="w-full resize-none bg-transparent text-[11px] leading-5 text-white outline-none placeholder:text-white/25" />
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[8px] text-text-dim">{account?.creditsBalance ?? 0} credits available</span><button onClick={() => void planAi()} disabled={!aiInstruction.trim() || aiBusy || Boolean(aiOperationId)} className="grid h-8 w-8 place-items-center rounded-lg bg-violet text-white disabled:opacity-30">{aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}</button></div>
                </div>
              </div>
            </div>
          ) : selectedLayer ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[9px] text-text-dim">Selected layer</div><div className="mt-0.5 truncate text-xs font-semibold text-white">{selectedLayer.name}</div><div className="mt-1 text-[8px] uppercase tracking-wider text-violet">{selectedLayer.type}</div></div><div className="flex gap-1"><button onClick={duplicateSelected} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-text-muted hover:text-white" title="Duplicate"><Copy size={13} /></button><button onClick={deleteSelected} className="grid h-8 w-8 place-items-center rounded-lg border border-pink/15 text-pink hover:bg-pink/5" title="Delete"><Trash2 size={13} /></button></div></div>

              <div className="mt-5 space-y-4">
                {selectedLayer.type === 'text' && <><label className="block text-[9px] text-text-muted">Text<textarea value={selectedLayer.text ?? ''} onChange={(event) => patchSelected({ text: event.currentTarget.value }, 'Edited text')} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-2.5 text-[11px] text-white outline-none focus:border-violet/35" /></label><Slider label="Font size" min={12} max={180} step={1} value={Number(selectedLayer.style.fontSize || 64)} onChange={(value) => patchSelected({ style: { ...selectedLayer.style, fontSize: value } }, 'Changed font size')} suffix="px" /></>}
                {selectedLayer.type !== 'audio' && <><Slider label="Horizontal position" min={.02} max={.98} value={selectedLayer.x} onChange={(value) => patchSelected({ x: value }, 'Moved layer')} /><Slider label="Vertical position" min={.02} max={.98} value={selectedLayer.y} onChange={(value) => patchSelected({ y: value }, 'Moved layer')} /><Slider label="Scale" min={.04} max={1.5} value={selectedLayer.width} onChange={(value) => patchSelected({ width: value, height: value }, 'Resized layer')} /><Slider label="Rotation" min={-180} max={180} step={1} value={selectedLayer.rotation} onChange={(value) => patchSelected({ rotation: value }, 'Rotated layer')} suffix="°" /><Slider label="Opacity" min={0} max={1} value={selectedLayer.opacity} onChange={(value) => patchSelected({ opacity: value }, 'Changed opacity')} /></>}
                {(selectedLayer.type === 'video' || selectedLayer.type === 'audio') && <Slider label="Volume" min={0} max={1} value={Math.min(1, selectedLayer.volume)} onChange={(value) => patchSelected({ volume: value }, 'Changed volume')} />}
                <div className="grid grid-cols-2 gap-2"><label className="text-[9px] text-text-muted">Start<input type="number" min={0} step="0.1" value={Number(selectedLayer.start.toFixed(2))} onChange={(event) => patchSelected({ start: Math.max(0, Number(event.currentTarget.value)) }, 'Changed timing')} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-white" /></label><label className="text-[9px] text-text-muted">End<input type="number" min={selectedLayer.start + .05} step="0.1" value={Number(selectedLayer.end.toFixed(2))} onChange={(event) => patchSelected({ end: Math.max(selectedLayer.start + .05, Number(event.currentTarget.value)) }, 'Changed timing')} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-white" /></label></div>
                {selectedLayer.type === 'video' && <button onClick={splitSelected} disabled={playhead <= selectedLayer.start || playhead >= selectedLayer.end} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-[10px] font-semibold text-white/80 disabled:opacity-30"><Scissors size={13} />Split at {formatTime(playhead)}</button>}
              </div>

              <div className="mt-6 border-t border-white/[.07] pt-4"><div className="mb-2 text-[9px] font-semibold uppercase tracking-[.12em] text-text-dim">Canvas</div><div className="grid grid-cols-3 gap-1.5">{(['9:16','16:9','1:1'] as const).map((ratio) => <button key={ratio} onClick={() => updateState((draft) => { draft.canvas.aspectRatio = ratio; if (ratio === '9:16') { draft.canvas.width = 1080; draft.canvas.height = 1920; } else if (ratio === '16:9') { draft.canvas.width = 1920; draft.canvas.height = 1080; } else { draft.canvas.width = 1080; draft.canvas.height = 1080; } }, 'Changed canvas ratio')} className={`rounded-lg border px-2 py-2 text-[9px] ${state.canvas.aspectRatio === ratio ? 'border-violet/50 bg-violet/12 text-white' : 'border-white/10 text-text-muted'}`}>{ratio}</button>)}</div></div>
            </div>
          ) : <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-[10px] leading-5 text-text-dim">Select a layer on the canvas or timeline to adjust its position, size, timing, opacity and audio.</div>}
        </aside>
      </main>

      <div className="flex h-12 shrink-0 items-center justify-around border-t border-white/[.08] bg-[#0c0913] px-2 lg:hidden">
        <button onClick={() => { setLeftTab('projects'); setLeftOpen(true); }} className="flex min-w-16 flex-col items-center gap-1 text-[8px] text-text-muted"><FolderOpen size={15} />Projects</button>
        <button onClick={() => { setLeftTab('media'); setLeftOpen(true); }} disabled={!project} className="flex min-w-16 flex-col items-center gap-1 text-[8px] text-text-muted disabled:opacity-30"><ImageIcon size={15} />Media</button>
        <button onClick={() => { setRightTab('ai'); setRightOpen(true); }} disabled={!project} className="flex min-w-16 flex-col items-center gap-1 text-[8px] text-violet disabled:opacity-30"><WandSparkles size={15} />AI Edit</button>
        <button onClick={() => { setRightTab('inspector'); setRightOpen(true); }} disabled={!project} className="flex min-w-16 flex-col items-center gap-1 text-[8px] text-text-muted disabled:opacity-30"><Layers3 size={15} />Adjust</button>
        <Link href="/dashboard" className="flex min-w-16 flex-col items-center gap-1 text-[8px] text-text-muted"><Home size={15} />Workspace</Link>
      </div>
    </div>
  );
}
