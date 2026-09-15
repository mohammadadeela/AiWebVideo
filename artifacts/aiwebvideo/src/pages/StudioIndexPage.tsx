import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight, Bot, Clock3, Film, Image as ImageIcon, LayoutTemplate, Loader2,
  MonitorPlay, Sparkles, Upload, WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchMe, fetchUserJobs, type UserJobSummary } from '@/lib/api-client';
import { useSeo } from '@/lib/useSeo';
import {
  createStudioProject, importStudioJob, listStudioProjects, uploadStudioAssets,
  type StudioProject,
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

export function StudioIndexPage() {
  useSeo({ title: 'AiWebVideo Studio', description: 'Generate, upload, edit with AI, and export video and images in one workspace.', path: '/studio', noindex: true });
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

  const recent = useMemo(() => projects.slice(0, 10), [projects]);

  async function create(kind: 'video' | 'image', aspectRatio?: '16:9' | '9:16' | '1:1') {
    setCreating(`${kind}:${aspectRatio ?? ''}`);
    try {
      const project = await createStudioProject({ kind, aspectRatio });
      navigate(`/studio/project/${project.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create Studio project.'); }
    finally { setCreating(null); }
  }

  async function importJob(job: UserJobSummary) {
    setCreating(`job:${job.id}`);
    try {
      const project = await importStudioJob(job.id);
      navigate(`/studio/project/${project.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'This generation could not be imported.'); }
    finally { setCreating(null); }
  }

  async function createAndUpload(files: File[]) {
    if (!files.length) return;
    setCreating('upload');
    try {
      const kind: 'video' | 'image' = files.some((file) => file.type.startsWith('video/')) ? 'video' : 'image';
      const project = await createStudioProject({ kind, title: files[0]?.name ? `${files[0].name.replace(/\.[^.]+$/, '')} edit` : undefined });
      await uploadStudioAssets(project.id, files);
      navigate(`/studio/project/${project.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start Studio upload.'); }
    finally { setCreating(null); }
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center bg-bg text-text-muted"><Loader2 className="animate-spin" /></div>;

  if (!signedIn) return (
    <div className="min-h-screen bg-bg px-5 py-20 text-center">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-panel p-8">
        <Sparkles className="mx-auto text-violet" size={30} />
        <h1 className="mt-4 text-2xl font-semibold text-white">Sign in to use Studio</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">Studio projects, uploaded media, AI edits and exports stay private and connected to your AiWebVideo account.</p>
        <Link href="/?signin=1" className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 text-sm font-semibold text-white">Sign in</Link>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-bg pb-16 text-text-primary">
      <input ref={uploadRef} type="file" multiple className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg" onChange={(event) => { void createAndUpload(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
      <section className="border-b border-white/8 bg-[radial-gradient(circle_at_30%_0%,rgba(116,78,205,.16),transparent_45%)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet/25 bg-violet/[.08] px-3 py-1 text-xs font-medium text-violet"><Sparkles size={13} />AiWebVideo Studio</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Generate it. Upload it. Tell AI what you want. Edit it. Publish it.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">One non-destructive workspace for generated content and your own media. Manual edits are free; paid AI operations always show their credit cost before they run.</p>
            </div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-white">Workspace <ArrowRight size={14} /></Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={() => void create('video','9:16')} disabled={Boolean(creating)} className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet/35 hover:bg-violet/[.06] disabled:opacity-50"><span className="grid size-10 place-items-center rounded-xl bg-violet/15 text-violet"><Film size={19} /></span><h2 className="mt-4 font-semibold text-white">New Video</h2><p className="mt-1 text-xs leading-5 text-text-muted">Start an empty responsive video project with timeline, overlays, text and audio.</p></button>
            <button type="button" onClick={() => void create('image','1:1')} disabled={Boolean(creating)} className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet/35 hover:bg-violet/[.06] disabled:opacity-50"><span className="grid size-10 place-items-center rounded-xl bg-fuchsia-400/10 text-fuchsia-300"><ImageIcon size={19} /></span><h2 className="mt-4 font-semibold text-white">New Image</h2><p className="mt-1 text-xs leading-5 text-text-muted">Compose, crop, layer and AI-edit product or campaign images non-destructively.</p></button>
            <button type="button" onClick={() => uploadRef.current?.click()} disabled={Boolean(creating)} className="group rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet/35 hover:bg-violet/[.06] disabled:opacity-50"><span className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">{creating === 'upload' ? <Loader2 className="animate-spin" size={19} /> : <Upload size={19} />}</span><h2 className="mt-4 font-semibold text-white">Upload Media</h2><p className="mt-1 text-xs leading-5 text-text-muted">Bring your own video, images, audio, product photos, screenshots or raster logos.</p></button>
            <button type="button" onClick={() => void create('video','9:16')} disabled={Boolean(creating)} className="group rounded-2xl border border-violet/25 bg-violet/[.07] p-5 text-left transition hover:-translate-y-0.5 hover:bg-violet/[.11] disabled:opacity-50"><span className="grid size-10 place-items-center rounded-xl bg-violet text-white"><Bot size={19} /></span><h2 className="mt-4 font-semibold text-white">Edit with AI</h2><p className="mt-1 text-xs leading-5 text-text-muted">Open a project and use natural language for precise timing, placement, transforms and generative edits.</p></button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Generate with AI</h2><p className="mt-1 text-xs text-text-muted">Use the existing production pipeline, then open the finished result in Studio.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['AI Video','Cinematic video from an idea or reference','/?create=video#generate',WandSparkles],
              ['Product Images','Four product campaign directions','/?create=photo#generate',ImageIcon],
              ['Product Video','Commercial product motion and reveals','/?create=product-video#generate',Film],
              ['Website Video','Turn a real URL into branded marketing video','/?create=website#generate',MonitorPlay],
            ].map(([name,description,href,Icon]) => <Link key={String(name)} href={String(href)} className="rounded-2xl border border-white/10 bg-panel p-4 transition hover:border-white/20 hover:bg-white/[.04]"><Icon size={17} className="text-violet" /><div className="mt-3 text-sm font-semibold text-white">{String(name)}</div><div className="mt-1 text-xs leading-5 text-text-muted">{String(description)}</div></Link>)}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><LayoutTemplate size={17} className="text-violet" /><h2 className="text-lg font-semibold text-white">Templates</h2></div><p className="mt-1 text-xs text-text-muted">Working project presets — no fake template buttons.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => void create('video','9:16')} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left hover:border-violet/30"><div className="text-sm font-semibold text-white">Vertical social video</div><div className="mt-1 text-xs text-text-muted">9:16 · TikTok / Reels / Shorts</div></button>
            <button type="button" onClick={() => void create('video','16:9')} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left hover:border-violet/30"><div className="text-sm font-semibold text-white">Landscape campaign</div><div className="mt-1 text-xs text-text-muted">16:9 · Website / YouTube / presentation</div></button>
            <button type="button" onClick={() => void create('image','1:1')} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left hover:border-violet/30"><div className="text-sm font-semibold text-white">Square product creative</div><div className="mt-1 text-xs text-text-muted">1:1 · Ecommerce / social campaign</div></button>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2"><Clock3 size={17} className="text-violet" /><h2 className="text-lg font-semibold text-white">Recent Projects</h2></div>
          {recent.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{recent.map((project) => <Link key={project.id} href={`/studio/project/${project.id}`} className="group rounded-2xl border border-white/10 bg-panel p-4 transition hover:border-violet/30"><div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/[.05] text-violet">{project.kind === 'video' ? <Film size={16} /> : <ImageIcon size={16} />}</span><span className="text-[10px] text-text-muted">{relativeTime(project.updatedAt)}</span></div><div className="mt-4 truncate text-sm font-semibold text-white">{project.title}</div><div className="mt-1 text-[11px] text-text-muted">{project.aspectRatio} · {project.kind === 'video' ? `${Math.round(project.durationSeconds)}s` : 'Image'} · revision {project.revision}</div><div className="mt-4 flex items-center gap-1 text-xs font-medium text-violet opacity-70 transition group-hover:opacity-100">Open editor <ArrowRight size={12} /></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-text-muted">Your Studio projects will appear here.</div>}
        </section>

        {!!jobs.length && <section>
          <div className="mb-4"><h2 className="text-lg font-semibold text-white">Previous AiWebVideo Generations</h2><p className="mt-1 text-xs text-text-muted">Open an existing generation directly in Studio — no download and re-upload step.</p></div>
          <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/10 bg-panel">{jobs.map((job) => <div key={job.id} className="flex items-center gap-3 p-3 sm:p-4"><div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[.05]">{job.screenshotUrl ? <img src={job.screenshotUrl} alt="" className="h-full w-full object-cover" /> : <Film size={16} className="text-violet" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-white">{job.title || 'AiWebVideo generation'}</div><div className="mt-0.5 text-[10px] text-text-muted">{relativeTime(job.updatedAt)} · {job.mode || 'video'}</div></div><button type="button" disabled={creating === `job:${job.id}`} onClick={() => void importJob(job)} className="min-w-max rounded-lg border border-violet/30 bg-violet/[.08] px-3 py-2 text-xs font-semibold text-violet disabled:opacity-50">{creating === `job:${job.id}` ? <Loader2 size={13} className="animate-spin" /> : 'Edit in Studio'}</button></div>)}</div>
        </section>}
      </div>
    </main>
  );
}
