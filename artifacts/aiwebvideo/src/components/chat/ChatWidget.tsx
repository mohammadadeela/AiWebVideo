import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatWidget as ChatWidgetBase } from "./ChatWidgetBase";

type ChatWidgetProps = ComponentProps<typeof ChatWidgetBase>;

const FINISHED_PANEL_STATE_PREFIX = "aiwebvideo:finished-panel:";

function readFinishedPanelState(chatId: string | null) {
  if (!chatId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${FINISHED_PANEL_STATE_PREFIX}${chatId}`) === "collapsed";
  } catch {
    return false;
  }
}

function writeFinishedPanelState(chatId: string | null, collapsed: boolean) {
  if (!chatId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${FINISHED_PANEL_STATE_PREFIX}${chatId}`,
      collapsed ? "collapsed" : "expanded",
    );
  } catch {
    // Storage being unavailable must never break the chat.
  }
}

function findContinueComposer(shell: HTMLElement) {
  const label = Array.from(shell.querySelectorAll("p")).find(
    (node) => node.textContent?.trim() === "Continue in this chat",
  );
  return (label?.parentElement?.parentElement as HTMLElement | null) ?? null;
}

function clearTrayClasses(tray: HTMLElement | null) {
  if (!tray) return;
  tray.classList.remove("finished-action-tray", "has-reuse-details");
  tray.querySelectorAll(".finished-action-buttons").forEach((node) => node.classList.remove("finished-action-buttons"));
  tray.querySelectorAll(".finished-reuse-details").forEach((node) => node.classList.remove("finished-reuse-details"));
  tray.querySelectorAll(".finished-chat-composer").forEach((node) => node.classList.remove("finished-chat-composer"));
  tray.querySelectorAll(".finished-start-over-original").forEach((node) => node.classList.remove("finished-start-over-original"));
}

export function ChatWidget({
  className,
  onJobCreated,
  initialJobId,
  resumeJobId,
  ...props
}: ChatWidgetProps) {
  const initialChatId = resumeJobId ?? initialJobId ?? null;
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
  const [finishControlsCollapsed, setFinishControlsCollapsed] = useState(() =>
    readFinishedPanelState(initialChatId),
  );
  const [actionTray, setActionTray] = useState<HTMLElement | null>(null);
  const [reuseSummary, setReuseSummary] = useState<HTMLElement | null>(null);
  const [startOverButton, setStartOverButton] = useState<HTMLButtonElement | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextChatId = resumeJobId ?? initialJobId ?? null;
    setActiveChatId(nextChatId);
    setFinishControlsCollapsed(readFinishedPanelState(nextChatId));
  }, [initialJobId, resumeJobId]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let currentTray: HTMLElement | null = null;
    let currentSummary: HTMLElement | null = null;
    let currentStartOver: HTMLButtonElement | null = null;

    const syncActionTray = () => {
      const details = shell.querySelector<HTMLDetailsElement>(".chat-scroll details.group");
      const composer = findContinueComposer(shell);
      const nextTray = details?.parentElement ?? composer?.parentElement ?? null;

      if (nextTray !== currentTray) {
        clearTrayClasses(currentTray);
        currentTray = nextTray;
        setActionTray(nextTray);
      }

      if (!nextTray) {
        if (currentSummary) {
          currentSummary = null;
          setReuseSummary(null);
        }
        if (currentStartOver) {
          currentStartOver = null;
          setStartOverButton(null);
        }
        return;
      }

      nextTray.classList.add("finished-action-tray");

      const directChildren = Array.from(nextTray.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      const actionButtons = directChildren.find(
        (node) => node.classList.contains("flex") && node.classList.contains("flex-wrap") && node.classList.contains("gap-2"),
      );
      actionButtons?.classList.add("finished-action-buttons");

      const nextDetails = directChildren.find(
        (node): node is HTMLDetailsElement => node instanceof HTMLDetailsElement && node.classList.contains("group"),
      );
      nextDetails?.classList.add("finished-reuse-details");
      nextTray.classList.toggle("has-reuse-details", Boolean(nextDetails));

      const nextComposer = composer && composer.parentElement === nextTray ? composer : null;
      nextComposer?.classList.add("finished-chat-composer");

      const nextStartOver = directChildren.find(
        (node): node is HTMLButtonElement =>
          node instanceof HTMLButtonElement &&
          !node.classList.contains("finished-chat-collapse-toggle") &&
          (node.textContent?.trim().startsWith("Start ") ?? false),
      );
      nextStartOver?.classList.add("finished-start-over-original");

      const nextSummary = nextDetails?.querySelector<HTMLElement>("summary") ?? null;
      if (nextSummary !== currentSummary) {
        currentSummary = nextSummary;
        setReuseSummary(nextSummary);
      }
      if (nextStartOver !== currentStartOver) {
        currentStartOver = nextStartOver ?? null;
        setStartOverButton(nextStartOver ?? null);
      }
    };

    syncActionTray();
    const observer = new MutationObserver(syncActionTray);
    observer.observe(shell, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      clearTrayClasses(currentTray);
    };
  }, []);

  const handleJobCreated = (jobId: string) => {
    setActiveChatId(jobId);
    setFinishControlsCollapsed(readFinishedPanelState(jobId));
    onJobCreated?.(jobId);
  };

  const toggleFinishedPanel = () => {
    setFinishControlsCollapsed((value) => {
      const next = !value;
      writeFinishedPanelState(activeChatId, next);
      return next;
    });
  };

  const toggle = actionTray
    ? createPortal(
        <button
          type="button"
          className="finished-chat-collapse-toggle"
          onClick={toggleFinishedPanel}
          aria-label={finishControlsCollapsed ? "Show creation actions" : "Hide creation actions"}
          aria-expanded={!finishControlsCollapsed}
          title={finishControlsCollapsed ? "Show actions" : "Hide actions"}
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

  const startOverInline = reuseSummary && startOverButton
    ? createPortal(
        <button
          type="button"
          className="finished-start-over-inline"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startOverButton.click();
          }}
          disabled={startOverButton.disabled}
          title={startOverButton.textContent?.trim() || "Start another creation"}
        >
          {startOverButton.textContent?.trim() || "Start another creation"}
        </button>,
        reuseSummary,
      )
    : null;

  return (
    <div
      ref={shellRef}
      className={`chat-widget-shell relative min-h-0 w-full ${finishControlsCollapsed ? "chat-finish-collapsed" : ""} ${className ?? ""}`}
    >
      <ChatWidgetBase
        {...props}
        initialJobId={initialJobId}
        resumeJobId={resumeJobId}
        onJobCreated={handleJobCreated}
        className="h-full w-full"
      />
      {toggle}
      {startOverInline}
    </div>
  );
}
