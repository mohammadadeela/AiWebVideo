import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** What the assistant worked out, shown line by line before its answer. */
  thinking?: string[];
  /** Waiting for the answer. */
  pending?: boolean;
  /** Play the arrival (thinking lines, then the answer written out). Old messages are shown complete. */
  animate?: boolean;
  seconds?: number;
  suggestions?: string[];
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** One assistant answer: "Thinking", the steps it took appearing one at a time, then the reply written out. */
function AssistantMessage({ message, onSettled, onSuggestion, isLast }: {
  message: ThreadMessage;
  onSettled: (id: string) => void;
  onSuggestion: (text: string) => void;
  isLast: boolean;
}) {
  const steps = message.thinking ?? [];
  const play = Boolean(message.animate) && !reducedMotion();
  const [shownSteps, setShownSteps] = useState(play ? 0 : steps.length);
  const [shownChars, setShownChars] = useState(play ? 0 : message.text.length);
  const [open, setOpen] = useState(play);
  const settled = useRef(false);

  // steps first, one at a time
  useEffect(() => {
    if (message.pending || !play) return;
    if (shownSteps >= steps.length) return;
    const timer = window.setTimeout(() => setShownSteps((count) => count + 1), 420);
    return () => window.clearTimeout(timer);
  }, [message.pending, play, shownSteps, steps.length]);

  // then the answer, written out quickly (the whole reply takes about a second and a half at most)
  useEffect(() => {
    if (message.pending || !play || shownSteps < steps.length) return;
    if (shownChars >= message.text.length) return;
    const stride = Math.max(1, Math.ceil(message.text.length / 70));
    const timer = window.setTimeout(() => setShownChars((count) => Math.min(message.text.length, count + stride)), 20);
    return () => window.clearTimeout(timer);
  }, [message.pending, play, shownSteps, steps.length, shownChars, message.text.length]);

  const done = !message.pending && shownSteps >= steps.length && shownChars >= message.text.length;
  useEffect(() => {
    if (!done || settled.current) return;
    settled.current = true;
    if (!message.animate) return;
    // the steps fold away once the answer is on the page; they stay one click away
    const timer = window.setTimeout(() => { setOpen(false); onSettled(message.id); }, play ? 500 : 0);
    return () => window.clearTimeout(timer);
  }, [done, message.animate, message.id, onSettled, play]);

  return (
    <div className="flex items-start gap-3" data-role="assistant">
      <img src="/logo.svg" alt="" width={26} height={26} className={`mt-0.5 h-[26px] w-[26px] shrink-0 ${message.pending ? "assistant-pulse" : ""}`} />
      <div className="min-w-0 flex-1">
        {message.pending ? (
          <p className="thinking-shimmer text-[15px] leading-7" role="status">Thinking</p>
        ) : (
          <>
            {steps.length > 0 && (
              <div className="mb-1.5">
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  aria-expanded={open}
                  className="inline-flex items-center gap-1 rounded-md text-[13px] text-text-dim transition hover:text-text-primary"
                >
                  {done ? `Thought for ${Math.max(1, message.seconds ?? 1)}s` : "Thinking"}
                  <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <ul className="mt-1.5 space-y-1 border-l border-white/15 pl-3">
                    {steps.slice(0, shownSteps).map((step, index) => (
                      <li key={`${index}-${step}`} className="thinking-step flex items-center gap-2 text-[13px] leading-5 text-text-muted">
                        <Check size={12} className="shrink-0 text-mint" strokeWidth={3} /> {step}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-text-primary" aria-live="polite">
              {message.text.slice(0, shownChars)}
              {!done && shownSteps >= steps.length && <span className="typing-caret" aria-hidden="true" />}
            </p>
            {done && isLast && (message.suggestions?.length ?? 0) > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {message.suggestions!.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onSuggestion(suggestion)}
                    className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-3 text-[13px] font-medium text-text-primary transition hover:bg-white/[.06]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The conversation with the assistant before a production starts. */
export function AssistantThread({ messages, onSettled, onSuggestion }: {
  messages: ThreadMessage[];
  onSettled: (id: string) => void;
  onSuggestion: (text: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [messages]);

  if (!messages.length) return null;
  return (
    <div className="mb-4 space-y-5 px-1" data-assistant-thread role="log" aria-label="Conversation">
      {messages.map((message, index) =>
        message.role === "user" ? (
          <div key={message.id} className="flex justify-end" data-role="user">
            <p className="max-w-[86%] whitespace-pre-wrap rounded-[22px] bg-white/[.07] px-4 py-2.5 text-[15px] leading-6 text-text-primary">{message.text}</p>
          </div>
        ) : (
          <AssistantMessage key={message.id} message={message} onSettled={onSettled} onSuggestion={onSuggestion} isLast={index === messages.length - 1} />
        ),
      )}
      <div ref={endRef} />
    </div>
  );
}
