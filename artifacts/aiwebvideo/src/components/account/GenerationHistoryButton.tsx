import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, ExternalLink, Loader2 } from "lucide-react";
import { fetchUserJobs, type UserJobSummary } from "@/lib/api-client";

const FILTERS = [
  ["all", "All"],
  ["website-video", "Website"],
  ["ai-video", "AI Video"],
  ["product-photos", "Product Photos"],
  ["product-video", "Product Video"],
  ["talking-scene", "Talking"],
  ["interior-design", "Interior"],
  ["architecture-design", "Architecture"],
] as const;

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function GenerationHistoryButton() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    void fetchUserJobs()
      .then((response) => {
        if (active) setJobs(response.jobs);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load your history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open]);

  const visible = useMemo(
    () => filter === "all" ? jobs : jobs.filter((job) => job.featureType === filter),
    [filter, jobs],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.09] bg-white/[.03] text-text-muted transition hover:border-violet/30 hover:bg-violet/[.07] hover:text-white"
        aria-label="Generation history"
        aria-expanded={open}
        title="Generation history"
      >
        <Clock3 size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[80] w-[min(92vw,430px)] overflow-hidden rounded-2xl border border-white/10 bg-[#151027]/98 shadow-[0_24px_70px_-28px_rgba(0,0,0,.95)] backdrop-blur-xl">
          <div className="border-b border-white/[.07] px-4 py-3">
            <p className="text-[12px] font-semibold text-white">Generation history</p>
            <p className="mt-0.5 text-[9px] text-text-dim">Reopen any saved production without leaving the creator.</p>
          </div>

          <div className="chat-scroll flex gap-1 overflow-x-auto border-b border-white/[.06] px-3 py-2">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[9px] font-semibold transition ${filter === id ? "border-violet/35 bg-violet/[.12] text-white" : "border-white/[.06] bg-white/[.02] text-text-dim hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="chat-scroll max-h-[min(62dvh,520px)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex min-h-32 items-center justify-center text-text-dim">
                <Loader2 size={17} className="animate-spin" />
              </div>
            ) : error ? (
              <p className="m-2 rounded-xl border border-pink/20 bg-pink/[.06] p-3 text-[10px] leading-4 text-pink">{error}</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-8 text-center text-[10px] text-text-dim">No generations in this filter yet.</p>
            ) : (
              <div className="space-y-1.5">
                {visible.map((job) => {
                  const thumb = job.previewUrl || job.screenshotUrl;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        window.location.assign(`/?job=${encodeURIComponent(job.id)}#generate`);
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-white/[.07] hover:bg-white/[.04]"
                    >
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[.07] bg-black/25">
                        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Clock3 size={15} className="text-violet" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[11px] font-semibold text-white">{job.title || job.featureLabel}</span>
                          <span className="shrink-0 text-[8px] text-text-dim">{shortDate(job.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] text-violet/80">{job.featureLabel}</span>
                        <span className="mt-0.5 block truncate text-[9px] text-text-dim">
                          {job.originalPrompt || "Saved generation"}
                        </span>
                      </span>
                      <ExternalLink size={12} className="shrink-0 text-text-dim transition group-hover:text-white" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
