import { Link } from 'wouter';

/** Shown under the composer when the balance is empty: one sentence, one action. */
export function CreditUpgradeNotice({ plan, creditsBalance }: { plan: string; creditsBalance: number }) {
  if (creditsBalance > 0) return null;
  const firstPurchase = plan === 'free';
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-gold/30 bg-gold/[.06] px-4 py-3.5" aria-label="Out of credits">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-text-primary">{firstPurchase ? "You've used your free credits" : "You're out of credits"}</p>
        <p className="mt-0.5 text-[13px] text-text-muted">Everything you made is saved. Reading links and previews stay free.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/pricing#plans" className="inline-flex h-10 items-center rounded-full px-3.5 text-[14px] font-medium text-text-muted transition hover:bg-white/[.06] hover:text-white">See plans</Link>
        <Link href="/pricing#buy-credits" className="inline-flex h-10 items-center rounded-full bg-gold px-4 text-[14px] font-semibold text-bg transition hover:brightness-105">Add credits</Link>
      </div>
    </section>
  );
}
