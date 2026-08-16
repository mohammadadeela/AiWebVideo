import { Link } from 'wouter';
import { Button } from '@/components/ui/app-button';
import { Coins, Sparkles } from 'lucide-react';

export function CreditUpgradeNotice({ plan, creditsBalance }: { plan: string; creditsBalance: number }) {
  if (creditsBalance > 0) return null;

  const firstPurchase = plan === 'free';
  return (
    <section className="rounded-2xl border border-violet/35 bg-signature-soft px-4 py-3.5 shadow-[0_18px_50px_-35px_rgba(139,92,246,.9)] sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet">
          {firstPurchase ? <Sparkles size={18} /> : <Coins size={18} />}
        </span>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {firstPurchase ? 'Add credits to generate your first production' : 'Your production credits have run out'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            {firstPurchase
              ? 'Your free capture and storyboard preview still works. Buy credits once or subscribe when you are ready to generate and download.'
              : 'Your projects are saved. Recharge your balance or switch plans to continue generating.'}
          </p>
        </div>
      </div>
      <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 sm:mt-0">
        <Link href="/pricing#buy-credits"><Button size="sm" variant="secondary" className="w-full">Buy credits</Button></Link>
        <Link href="/pricing#plans"><Button size="sm" className="w-full">View plans</Button></Link>
      </div>
    </section>
  );
}
