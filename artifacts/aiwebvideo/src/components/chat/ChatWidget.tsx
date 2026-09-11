import { useState, type ComponentProps } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatWidget as ChatWidgetBase } from "./ChatWidgetBase";

type ChatWidgetProps = ComponentProps<typeof ChatWidgetBase>;

export function ChatWidget({ className, ...props }: ChatWidgetProps) {
  const [finishControlsCollapsed, setFinishControlsCollapsed] = useState(false);

  return (
    <div
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
        <span>{finishControlsCollapsed ? "Show actions" : "Hide actions"}</span>
        {finishControlsCollapsed ? (
          <ChevronUp size={19} strokeWidth={2.25} />
        ) : (
          <ChevronDown size={19} strokeWidth={2.25} />
        )}
      </button>
    </div>
  );
}
