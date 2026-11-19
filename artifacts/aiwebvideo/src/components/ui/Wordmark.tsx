import { clsx } from "clsx";
import { BRAND } from "@/lib/brand";

/** The mark (a link that turns into a play button) and the name. `compact` shows the mark alone. */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <img src="/logo.svg" alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0" />
      {!compact && (
        <span className="font-display text-[19px] font-bold tracking-[-0.03em] text-text-primary whitespace-nowrap">{BRAND.name}</span>
      )}
    </span>
  );
}
