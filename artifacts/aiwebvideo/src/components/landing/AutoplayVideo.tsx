import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * Muted looping video that starts on phones without waiting for a tap.
 *
 * Why the extra handling (all of it was a real cause of "only plays after a long
 * time or after I touch the screen"):
 *  - iOS/Android only allow autoplay when `muted` + `playsinline` exist as DOM
 *    attributes *before* play() runs. React sets them as properties, which is too late
 *    for some WebKit builds, so they are stamped on the node in a ref callback.
 *  - Videos far below the fold must not download at the same time as the ones the
 *    visitor is looking at, so the source is attached only when a slide is near the
 *    viewport.
 *  - Mobile browsers show nothing for a not-yet-decoded video; `#t=0.001` forces the
 *    first frame to paint even when no poster exists.
 *  - Low Power Mode / data-saver blocks autoplay entirely until a real gesture. We
 *    retry on the first genuine touch/click anywhere, and if it is still blocked we
 *    show a small tap-to-play control instead of a dead frame.
 */
export function AutoplayVideo({
  src,
  poster,
  label,
  eager = false,
  className = "",
}: {
  src: string;
  poster?: string | null;
  label?: string;
  eager?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visibleRef = useRef(false);
  const [near, setNear] = useState(eager);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);

  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node) return;
    node.setAttribute("muted", "");
    node.setAttribute("playsinline", "");
    node.setAttribute("webkit-playsinline", "");
    node.defaultMuted = true;
    node.muted = true;
    node.playsInline = true;
  }, []);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !visibleRef.current || document.visibilityState === "hidden") return;
    video.defaultMuted = true;
    video.muted = true;
    const attempt = video.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => setBlocked(false)).catch((error: unknown) => {
        if ((error as { name?: string })?.name === "NotAllowedError") setBlocked(true);
      });
    }
  }, []);

  // Attach the source only near the viewport; play while visible, pause when not.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      visibleRef.current = true;
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        visibleRef.current = visible;
        if (visible) {
          setNear(true);
          tryPlay();
        } else {
          videoRef.current?.pause();
        }
      },
      { rootMargin: "240px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [tryPlay]);

  // Retry on the events that legitimately allow playback.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tryPlay);
    window.addEventListener("online", tryPlay);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tryPlay);
      window.removeEventListener("online", tryPlay);
    };
  }, [tryPlay]);

  // While blocked, the very first real gesture anywhere on the page unlocks playback.
  useEffect(() => {
    if (!blocked) return;
    const unlock = () => tryPlay();
    const options = { passive: true, capture: true } as const;
    const events = ["touchend", "pointerup", "click", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, unlock, options));
    return () => events.forEach((name) => window.removeEventListener(name, unlock, options));
  }, [blocked, tryPlay]);

  const source = near ? (src.includes("#") ? src : `${src}#t=0.001`) : undefined;

  return (
    <div ref={wrapRef} className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`}
        />
      )}
      <video
        ref={attachVideo}
        src={source}
        muted
        loop
        playsInline
        autoPlay
        preload={eager ? "auto" : "metadata"}
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback"
        tabIndex={-1}
        aria-label={label}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        onLoadedData={tryPlay}
        onCanPlay={tryPlay}
        onStalled={tryPlay}
        onPlaying={() => {
          setReady(true);
          setBlocked(false);
        }}
      />
      {blocked && (
        <button
          type="button"
          onClick={tryPlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-md">
            <Play size={18} className="ml-0.5 fill-white" />
          </span>
        </button>
      )}
    </div>
  );
}
