import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatWidget as ChatWidgetBase } from "./ChatWidgetBase";

type ChatWidgetProps = ComponentProps<typeof ChatWidgetBase>;

export function ChatWidget({ className, ...props }: ChatWidgetProps) {
  const [finishControlsCollapsed, setFinishControlsCollapsed] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let frame = 0;
    const positionToggle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const details = shell.querySelector<HTMLDetailsElement>(".chat-scroll details.group");
        const actionStack = details?.parentElement;
        if (!actionStack) {
          shell.style.removeProperty("--finished-actions-toggle-top");
          return;
        }
        const shellRect = shell.getBoundingClientRect();
        const stackRect = actionStack.getBoundingClientRect();
        const top = Math.max(8, stackRect.top - shellRect.top - 48);
        shell.style.setProperty("--finished-actions-toggle-top", `${top}px`);
      });
    };

    positionToggle();
    const resizeObserver = new ResizeObserver(positionToggle);
    resizeObserver.observe(shell);
    const mutationObserver = new MutationObserver(positionToggle);
    mutationObserver.observe(shell, { childList: true, subtree: true });
    window.addEventListener("resize", positionToggle);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", positionToggle);
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className={`chat-widget-shell relative min-h-0 w-full ${finishControlsCollapsed ? "chat-finish-collapsed" : ""} ${className ?? ""}`}
    >
      <ChatWidgetBase {...props} className="h-full w-full" />
      <button
        type="button"
        className="finished-chat-collapse-toggle"
        onClick={() => setFinishControlsCollapsed((value) => !value)}
        aria-label={finishControlsCollapsed ? "Show post-generation actions" : "Hide post-generation actions"}
        aria-expanded={!finishControlsCollapsed}
        title={finishControlsCollapsed ? "Show actions" : "Hide actions"}
      >
        {finishControlsCollapsed ? (
          <ChevronUp size={22} strokeWidth={2.25} />
        ) : (
          <ChevronDown size={22} strokeWidth={2.25} />
        )}
      </button>
    </div>
  );
}
