import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { fetchMarketingSettings, type MarketingVideo } from "@/lib/api-client";
import { resolveVideoEmbed } from "@/lib/videoEmbed";

function CampaignMedia({
  video,
  eager = false,
  autoPlay = false,
}: {
  video: MarketingVideo;
  eager?: boolean;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const visibleRef = useRef(true);
  const embed = resolveVideoEmbed(video.url ?? "");

  useEffect(() => {
    if (!autoPlay || embed.kind !== "file" || !videoRef.current) return;
    const player = videoRef.current;
    const resume = () => {
      if (!visibleRef.current || document.visibilityState === "hidden") return;
      player.defaultMuted = true;
      player.muted = true;
      player.playsInline = true;
      void player.play().catch(() => {});
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visibleRef.current = Boolean(entry?.isIntersecting);
              if (visibleRef.current) resume();
              else player.pause();
            },
            { rootMargin: "120px", threshold: 0.05 },
          );

    observer?.observe(player);
    const onVisibility = () => {
      if (document.visibilityState === "visible") resume();
      else player.pause();
    };

    player.addEventListener("canplay", resume);
    document.addEventListener("visibilitychange", onVisibility);
    resume();

    return () => {
      observer?.disconnect();
      player.removeEventListener("canplay", resume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoPlay, embed.kind, embed.src]);

  if (embed.kind !== "file") {
    return (
      <iframe
        src={embed.src}
        title={video.caption || "AiWebVideo creation"}
        className="pointer-events-none h-full w-full border-0"
        loading={eager ? "eager" : "lazy"}
        allow="autoplay; encrypted-media"
        tabIndex={-1}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={embed.src}
      poster={video.posterUrl ?? undefined}
      muted
      loop={autoPlay}
      playsInline
      autoPlay={autoPlay}
      preload={eager ? "auto" : "metadata"}
      controls={false}
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
      tabIndex={-1}
      aria-label={video.caption || "AiWebVideo creation"}
      className="h-full w-full object-cover"
    />
  );
}

function EmptyShowcase() {
  return (
    <div className="flex aspect-video h-full w-full items-center justify-center bg-[#0c0c0f] px-6 text-center">
      <div>
        <Play size={24} className="mx-auto text-text-dim" />
        <p className="mt-4 text-base font-semibold text-white">Showcase media is managed from Admin.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
          Add or enable real AiWebVideo creations to feature them here.
        </p>
      </div>
    </div>
  );
}

function SupportingCreation({ video, autoPlay }: { video: MarketingVideo; autoPlay: boolean }) {
  return (
    <article className="group min-w-[72%] snap-start sm:min-w-[42%] lg:min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] border border-white/[.09] bg-black">
        <CampaignMedia video={video} autoPlay={autoPlay} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent px-4 pb-4 pt-14">
          {video.eyebrow ? <p className="text-xs text-white/60">{video.eyebrow}</p> : null}
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-white">
            {video.caption || video.overlayText || "AiWebVideo creation"}
          </p>
        </div>
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
  const supporting = videos.slice(1, 5);

  return (
    <section id="campaign-films" className="border-b border-white/[.07] bg-white/[.012]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-violet">Selected work</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl lg:text-5xl">
              See the output before you create.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-text-muted sm:text-base">
              A small selection from the media configured for AiWebVideo. Explore holds the larger library.
            </p>
          </div>
          <a href="/examples" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white transition hover:text-violet">
            Explore all creations <ArrowRight size={15} />
          </a>
        </div>

        <div className="mt-9 grid gap-4 lg:grid-cols-[1.45fr_.75fr] lg:gap-5">
          <div>
            <div className="aspect-video overflow-hidden rounded-[16px] border border-white/[.1] bg-black">
              {featured ? <CampaignMedia video={featured} eager autoPlay /> : <EmptyShowcase />}
            </div>
            {featured ? (
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm font-semibold text-white">
                  {featured.caption || featured.overlayText || "Featured creation"}
                </p>
                {featured.eyebrow ? <p className="text-xs text-text-dim">{featured.eyebrow}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
            {supporting.length ? (
              supporting.map((video, index) => (
                <SupportingCreation key={video.id} video={video} autoPlay={index === 0} />
              ))
            ) : (
              <div className="flex min-h-[220px] min-w-[72%] snap-start items-end rounded-[14px] border border-white/[.09] bg-[#0c0c0f] p-4 sm:min-w-[42%] lg:min-w-0">
                <p className="text-sm leading-6 text-text-muted">More real creations can be added from the existing marketing-media settings.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
