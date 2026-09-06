import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export function ChatBubble({ role, children }: { role: 'bot' | 'user'; children: ReactNode }) {
  const isBot = role === 'bot';
  return (
    <div className={clsx('flex items-start gap-2.5 animate-fade-in', isBot ? 'justify-start' : 'justify-end')}>
      {isBot && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[.05]">
          <img src="/logo.svg" alt="" width={18} height={18} className="rounded" />
        </div>
      )}
      <div
        className={clsx(
          'max-w-[92%] px-4 py-3.5 text-sm leading-7 sm:max-w-[88%] backdrop-blur-sm',
          isBot
            ? 'rounded-2xl rounded-tl-md border border-white/[.08] bg-white/[.045] text-text-primary shadow-[0_16px_38px_-28px_rgba(0,0,0,.72)]'
            : 'rounded-2xl rounded-tr-md border border-violet/25 bg-[linear-gradient(135deg,rgba(110,76,255,.96),rgba(220,78,150,.92))] text-white shadow-[0_18px_42px_-26px_rgba(139,92,246,.95)]'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 justify-start" aria-live="polite" aria-label="Assistant is typing">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[.05]">
        <img src="/logo.svg" alt="" width={18} height={18} className="rounded" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-white/[.055] bg-white/[.025] px-4 py-3.5">
        <span className="h-1.5 w-1.5 rounded-full bg-text-dim animate-typing-dot [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-dim animate-typing-dot [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-dim animate-typing-dot [animation-delay:300ms]" />
      </div>
    </div>
  );
}
