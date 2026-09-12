import { Link } from 'wouter';
import { Button } from '@/components/ui/app-button';
import { Coins, CircleDollarSign } from 'lucide-react';

export function CreditUpgradeNotice({ plan, creditsBalance }: { plan: string; creditsBalance: number }) {
  if (creditsBalance > 0) return null;

  const firstPurchase = plan === 'free';
  return (
    <section className="rounded-2xl border border-violet/35 bg-signature-soft px-3 py-3 sm:px-4 sm:py-3.5 shadow-[0_18px_50px_-35px_rgba(139,92,246,.9)] sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-violet/15 text-violet">
          {firstPurchase ? <CircleDollarSign size={16} className="sm:h-[18px] sm:w-[18px]" /> : <Coins size={16} className="sm:h-[18px] sm:w-[18px]" />}
        </span>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {firstPurchase ? 'Add credits to generate your first production' : 'Your production credits have run out'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            {firstPurchase
              ? 'Website preview and screenshots stay free. Add credits only when you are ready to start paid AI planning and generation.'
              : 'Your projects are saved. Recharge your balance or switch plans to continue generating.'}
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
