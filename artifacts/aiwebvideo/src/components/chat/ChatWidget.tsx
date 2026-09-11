import type { ComponentProps } from "react";
import { ChatWidget as ChatWidgetCore } from "./ChatWidgetCore";
import "./chat-widget-finish.css";

/**
 * Thin presentation shell around the production chat.
 *
 * Keeping the finish-state layout skin here lets the large chat workflow stay
 * focused on behavior while completed-project actions remain compact and easy
 * to scan. `display: contents` preserves the exact existing workspace layout.
 */
export function ChatWidget(props: ComponentProps<typeof ChatWidgetCore>) {
  return (
    <div className="chat-widget-shell contents">
      <ChatWidgetCore {...props} />
    </div>
  );
}
