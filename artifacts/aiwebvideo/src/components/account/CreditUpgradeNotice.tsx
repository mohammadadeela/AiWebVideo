import { Link } from 'wouter';
import { Button } from '@/components/ui/app-button';
import { Coins, CircleDollarSign } from 'lucide-react';
import { displayCredits } from '@/lib/credits';

const MIN_PAID_GENERATION_CREDITS = 8;

export function CreditUpgradeNotice({ plan, creditsBalance }: { plan: string; creditsBalance: number }) {
  if (creditsBalance >= MIN_PAID_GENERATION_CREDITS) return null;

  const firstPurchase = plan === 'free';
  const displayBalance = displayCredits(creditsBalance);
  const displayMinimum = displayCredits(MIN_PAID_GENERATION_CREDITS);
  const displayShortfall = Math.max(0, displayMinimum - displayBalance);

  return (
    <section className="rounded-2xl border border-violet/35 bg-signature-soft px-3 py-3 sm:px-4 sm:py-3.5 shadow-[0_18px_50px_-35px_rgba(139,92,246,.9)] sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-violet/15 text-violet">
          {firstPurchase ? <CircleDollarSign size={16} className="sm:h-[18px] sm:w-[18px]" /> : <Coins size={16} className="sm:h-[18px] sm:w-[18px]" />}
        </span>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {firstPurchase && displayBalance > 0
              ? `You have ${displayBalance.toLocaleString()} Starter Credits`
              : firstPurchase
                ? 'Add credits to generate your first production'
                : 'Your production balance is below the generation minimum'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            {firstPurchase
              ? `Website preview and screenshots stay free. Paid AI generation starts at ${displayMinimum.toLocaleString()} credits, so add ${displayShortfall.toLocaleString()} or more when you are ready to create.`
              : `Your projects are saved. Add at least ${displayShortfall.toLocaleString()} more credits or switch plans to continue generating.`}
          </p>
        </div>
      </div>
      <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 sm:mt-0">
        <Button size="sm" variant="secondary" className="w-full" asChild><Link href="/pricing#buy-credits">Buy credits</Link></Button>
        <Button size="sm" className="w-full" asChild><Link href="/pricing#plans">View plans</Link></Button>
      </div>
    </section>
  );
}