import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight,
  Bot,
  Captions,
  Clock3,
  Film,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Music2,
  Redo2,
  Sparkles,
  TextCursorInput,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchMe, fetchUserJobs, type UserJobSummary } from '@/lib/api-client';
import { useSeo } from '@/lib/useSeo';
import {
  assetToLayer,
  createStudioProject,
  importStudioJob,
  listStudioProjects,
  saveStudioProject,
  uploadStudioAssets,
  type StudioProject,
  type StudioProjectState,
} from '@/lib/studio-api';

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'Recently';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

function applyVisualRatio(state: StudioProjectState, width: number | null, height: number | null) {
  if (!width || !height) return state;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) {
    state.canvas.aspectRatio = '1:1';
    state.canvas.width = 1080;
    state.canvas.height = 1080;
  } else if (ratio > 1) {
    state.canvas.aspectRatio = '16:9';
    state.canvas.width = 1920;
    state.canvas.height = 1080;
  } else {
    state.canvas.aspectRatio = '9:16';
    state.canvas.width = 1080;
    state.canvas.height = 1920;
  }
  return state;
}

const EDITOR_FEATURES = [
  [Layers3, 'Timeline & layers'],
  [TextCursorInput, 'Text & overlays'],
  [Music2, 'Audio controls'],
  [Captions, 'Captions'],
  [WandSparkles, 'AI Edit'],
  [Redo2, 'Undo / redo'],
] as const;

export function StudioIndexPage() {
  useSeo({ title: 'AI Video & Image Editor | AiWebVideo', description: 'Edit generated or uploaded videos and images with timeline, layers and AI Edit.', path: '/studio', noindex: true });
  const [, navigate] = useLocation();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Array<Omit<StudioProject,'assets'>>>([]);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchMe(), listStudioProjects(), fetchUserJobs()])
      .then(([, studio, history]) => {
        if (cancelled) return;
        setSignedIn(true);
        setProjects(studio.projects);
        setJobs(history.jobs.filter((job) => job.status === 'done').slice(0, 12));
      })
      .catch(() => { if (!cancelled) setSignedIn(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const recent = useMemo(() => projects.slice(0, 9), [projects]);

  async function create(kind: 'video' | 'image', aspectRatio: '16:9' | '9:16' | '1:1') {
    setCreating(`${kind}:${aspectRatio}`);
    try {
      const project = await createStudioProject({ kind, aspectRatio });
      navigate(`/studio/project/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create Studio project.');
    } finally {
      setCreating(null);
    }
  }

  async function importJob(job: UserJobSummary) {
    setCreating(`job:${job.id}`);
    try {
      const existing = projects.find((project) => project.sourceJobId === job.id);
      if (existing) {
        navigate(`/studio/project/${existing.id}`);
        return;
      }
      const project = await importStudioJob(job.id);
      navigate(`/studio/project/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'This generation could not be imported.');
    } finally {
      setCreating(null);
    }
  }

  async function createAndUpload(files: File[]) {
    if (!files.length) return;
    setCreating('upload');
    try {
      const kind: 'video' | 'image' = files.some((file) => file.type.startsWith('video/')) ? 'video' : 'image';
      const title = files[0]?.name ? `${files[0].name.replace(/\.[^.]+$/, '')} edit` : undefined;
      const project = await createStudioProject({ kind, title, aspectRatio: kind === 'video' ? '9:16' : '1:1' });
      const uploaded = await uploadStudioAssets(project.id, files);
      const next = structuredClone(project.projectState);
      const firstVisual = uploaded.assets.find((asset) => asset.mime_type.startsWith('video/') || asset.mime_type.startsWith('image/'));
      if (firstVisual) applyVisualRatio(next, firstVisual.width, firstVisual.height);

      for (const asset of uploaded.assets) {
        const layer = assetToLayer(asset, next, 0);
        next.layers.push(layer);
        if (!next.selectedLayerId) next.selectedLayerId = layer.id;
        if (layer.type === 'video' || layer.type === 'audio') next.duration = Math.max(next.duration, layer.end);
      }

      await saveStudioProject(project.id, {
        revision: project.revision,
        projectState: next,
        label: 'Added uploaded media',
      });
      navigate(`/studio/project/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start Studio upload.');
    } finally {
      setCreating(null);
    }
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center bg-bg text-text-muted"><Loader2 className="animate-spin" /></div>;

  if (!signedIn) return (
    <div className="min-h-screen bg-bg px-5 py-20 text-center">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-panel p-8">
        <Layers3 className="mx-auto text-violet" size={32} />
        <h1 className="mt-4 text-2xl font-semibold text-white">Sign in to use the AI Editor</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">Your editor projects, uploaded media, AI edits and exports stay private and connected to your account.</p>
        <Link href="/?signin=1" className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 text-sm font-semibold text-white">Sign in</Link>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-bg pb-16 text-text-primary">
      <input
        ref={uploadRef}
        type="file"
        multiple
        className="hidden"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
        onChange={(event) => {
          void createAndUpload(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />

      <section className="border-b border-white/8 bg-[radial-gradient(circle_at_32%_0%,rgba(116,78,205,.18),transparent_44%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet/25 bg-violet/[.08] px-3 py-1 text-xs font-medium text-violet"><Layers3 size={13} />AI Video & Image Editor</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Edit your video or image, not just generate it.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">Upload your own media or open a finished AiWebVideo generation. Use a real timeline, layers, text, audio, captions, precise transforms and natural-language AI Edit.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {EDITOR_FEATURES.map(([Icon, label]) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.035] px-2.5 py-1 text-[10px] text-white/70"><Icon size={11} className="text-violet" />{label}</span>)}
              </div>
            </div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-white">Back to Workspace <ArrowRight size={14} /></Link>
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-[1.35fr_.85fr_.85fr]">
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              disabled={Boolean(creating)}
              className="group rounded-2xl border border-violet/35 bg-[linear-gradient(135deg,rgba(139,92,246,.16),rgba(139,92,246,.05))] p-5 text-left transition hover:border-violet/60 hover:bg-violet/[.12] disabled:opacity-50"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-violet text-white">{creating === 'upload' ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}</span>
              <h2 className="mt-4 text-lg font-semibold text-white">Upload & edit now</h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-text-muted">Choose a video or image. It opens directly on the editor timeline — no extra “add to timeline” step.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet">Open editor <ArrowRight size={12} /></span>
            </button>

            <button type="button" onClick={() => void create('video','9:16')} disabled={Boolean(creating)} className="rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:border-violet/35 hover:bg-violet/[.06] disabled:opacity-50">
              <span className="grid size-10 place-items-center rounded-xl bg-violet/15 text-violet"><Film size={19} /></span>
              <h2 className="mt-4 font-semibold text-white">Blank video project</h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">Start with an empty 9:16 timeline and add media, overlays, text or AI edits.</p>
            </button>

            <button type="button" onClick={() => void create('image','1:1')} disabled={Boolean(creating)} className="rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:border-violet/35 hover:bg-violet/[.06] disabled:opacity-50">
              <span className="grid size-10 place-items-center rounded-xl bg-fuchsia-400/10 text-fuchsia-300"><ImageIcon size={19} /></span>
              <h2 className="mt-4 font-semibold text-white">Blank image project</h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">Build product or campaign artwork with layers, text and AI image editing.</p>
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-9 px-4 py-8 sm:px-6 lg:px-8">
        {!!jobs.length && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Edit a finished generation</h2>
                <p className="mt-1 text-xs text-text-muted">Open your generated result directly on the timeline. No download and re-upload.</p>
              </div>
            </div>
            <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/10 bg-panel">
              {jobs.slice(0, 8).map((job) => (
                <div key={job.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[.05]">{job.screenshotUrl ? <img src={job.screenshotUrl} alt="" className="h-full w-full object-cover" /> : <Film size={16} className="text-violet" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{job.title || 'AiWebVideo generation'}</div>
                    <div className="mt-0.5 text-[10px] text-text-muted">{relativeTime(job.updatedAt)} · {job.mode || 'video'}</div>
                  </div>
                  <button type="button" disabled={creating === `job:${job.id}`} onClick={() => void importJob(job)} className="inline-flex min-w-max items-center gap-1.5 rounded-lg border border-violet/30 bg-violet/[.08] px-3 py-2 text-xs font-semibold text-violet transition hover:bg-violet/[.14] disabled:opacity-50">
                    {creating === `job:${job.id}` ? <Loader2 size={13} className="animate-spin" /> : <Layers3 size={13} />}
                    Edit now
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center gap-2"><Clock3 size={17} className="text-violet" /><h2 className="text-lg font-semibold text-white">Recent editor projects</h2></div>
          {recent.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((project) => (
                <Link key={project.id} href={`/studio/project/${project.id}`} className="group rounded-2xl border border-white/10 bg-panel p-4 transition hover:border-violet/30">
                  <div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/[.05] text-violet">{project.kind === 'video' ? <Film size={16} /> : <ImageIcon size={16} />}</span><span className="text-[10px] text-text-muted">{relativeTime(project.updatedAt)}</span></div>
                  <div className="mt-4 truncate text-sm font-semibold text-white">{project.title}</div>
                  <div className="mt-1 text-[11px] text-text-muted">{project.aspectRatio} · {project.kind === 'video' ? `${Math.round(project.durationSeconds)}s` : 'Image'} · revision {project.revision}</div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-violet">Open timeline <ArrowRight size={12} /></div>
                </Link>
              ))}
            </div>
          ) : <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-text-muted">Upload a video/image or open a finished generation to create your first editor project.</div>}
        </section>

        <section>
          <div className="mb-4"><h2 className="text-lg font-semibold text-white">Need new media first?</h2><p className="mt-1 text-xs text-text-muted">Generate it with AiWebVideo, then open the result here for editing.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['AI Video','Generate a cinematic video','/?create=video#generate',WandSparkles],
              ['Product Images','Generate four product directions','/?create=photo#generate',ImageIcon],
              ['Product Video','Generate commercial product motion','/?create=product-video#generate',Film],
              ['Website Video','Turn a real URL into a branded video','/?create=website#generate',Bot],
            ].map(([name,description,href,Icon]) => <Link key={String(name)} href={String(href)} className="rounded-2xl border border-white/10 bg-panel p-4 transition hover:border-white/20 hover:bg-white/[.04]"><Icon size={17} className="text-violet" /><div className="mt-3 text-sm font-semibold text-white">{String(name)}</div><div className="mt-1 text-xs leading-5 text-text-muted">{String(description)}</div></Link>)}
          </div>
        </section>

        <section className="rounded-2xl border border-violet/20 bg-violet/[.045] p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet"><Sparkles size={16} /></span><div><h2 className="text-sm font-semibold text-white">AI Edit is inside every editor project</h2><p className="mt-1 text-xs leading-5 text-text-muted">Example: “put this photo on the left at 13 seconds for 4 seconds”, “make it smaller”, “add this text”, or use paid generative image operations when needed. Manual timeline edits do not consume AI credits.</p></div></div>
        </section>
      </div>
    </main>
  );
}
