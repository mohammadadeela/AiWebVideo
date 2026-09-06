import { clsx } from 'clsx';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <img src="/logo.svg" alt="" width={28} height={28} className="logo-motion shrink-0" />
      <span className="font-display text-lg font-bold tracking-[-0.02em] whitespace-nowrap">
        <span className="bg-signature bg-clip-text text-transparent">Ai</span>
        <span className="text-text-primary">WebVideo</span>
      </span>
    </span>
  );
}
