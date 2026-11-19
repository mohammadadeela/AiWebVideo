import { Link } from "wouter";
import { Plus } from "lucide-react";
import { formatCredits } from "@/components/account/UserMenu";
import { estimateRenderCredits } from "@/lib/credits";

/** Below the price of the smallest thing you can make (one set of images), the balance is "running low". */
export const LOW_CREDIT_THRESHOLD = estimateRenderCredits("photos", true, 8, "1080p", "graphic-1");

export function isLowBalance(balance: number | undefined | null) {
  return typeof balance === "number" && balance < LOW_CREDIT_THRESHOLD;
}

/** The balance, always one click from buying more. Turns warm when it is running low. */
export function CreditPill({ balance, className = "" }: { balance: number | undefined; className?: string }) {
  const low = isLowBalance(balance);
  return (
    <Link
      href="/pricing#buy-credits"
      aria-label={`${formatCredits(balance)} credits. Add more`}
      className={`inline-flex h-10 items-center gap-2 rounded-full border pl-3.5 pr-1.5 text-[13px] transition ${low ? "border-gold/50 text-gold hover:bg-gold/[.06]" : "border-white/10 text-text-muted hover:border-white/20 hover:text-white"} ${className}`}
    >
      <span><span className="font-utility font-semibold text-white">{formatCredits(balance)}</span> credits</span>
      <span className={`grid h-7 w-7 place-items-center rounded-full ${low ? "bg-white text-bg" : "bg-white/10 text-white"}`}><Plus size={14} strokeWidth={2.6} /></span>
    </Link>
  );
}
