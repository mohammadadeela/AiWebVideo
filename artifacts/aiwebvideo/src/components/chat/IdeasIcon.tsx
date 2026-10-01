import { useId } from "react";

const GLASS = "M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.6.5 1 1.1 1 1.9v.3h5.4v-.3c0-.8.4-1.4 1-1.9A6.2 6.2 0 0 0 12 2.8Z";

/**
 * A light bulb that switches on and off. Off: a quiet outline. On: warm glass, a bright filament, light rays
 * and a soft glow. By default it keeps blinking on and off to invite a click; `lit` holds it on (the Ideas
 * panel is open or an idea is chosen). People who asked for reduced motion get it held on, without blinking.
 */
export function IdeasIcon({ size = 16, lit = false, className = "" }: { size?: number; lit?: boolean; className?: string }) {
  const gradient = useId().replace(/:/g, "");
  return (
    <span className={`ideas-bulb ${lit ? "is-lit" : ""} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <radialGradient id={gradient} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#fff7c2" />
            <stop offset="55%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
        </defs>
        {/* off: the bulb as an outline */}
        <g stroke="currentColor" strokeWidth="1.7">
          <path d={GLASS} fill="currentColor" fillOpacity=".08" />
          <path d="M9.6 19h4.8M10.5 21.4h3" />
        </g>
        {/* on: warm glass, filament and rays fade in over it */}
        <g className="ideas-bulb-on">
          <path d={GLASS} fill={`url(#${gradient})`} stroke="#fde047" strokeWidth="1.5" />
          <path d="M9.6 19h4.8M10.5 21.4h3" stroke="#fcd34d" strokeWidth="1.7" />
          <path d="M10.1 13.4 11 10.6l1 2.2 1-2.2.9 2.8" stroke="#b45309" strokeWidth="1.3" />
          <path d="M2.7 9.2h1.5M19.8 9.2h1.5M5.2 3.7l1 1M18.8 3.7l-1 1M12 0.5v1.1" stroke="#fde047" strokeWidth="1.5" />
        </g>
      </svg>
    </span>
  );
}
