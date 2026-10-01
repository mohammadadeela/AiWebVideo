import { clsx } from "clsx";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-xl bg-violet/20 blur-md" aria-hidden="true" />
        <img src="/logo.svg" alt="" width={36} height={36} className="logo-motion relative h-9 w-9 shrink-0" />
      </span>
      <span className="font-display text-lg font-extrabold tracking-[-0.035em] whitespace-nowrap sm:text-xl">
        <span className="bg-[linear-gradient(135deg,#67e8f9_0%,#a78bfa_42%,#f472b6_78%,#fb923c_100%)] bg-clip-text text-transparent">Ai</span>
        <span className="text-white">WebVideo</span>
      </span>
    </span>
  );
}
