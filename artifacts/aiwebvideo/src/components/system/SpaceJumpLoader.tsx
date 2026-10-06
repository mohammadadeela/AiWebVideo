import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { WarpField } from "@/lib/warpField";

/**
 * Travelling between pages feels like a jump through space: stars streak out of the centre of the screen,
 * accelerate, and the destination fades in as the ship arrives. Used in two places:
 *   - <SpaceJumpLoader/> is the Suspense fallback while a page's code is downloaded (it stays up as long as needed);
 *   - <SpaceJumpTransition/> plays a short jump (about half a second) on every route change, even when the page is
 *     already cached, so navigation always has the same travelling feeling.
 * Reduced-motion visitors see a calm still sky with a soft fade instead of moving streaks. Pure decoration: it never
 * takes focus or clicks once it is fading out, and it is marked as a status region for screen readers.
 */

const JUMP_HOLD_MS = 460;
const JUMP_FADE_MS = 260;
const SPEED_CRUISE = 0.9;
const SPEED_JUMP = 2.6;

function useWarpCanvas(active: boolean, speedRef: React.MutableRefObject<number>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<WarpField | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const phone = window.matchMedia?.("(max-width: 639px)").matches ?? false;
    const field = new WarpField(canvas, {
      count: phone ? 140 : 260,
      speed: speedRef.current,
      reducedMotion,
      centerY: 0.5,
      fullSky: true,
      streak: 2.2,
    });
    fieldRef.current = field;
    field.resize();
    field.start();
    const onResize = () => field.resize();
    const onVisibility = () => (document.hidden ? field.stop() : field.start());
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    let raf = 0;
    const sync = () => {
      field.setSpeed(speedRef.current);
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(raf);
      field.stop();
      fieldRef.current = null;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, speedRef]);

  return canvasRef;
}

function JumpScene({ label, leaving, speedRef }: { label: string; leaving: boolean; speedRef: React.MutableRefObject<number> }) {
  const canvasRef = useWarpCanvas(true, speedRef);
  return (
    <div
      className={`space-jump ${leaving ? "space-jump-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ "--space-jump-fade": `${JUMP_FADE_MS}ms` } as React.CSSProperties}
    >
      <canvas ref={canvasRef} className="space-jump-stars" aria-hidden="true" />
      <div className="space-jump-glow" aria-hidden="true" />
      <div className="space-jump-core">
        <img src="/logo.svg" alt="" className="space-jump-logo" />
        <div className="space-jump-track" aria-hidden="true"><span /></div>
        <p className="space-jump-label">{label}</p>
      </div>
    </div>
  );
}

/** Suspense fallback: stays until the page code has arrived. */
export function SpaceJumpLoader({ label = "Travelling to your page" }: { label?: string }) {
  const speedRef = useRef(SPEED_JUMP);
  return <JumpScene label={label} leaving={false} speedRef={speedRef} />;
}

function destinationLabel(pathname: string) {
  if (pathname === "/") return "Returning to base";
  if (pathname.startsWith("/dashboard")) return "Entering your workspace";
  if (pathname.startsWith("/pricing")) return "Travelling to pricing";
  if (pathname.startsWith("/profile")) return "Opening your profile";
  if (pathname.startsWith("/admin")) return "Opening admin";
  if (pathname.startsWith("/studio")) return "Entering the studio";
  if (pathname.startsWith("/examples")) return "Travelling to examples";
  if (pathname.startsWith("/guides")) return "Opening the guide";
  return "Travelling…";
}

/** Plays the jump on every route change. Mount once, next to the router. */
export function SpaceJumpTransition() {
  const [location] = useLocation();
  const previous = useRef(location);
  const [jump, setJump] = useState<{ label: string; leaving: boolean } | null>(null);
  const speedRef = useRef(SPEED_JUMP);

  useEffect(() => {
    if (previous.current === location) return;
    previous.current = location;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    speedRef.current = SPEED_JUMP;
    setJump({ label: destinationLabel(location), leaving: false });
    const hold = reducedMotion ? 160 : JUMP_HOLD_MS;
    const cruise = window.setTimeout(() => { speedRef.current = SPEED_CRUISE; }, Math.max(0, hold - 140));
    const leave = window.setTimeout(() => setJump((current) => (current ? { ...current, leaving: true } : current)), hold);
    const done = window.setTimeout(() => setJump(null), hold + JUMP_FADE_MS + 40);
    return () => {
      window.clearTimeout(cruise);
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [location]);

  if (!jump) return null;
  return <JumpScene label={jump.label} leaving={jump.leaving} speedRef={speedRef} />;
}
