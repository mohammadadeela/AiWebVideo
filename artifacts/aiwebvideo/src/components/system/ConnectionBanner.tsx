import { useEffect, useRef, useState } from "react";

/**
 * Tells people when their connection drops, and when it is back, so a stuck button is never a mystery.
 * It sits above everything, never covers the page's own controls (it is a thin bar), and says what is safe.
 */
export function ConnectionBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  const [justBack, setJustBack] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const goOffline = () => { if (timer.current) window.clearTimeout(timer.current); setJustBack(false); setOnline(false); };
    const goOnline = () => {
      setOnline(true);
      setJustBack(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setJustBack(false), 3500);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (online && !justBack) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-banner"
      className={`fixed inset-x-0 top-0 z-[200] px-3 py-1.5 text-center text-[12px] font-semibold ${online ? "bg-emerald-500 text-emerald-950" : "bg-amber-400 text-amber-950"}`}
      style={{ paddingTop: "max(6px, env(safe-area-inset-top, 0px))" }}
    >
      {online ? "Back online." : "You are offline. Check your connection. What you have entered is kept, and the studio carries on when you are back."}
    </div>
  );
}
