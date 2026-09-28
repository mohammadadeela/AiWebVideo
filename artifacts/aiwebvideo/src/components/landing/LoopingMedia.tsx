import { useEffect, useRef } from "react";
import { resolveVideoEmbed } from "@/lib/videoEmbed";

export function LoopingMedia({ src, poster, className = "", eager = false }: { src: string; poster?: string; className?: string; eager?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const embed = resolveVideoEmbed(src);
  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    let visible = true;
    let active = true;
    const timers: number[] = [];
    const resume = () => {
      if (!active || !visible || document.visibilityState !== "visible") return;
      player.defaultMuted = true;
      player.muted = true;
      void player.play().catch(() => {});
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) resume(); else player.pause();
    }, { rootMargin: "120px", threshold: 0.01 });
    observer?.observe(player);
    player.addEventListener("canplay", resume);
    player.addEventListener("loadeddata", resume);
    player.addEventListener("stalled", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pointerdown", resume, { passive: true });
    [0, 300, 1200, 4000].forEach((delay) => timers.push(window.setTimeout(resume, delay)));
    return () => {
      active = false;
      observer?.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      player.removeEventListener("canplay", resume);
      player.removeEventListener("loadeddata", resume);
      player.removeEventListener("stalled", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pointerdown", resume);
    };
  }, [embed.src, embed.kind]);

  if (embed.kind === "iframe") return <iframe src={embed.src} title="Campaign video" loading={eager ? "eager" : "lazy"} allow="autoplay; encrypted-media" tabIndex={-1} className={`pointer-events-none border-0 ${className}`} />;
  return <video ref={videoRef} src={embed.src} poster={poster} muted loop playsInline autoPlay preload={eager ? "auto" : "metadata"} controls={false} disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback" tabIndex={-1} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
