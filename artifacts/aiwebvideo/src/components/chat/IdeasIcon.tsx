/** A light bulb with a spark inside: "ideas", distinct from the generic sparkle used elsewhere. */
export function IdeasIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.6.5 1 1.1 1 1.9v.3h5.4v-.3c0-.8.4-1.4 1-1.9A6.2 6.2 0 0 0 12 2.8Z" fill="currentColor" fillOpacity=".13" />
      <path d="M9.6 19h4.8M10.5 21.4h3" />
      <path d="m12 6.9.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z" fill="currentColor" stroke="none" />
      <path d="M3.4 9.2h1.3M19.3 9.2h1.3M5.3 4.7l.9.9M18.7 4.7l-.9.9" strokeOpacity=".65" />
    </svg>
  );
}
