import { useEffect, useRef } from "react";
import { WarpField } from "@/lib/warpField";

export interface BackdropMedia { url: string; kind: "image" | "video"; posterUrl?: string | null }

/**
 * The space picture behind the landing page's first screen, with star streaks flying out of the glowing road so the
 * visitor feels they are moving forward. It fills ITS PARENT (the hero), anchored at the bottom so the road sits just
 * under the chat box, and it never takes a click. Nothing else on the site shows it: every other page and section is
 * solid. Reduced-motion visitors get the still picture.
 */
export function SpaceBackdrop({ media = null }: { media?: BackdropMedia | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const phone = window.matchMedia?.("(max-width: 639px)").matches ?? false;
    const field = new WarpField(canvas, { count: phone ? 70 : 150, speed: 0.11, reducedMotion, centerY: 0.8 });
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
  }, []);

  return (
    <div className="space-backdrop" aria-hidden="true">
      {media?.kind === "video" ? (
        <video className="space-backdrop-image" src={media.url} poster={media.posterUrl ?? undefined} autoPlay muted loop playsInline preload="auto" disablePictureInPicture tabIndex={-1} />
      ) : (
        <div className="space-backdrop-image space-backdrop-photo" style={media ? { backgroundImage: `url("${media.url}")` } : undefined} />
      )}
      <canvas ref={canvasRef} className="space-backdrop-warp" />
      <div className="space-backdrop-veil" />
    </div>
  );
}
