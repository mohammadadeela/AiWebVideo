import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export function ChatBubble({ role, children }: { role: 'bot' | 'user'; children: ReactNode }) {
  const isBot = role === 'bot';
  return (
    <div className={clsx('flex items-start gap-2.5 animate-fade-in', isBot ? 'justify-start' : 'justify-end')}>
      {isBot && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[.04]">
          <img src="/logo.svg" alt="" width={18} height={18} className="rounded" />
        </div>
      )}
      <div
        className={clsx(
          'max-w-[92%] px-4 py-3 text-sm leading-relaxed sm:max-w-[88%]',
          isBot
            ? 'rounded-2xl rounded-tl-md border border-white/[.055] bg-white/[.025] text-text-primary'
            : 'rounded-2xl rounded-tr-md border border-violet/20 bg-signature text-white shadow-[0_14px_34px_-24px_rgba(139,92,246,.9)]'
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
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[.04]">
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
