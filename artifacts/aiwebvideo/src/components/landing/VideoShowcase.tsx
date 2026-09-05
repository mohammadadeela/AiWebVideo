import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { fetchMarketingSettings, type MarketingVideo } from "@/lib/api-client";
import { resolveVideoEmbed } from "@/lib/videoEmbed";

function CampaignMedia({ video, featured = false }: { video: MarketingVideo; featured?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const embed = resolveVideoEmbed(video.url ?? "");

  useEffect(() => {
    if (!featured || embed.kind !== "file" || !videoRef.current) return;
    void videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
  }, [embed.kind, featured]);

  if (embed.kind !== "file") {
    return (
      <iframe
        src={embed.src}
        title={video.caption || "AiWebVideo campaign film"}
        className="h-full w-full"
        loading={featured ? "eager" : "lazy"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={embed.src}
        poster={video.posterUrl ?? undefined}
        muted={muted}
        loop={featured}
        playsInline
        autoPlay={featured}
        preload={featured ? "metadata" : "none"}
        controls={!featured}
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {featured && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/20" />}
      {featured && (
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 sm:bottom-5 sm:left-5 sm:right-5">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            {playing ? "Campaign playing" : "Campaign ready"}
          </div>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70"
            aria-label={muted ? "Unmute campaign film" : "Mute campaign film"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}
    </>
  );
}

function PlaceholderFilm() {
  return (
    <div className="generation-grid relative h-full w-full overflow-hidden bg-[#0b0815]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(139,92,246,.35),transparent_42%),radial-gradient(circle_at_70%_76%,rgba(236,72,153,.16),transparent_36%)]" />
      <div className="generation-scan absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-mint to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[.07] text-mint shadow-[0_0_60px_rgba(45,212,191,.2)]">
          <Play size={22} className="ml-0.5" />
        </span>
        <p className="font-display text-2xl font-bold text-white sm:text-3xl">Your campaign belongs here.</p>
        <p className="mt-3 max-w-sm text-xs leading-5 text-text-dim">Start with a website, idea, or product. Finish in one creative chat.</p>
      </div>
    </div>
  );
}

function SupportingFilm({ video, index }: { video: MarketingVideo; index: number }) {
  const [opened, setOpened] = useState(!video.posterUrl);

  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0919] transition duration-300 hover:-translate-y-1 hover:border-violet/40">
      <div className="relative aspect-[16/10] overflow-hidden bg-black">
        {opened ? (
          <CampaignMedia video={video} />
        ) : (
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="absolute inset-0 block h-full w-full overflow-hidden text-white"
            aria-label={`Play ${video.caption || `campaign ${index + 1}`}`}
          >
            <img
              src={video.posterUrl ?? undefined}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur">
                <Play size={15} className="ml-0.5" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-3.5">
        <p className="font-utility text-[8px] uppercase tracking-[.16em] text-violet">{video.eyebrow || `Campaign ${index + 1}`}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-white">{video.caption || "AI-directed campaign film"}</p>
      </div>
    </article>
  );
}

export function VideoShowcase() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchMarketingSettings>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketingSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const videos = settings?.videos.showcase.filter((video) => video.url) ?? [];
  const featured = videos[0];
  const supporting = videos.slice(1);

  return (
    <section id="campaign-films" className="relative overflow-hidden border-b border-white/[.06]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(139,92,246,.2),transparent_34%),radial-gradient(circle_at_88%_32%,rgba(236,72,153,.12),transparent_32%)]" />
      <div className="hero-mesh pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-7 sm:px-5 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-[.62fr_1.38fr] lg:items-center lg:gap-8">
          <div className="min-w-0 max-w-xl">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 font-utility text-[8px] uppercase tracking-[.16em] text-mint backdrop-blur">
              Examples
            </div>
            <h2 className="mt-3 max-w-[15ch] [text-wrap:balance] font-display text-[clamp(2.1rem,10vw,3.35rem)] font-bold leading-[.98] tracking-[-.045em] text-white sm:mt-4 sm:max-w-none">
              See what it can <span className="bg-signature-text">create.</span>
            </h2>
            <p className="mt-3 max-w-md text-[13px] leading-6 text-text-muted sm:text-sm">
              Real campaign videos created with AiWebVideo.
            </p>
          </div>

          <div className="relative w-full min-w-0 max-w-full">
            <div className="pointer-events-none absolute -inset-8 rounded-[48px] bg-gradient-to-br from-violet/10 via-pink/[.08] to-mint/5 blur-3xl" />
            <div className="relative">
              <div className="relative aspect-video w-full min-w-0 overflow-hidden rounded-[20px] border border-white/12 bg-black shadow-[0_34px_100px_-48px_rgba(139,92,246,.85)] sm:rounded-[24px]">
                {featured ? <CampaignMedia video={featured} featured /> : <PlaceholderFilm />}
                {featured?.overlayText && (
                  <p className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold leading-5 text-white backdrop-blur-md sm:left-5 sm:top-5">
                    {featured.overlayText}
                  </p>
                )}
              </div>
              <div className="chat-scroll -mx-1 mt-3 flex max-w-full gap-3 overflow-x-auto px-1 pb-2 overscroll-x-contain">
                {supporting.length ? (
                  supporting.map((video, index) => <div key={video.id} className="w-[78vw] max-w-[230px] shrink-0 sm:w-[230px]"><SupportingFilm video={video} index={index + 1} /></div>)
                ) : (
                  <div className="flex min-h-[170px] w-[78vw] max-w-[230px] shrink-0 flex-col justify-end rounded-[22px] border border-dashed border-white/15 bg-white/[.025] p-4 sm:w-[230px]">
                    <p className="font-utility text-[8px] uppercase tracking-[.18em] text-mint">Generated for the brand</p>
                    <p className="mt-2 text-xs leading-5 text-text-muted">Campaign examples load here from the existing marketing-video settings.</p>
                  </div>
                )}
              </div>
            </div>
            <p className="relative mt-2.5 text-right font-utility text-[8px] uppercase tracking-[.14em] text-text-dim">
              AI-directed production
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
