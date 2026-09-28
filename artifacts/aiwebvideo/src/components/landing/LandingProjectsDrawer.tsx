import { useEffect, useState } from "react";
import { Clock3, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { fetchUserJobs, type UserJobSummary } from "@/lib/api-client";
import { watchAuthState } from "@/lib/firebase/client";

export function LandingProjectsDrawer() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => watchAuthState((user) => { setSignedIn(Boolean(user)); if (!user) setJobs([]); }), []);
  useEffect(() => {
    if (!open || !signedIn) return;
    let active = true;
    setLoading(true);
    void fetchUserJobs().then((response) => { if (active) setJobs(response.jobs ?? []); }).catch(() => { if (active) setJobs([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, signedIn]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const features = ["All", ...new Set(jobs.map((job) => job.featureLabel).filter(Boolean))];
  const visible = jobs.filter((job) => (filter === "All" || job.featureLabel === filter) && `${job.title ?? ""} ${job.originalPrompt ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open past projects" aria-expanded={open} className="fixed left-0 top-[42%] z-40 flex min-h-11 items-center gap-1.5 rounded-r-xl border border-l-0 border-white/15 bg-[#181329]/95 px-2.5 text-[11px] font-semibold text-white/80 shadow-xl backdrop-blur-md transition hover:bg-[#27203d] hover:text-white sm:px-3">
      <PanelLeftOpen size={16} aria-hidden="true" /><span className="hidden sm:inline">Projects</span>
    </button>
    {open && <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Past projects">
      <button type="button" aria-label="Close past projects" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <aside className="absolute inset-y-0 left-0 flex w-[min(360px,calc(100vw-2rem))] flex-col border-r border-white/10 bg-[#100d1c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-white">Your projects</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close projects" className="grid h-9 w-9 place-items-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white"><PanelLeftClose size={18} /></button>
        </div>
        {signedIn ? <>
          <label className="mx-3 mt-4 flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 text-white/50 focus-within:border-violet/50">
            <Search size={15} /><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search projects" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40" />
          </label>
          <div className="chat-scroll flex gap-1.5 overflow-x-auto px-3 py-3" aria-label="Filter projects">
            {features.map((feature) => <button type="button" key={feature} onClick={() => setFilter(feature)} aria-pressed={filter === feature} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${filter === feature ? "bg-violet text-white" : "bg-white/[.06] text-white/65 hover:bg-white/10"}`}>{feature}</button>)}
          </div>
          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {loading ? <p className="px-2 py-5 text-xs text-white/50">Loading projects…</p> : !visible.length ? <p className="px-2 py-5 text-xs text-white/50">No projects here yet.</p> : visible.map((job) => <a key={job.id} href={`/?job=${encodeURIComponent(job.id)}#generate`} className="mb-1.5 flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[.06]">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[.05]">{job.previewUrl || job.screenshotUrl ? <img src={job.previewUrl || job.screenshotUrl || ""} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Clock3 size={16} className="text-violet" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{job.title || job.featureLabel}</span><span className="mt-0.5 block truncate text-[10px] text-white/50">{job.originalPrompt || job.featureLabel}</span><span className="mt-0.5 block text-[9px] text-white/35">{new Date(job.createdAt).toLocaleDateString()}</span></span>
            </a>)}
          </div>
        </> : <p className="p-5 text-sm leading-6 text-white/65">Sign in to see your past generations. You can still explore the creator without an account.</p>}
      </aside>
    </div>}
  </>;
}
