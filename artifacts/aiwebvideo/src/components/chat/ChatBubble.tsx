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
    <div className={clsx("flex items-start gap-3", isBot ? "justify-start" : "justify-end", isBot && "w-full")}>
      {isBot && <img src="/logo.svg" alt="" width={24} height={24} className="mt-0.5 h-6 w-6 shrink-0" />}
      <div
        className={clsx(
          "text-[15px] leading-7",
          isBot
            ? "min-w-0 flex-1 text-text-primary"
            : "max-w-[88%] rounded-[22px] bg-white/[.09] px-4 py-2.5 text-white sm:max-w-[78%]",
        )}
      >
        {renderedChildren}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start justify-start gap-3" aria-live="polite" aria-label="Working">
      <img src="/logo.svg" alt="" width={24} height={24} className="mt-0.5 h-6 w-6 shrink-0" />
      <div className="flex h-7 items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-text-dim animate-typing-dot [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-dim animate-typing-dot [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-dim animate-typing-dot [animation-delay:300ms]" />
      </div>
    </div>
  );
}
