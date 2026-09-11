import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatWidget as ChatWidgetBase } from "./ChatWidgetBase";

type ChatWidgetProps = ComponentProps<typeof ChatWidgetBase>;

export function ChatWidget({ className, ...props }: ChatWidgetProps) {
  const [finishControlsCollapsed, setFinishControlsCollapsed] = useState(false);
  const [actionTray, setActionTray] = useState<HTMLElement | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let currentTray: HTMLElement | null = null;
    const syncActionTray = () => {
      const details = shell.querySelector<HTMLDetailsElement>(".chat-scroll details.group");
      const nextTray = details?.parentElement ?? null;
      if (nextTray === currentTray) return;
      currentTray = nextTray;
      setActionTray(nextTray);
    };

    syncActionTray();
    const observer = new MutationObserver(syncActionTray);
    observer.observe(shell, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const toggle = actionTray
    ? createPortal(
        <button
          type="button"
          className="finished-chat-collapse-toggle"
          onClick={() => setFinishControlsCollapsed((value) => !value)}
          aria-label={finishControlsCollapsed ? "Show finished creation panel" : "Hide finished creation panel"}
          aria-expanded={!finishControlsCollapsed}
          title={finishControlsCollapsed ? "Show panel" : "Hide panel"}
        >
          {finishControlsCollapsed ? (
            <ChevronUp size={17} strokeWidth={2.4} />
          ) : (
            <ChevronDown size={17} strokeWidth={2.4} />
          )}
        </button>,
        actionTray,
      )
    : null;

  return (
    <div
      ref={shellRef}
      className={`chat-widget-shell relative min-h-0 w-full ${finishControlsCollapsed ? "chat-finish-collapsed" : ""} ${className ?? ""}`}
    >
      <ChatWidgetBase {...props} className="h-full w-full" />
      {toggle}
    </div>
  );
}
