import { clsx } from 'clsx';
import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', className, children, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={clsx(
        'premium-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-body font-semibold transition-all duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        size === 'sm' && 'px-3 py-2 text-sm',
        size === 'md' && 'px-4 py-3 text-sm',
        size === 'lg' && 'px-6 py-3.5 text-base',
        variant === 'primary' && 'bg-signature text-white shadow-[0_8px_30px_-8px_rgba(139,92,246,0.6)] hover:brightness-110',
        variant === 'secondary' && 'bg-panel-alt text-text-primary border border-border hover:bg-white/5',
        variant === 'ghost' && 'text-text-muted hover:text-text-primary hover:bg-white/5',
        variant === 'destructive' && 'border border-pink/30 bg-pink/10 text-pink hover:bg-pink/15 hover:border-pink/45',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
