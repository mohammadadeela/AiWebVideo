/**
 * A globe that turns around its own axis. The three meridians are ellipses that narrow to a line and
 * widen again at staggered times, which reads as a sphere rotating. Motion is off for people who asked
 * their system to reduce motion (they get the still globe).
 */
export function SpinningGlobe({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      className={`spinning-globe ${className}`}
    >
      <circle cx="12" cy="12" r="9.2" />
      <path d="M3.4 8.6h17.2M3.4 15.4h17.2" strokeOpacity=".5" />
      <ellipse className="globe-meridian" style={{ animationDelay: "0s" }} cx="12" cy="12" rx="9.2" ry="9.2" strokeOpacity=".85" />
      <ellipse className="globe-meridian" style={{ animationDelay: "-2s" }} cx="12" cy="12" rx="9.2" ry="9.2" strokeOpacity=".85" />
      <ellipse className="globe-meridian" style={{ animationDelay: "-4s" }} cx="12" cy="12" rx="9.2" ry="9.2" strokeOpacity=".85" />
    </svg>
  );
}
