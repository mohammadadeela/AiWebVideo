import { clsx } from "clsx";
import type { ReactNode } from "react";

function normalizeCancellationCopy(children: ReactNode, isBot: boolean): ReactNode {
  if (!isBot || typeof children !== "string") return children;
  const text = children.trim();
  const legacyRefundMessage =
    /^Stopped — (?:all reserved credits for this render were restored|reserved production credits were restored|no credits were spent on planning)\.?$/i;
  if (legacyRefundMessage.test(text)) {
    return "Stopped. Credits already reserved for paid AI production are not refunded after you choose Stop.";
  }
  return children;
}

export function ChatBubble({
  role,
  children,
  immersive = false,
}: {
  role: "bot" | "user";
  children: ReactNode;
  immersive?: boolean;
}) {
  const isBot = role === "bot";
  const renderedChildren = normalizeCancellationCopy(children, isBot);
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 animate-fade-in",
        isBot ? "justify-start" : "justify-end",
        immersive && isBot && "w-full",
      )}
    >
      {isBot && (
        <div
          className={clsx(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            immersive ? "bg-white/[.055]" : "border border-white/10 bg-white/[.05]",
          )}
        >
          <img src="/logo.svg" alt="" width={18} height={18} className="rounded" />
        </div>
      )}
      <div
        className={clsx(
          "text-sm leading-7",
          immersive && isBot
            ? "min-w-0 flex-1 px-1 py-0.5 text-text-primary"
            : immersive
              ? "max-w-[88%] rounded-[22px] bg-white/[.085] px-4 py-2.5 text-white sm:max-w-[78%]"
              : clsx(
                  "max-w-[92%] px-4 py-3.5 backdrop-blur-sm sm:max-w-[88%]",
                  isBot
                    ? "rounded-2xl rounded-tl-md border border-white/[.08] bg-white/[.045] text-text-primary shadow-[0_16px_38px_-28px_rgba(0,0,0,.72)]"
                    : "rounded-2xl rounded-tr-md border border-violet/25 bg-[linear-gradient(135deg,rgba(110,76,255,.96),rgba(220,78,150,.92))] text-white shadow-[0_18px_42px_-26px_rgba(139,92,246,.95)]",
                ),
        )}
      >
        {renderedChildren}
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
