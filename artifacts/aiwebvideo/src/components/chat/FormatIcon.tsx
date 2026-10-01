/**
 * Aspect-ratio glyphs drawn as the real thing they describe:
 *  9:16 a phone held upright, 16:9 a cinema / video frame, 1:1 a square post frame.
 * They use currentColor, so they follow the button's state.
 */
export type FormatRatio = "9:16" | "16:9" | "1:1";

export function FormatIcon({ ratio, size = 18, className = "" }: { ratio: FormatRatio; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className };
  if (ratio === "9:16") {
    return (
      <svg {...common}>
        <rect x="7" y="2.5" width="10" height="19" rx="2.8" fill="currentColor" fillOpacity=".12" />
        <path d="M10.6 5.3h2.8" />
        <path d="M11 18.8h2" strokeOpacity=".7" />
      </svg>
    );
  }
  if (ratio === "16:9") {
    return (
      <svg {...common}>
        <rect x="2.5" y="6" width="19" height="12" rx="2.6" fill="currentColor" fillOpacity=".12" />
        <path d="M10.3 9.6v4.8l4.2-2.4z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="3.6" fill="currentColor" fillOpacity=".12" />
      <path d="M8.5 11V8.5H11M13 8.5h2.5V11M15.5 13v2.5H13M11 15.5H8.5V13" strokeOpacity=".8" />
    </svg>
  );
}
