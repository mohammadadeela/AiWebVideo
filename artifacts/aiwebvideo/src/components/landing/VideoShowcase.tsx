import { useEffect, useRef, useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { fetchMarketingSettings, type MarketingVideo } from '@/lib/api-client';
import { resolveVideoEmbed } from '@/lib/videoEmbed';

// Small, self-contained video card. Muted-autoplay starts only once the
// card scrolls into view (IntersectionObserver) and pauses when it leaves,
// so a page with both videos never runs two clips at once in the
// background — kept deliberately light and unobtrusive rather than
// grabbing attention away from the surrounding copy.
function VideoCard({ video, index, delayMs }: {
  video: MarketingVideo;
  index: number;
  delayMs: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.45 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView) { void el.play().then(() => setStarted(true)).catch(() => {}); }
    else el.pause();
  }, [inView]);

  if (!video.url) return null;
  const embed = resolveVideoEmbed(video.url);
  const title = video.caption || `Community creation ${index + 1}`;

  return (
    <div
      ref={containerRef}
      className="animate-fade-in-up group relative shrink-0 overflow-hidden rounded-[20px] border border-border bg-panel shadow-[0_16px_45px_-24px_rgba(0,0,0,0.65)] transition-all duration-300 hover:-translate-y-1 hover:border-violet/40 hover:shadow-[0_20px_55px_-22px_rgba(139,92,246,0.32)]"
      style={{ animationDelay: `${delayMs}ms`, width: 'min(100%, 220px)' }}
    >
      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '9/16' }}>
        {embed.kind === 'file' ? (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src={embed.src}
              poster={video.posterUrl ?? undefined}
              muted={muted}
              loop
              playsInline
              preload="none"
            />
            <button
              type="button"
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              onClick={() => setMuted((value) => !value)}
              className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            {!started && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black"><Play size={18} className="ml-0.5" /></span>
              </div>
            )}
          </>
        ) : (
          <iframe
            src={inView ? embed.src : undefined}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        )}
        {/* Subtle gradient so a light poster frame never fights the caption below it */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
        {video.overlayText && <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-black/55 px-3 py-2 text-center text-xs font-semibold leading-snug text-white backdrop-blur-md">{video.overlayText}</p>}
      </div>
      <div className="p-3">
        <p className="font-utility text-[10px] uppercase tracking-[.14em] text-violet">{video.eyebrow || 'Made by a user'}</p>
        <p className="mt-1 text-xs font-semibold text-text-primary">{title}</p>
      </div>
    </div>
  );
}

export function VideoShowcase() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchMarketingSettings>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketingSettings().then((data) => { if (!cancelled) setSettings(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Nothing configured yet (or the request failed) — render nothing rather
  // than an empty/broken-looking section.
  const videos = settings?.videos.showcase.filter((video) => video.url) ?? [];
  if (!settings || !videos.length) return null;

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-7 text-center">
          <p className="font-utility text-xs uppercase tracking-[.18em] text-gold">See it, don't just read it</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-text-primary">{settings.heading}</h2>
          <p className="mt-2 max-w-lg mx-auto text-sm text-text-muted">
            {settings.description}
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-center gap-5">
          {videos.map((video, index) => <VideoCard key={video.id} video={video} index={index} delayMs={index * 90} />)}
        </div>
      </div>
    </section>
  );
}
