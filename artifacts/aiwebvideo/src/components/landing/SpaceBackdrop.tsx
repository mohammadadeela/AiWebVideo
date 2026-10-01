import { useEffect, useRef } from "react";
import { WarpField } from "@/lib/warpField";

export interface BackdropMedia { url: string; kind: "image" | "video"; posterUrl?: string | null }

/**
 * The site's space backdrop: a real space photograph with star streaks flying outward from the horizon, so the
 * visitor feels they are moving forward. It sits behind everything, never takes a click, and is quieter on every
 * page except the landing page so content stays easy to read. Reduced-motion visitors get the still picture.
 */
export function SpaceBackdrop({ quiet = false, media = null }: { quiet?: boolean; media?: BackdropMedia | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const phone = window.matchMedia?.("(max-width: 639px)").matches ?? false;
    const field = new WarpField(canvas, { count: phone ? 70 : quiet ? 90 : 150, speed: quiet ? 0.07 : 0.11, reducedMotion });
    field.resize();
    field.start();
    const onResize = () => field.resize();
    const onVisibility = () => (document.hidden ? field.stop() : field.start());
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      field.stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [quiet]);

  return (
    <div className={`space-backdrop ${quiet ? "space-backdrop-quiet" : ""}`} aria-hidden="true">
      {media?.kind === "video" ? (
        <video
          className="space-backdrop-image"
          src={media.url}
          poster={media.posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
        />
      ) : (
        <div className="space-backdrop-image space-backdrop-photo" style={media ? { backgroundImage: `url("${media.url}")` } : undefined} />
      )}
      <canvas ref={canvasRef} className="space-backdrop-warp" />
      <div className="space-backdrop-veil" />
    </div>
  );
}
