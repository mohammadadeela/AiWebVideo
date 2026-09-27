import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
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
  const explicitComposer = shell.querySelector<HTMLElement>(".finished-chat-composer");
  if (explicitComposer) return explicitComposer;
  const label = Array.from(shell.querySelectorAll("p")).find(
    (node) => node.textContent?.trim() === "Continue in this chat",
  );
  return (label?.parentElement?.parentElement as HTMLElement | null) ?? null;
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
  const [startOverButton, setStartOverButton] = useState<HTMLButtonElement | null>(null);
  const [startOverDisabled, setStartOverDisabled] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const openedChatAutoScrollRef = useRef<string | null>(null);
  const followLatestRef = useRef(true);

  useEffect(() => {
    const nextChatId = resumeJobId ?? initialJobId ?? null;
    setActiveChatId(nextChatId);
    setFinishControlsCollapsed(readFinishedPanelState(nextChatId));
  }, [initialJobId, resumeJobId]);

  // Every time an existing chat is opened from history/sidebar, land at the
  // working end of the conversation instead of making the user manually scroll
  // through the full production again. We wait for restoration to reveal the
  // real composer, then move only the actual vertical chat surfaces. Avoiding
  // scrollIntoView prevents a mobile page jump and lets saved video media load
  // without waiting for an unrelated first tap.
  useEffect(() => {
    const chatId = resumeJobId ?? initialJobId ?? null;
    const shell = shellRef.current;
    if (!chatId || !shell) return;

    openedChatAutoScrollRef.current = null;
    let observer: MutationObserver | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let settleTimer = 0;
    let fallbackTimer = 0;

    const alignToConversationEnd = () => {
      if (openedChatAutoScrollRef.current === chatId) return;
      openedChatAutoScrollRef.current = chatId;

      const align = () => {
        const director = shell.firstElementChild;
        const messages = shell.querySelector<HTMLElement>("[data-chat-messages]");
        const controls = shell.querySelector<HTMLElement>("[data-chat-controls]");
        [messages, controls, director instanceof HTMLElement ? director : null].forEach((surface) => {
          if (surface && surface.scrollHeight > surface.clientHeight + 1) surface.scrollTop = surface.scrollHeight;
        });
      };

      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(align);
      });
      // One small settle pass covers restored result cards/media sizing without
      // creating a long delayed jump after the user starts interacting.
      settleTimer = window.setTimeout(align, 140);
    };

    const tryAlignToComposer = () => {
      if (openedChatAutoScrollRef.current === chatId) return true;

      const finishedComposer = findContinueComposer(shell);
      if (finishedComposer) {
        alignToConversationEnd();
        return true;
      }

      const textareas = Array.from(shell.querySelectorAll<HTMLTextAreaElement>("textarea"));
      const textarea = textareas[textareas.length - 1];
      const form = textarea?.closest("form");
      if (form instanceof HTMLElement) {
        alignToConversationEnd();
        return true;
      }

      return false;
    };

    if (!tryAlignToComposer()) {
      observer = new MutationObserver(() => {
        if (tryAlignToComposer()) observer?.disconnect();
      });
      observer.observe(shell, { childList: true, subtree: true });

      // Rendering/processing chats may intentionally have no composer yet. In
      // that case still open them at the newest/bottom part of the conversation.
      fallbackTimer = window.setTimeout(() => {
        if (openedChatAutoScrollRef.current === chatId) return;
        alignToConversationEnd();
        observer?.disconnect();
      }, 900);
    }

    return () => {
      observer?.disconnect();
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [initialJobId, resumeJobId]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const messages = shell.querySelector<HTMLElement>("[data-chat-messages]");
    if (!messages) return;

    const reduceMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const isNearBottom = () => messages.scrollHeight - messages.scrollTop - messages.clientHeight <= 120;
    const scrollLatest = (behavior: ScrollBehavior = "smooth") => {
      messages.scrollTo({ top: messages.scrollHeight, behavior: reduceMotion() ? "auto" : behavior });
      followLatestRef.current = true;
      setShowJumpToLatest(false);
    };

    const onScroll = () => {
      const nearBottom = isNearBottom();
      followLatestRef.current = nearBottom;
      if (nearBottom) setShowJumpToLatest(false);
    };

    let scheduled = 0;
    const onMutation = () => {
      if (scheduled) window.cancelAnimationFrame(scheduled);
      scheduled = window.requestAnimationFrame(() => {
        if (followLatestRef.current || isNearBottom()) {
          scrollLatest("smooth");
        } else {
          setShowJumpToLatest(true);
        }
      });
    };

    messages.addEventListener("scroll", onScroll, { passive: true });
    const observer = new MutationObserver(onMutation);
    observer.observe(messages, { childList: true, subtree: true, characterData: true, attributes: true });

    return () => {
      messages.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (scheduled) window.cancelAnimationFrame(scheduled);
    };
  }, [activeChatId]);

  function jumpToLatest() {
    const messages = shellRef.current?.querySelector<HTMLElement>("[data-chat-messages]");
    if (!messages) return;
    messages.scrollTo({
      top: messages.scrollHeight,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    followLatestRef.current = true;
    setShowJumpToLatest(false);
  }

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let currentTray: HTMLElement | null = null;
    let currentStartOver: HTMLButtonElement | null = null;

    const syncActionTray = () => {
      const nextTray = shell.querySelector<HTMLElement>(".finished-action-tray");

      if (nextTray !== currentTray) {
        const isNewFinishedResult = Boolean(nextTray && currentTray === null);
        currentTray = nextTray;
        setActionTray(nextTray);

        // Every newly completed generation should land the user on the
        // generated result and leave the large action area collapsed. The
        // user can reopen it with the small connected chevron whenever they
        // want another version, a direction edit, or saved references.
        if (isNewFinishedResult) {
          setFinishControlsCollapsed(true);
          writeFinishedPanelState(activeChatId, true);

          const alignToFinishedResult = () => {
            const messages = shell.querySelector<HTMLElement>("[data-chat-messages]");
            if (!messages) return;
            const results = messages.querySelectorAll<HTMLElement>('[data-generated-result="true"]');
            const result = results[results.length - 1];
            if (!result) {
              messages.scrollTop = messages.scrollHeight;
              return;
            }
            const messagesRect = messages.getBoundingClientRect();
            const resultRect = result.getBoundingClientRect();
            const top = Math.max(0, messages.scrollTop + resultRect.top - messagesRect.top - 10);
            messages.scrollTo({
              top,
              behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            });
          };

          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(alignToFinishedResult);
          });
          window.setTimeout(alignToFinishedResult, 220);
          window.setTimeout(alignToFinishedResult, 720);
        }
      }

      if (!nextTray) {
        if (currentStartOver) {
          currentStartOver = null;
          setStartOverButton(null);
          setStartOverDisabled(false);
        }
        return;
      }

      const directChildren = Array.from(nextTray.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      const nextDetails = directChildren.find(
        (node): node is HTMLDetailsElement => node instanceof HTMLDetailsElement && node.classList.contains("finished-reuse-details"),
      );
      nextTray.classList.toggle("has-reuse-details", Boolean(nextDetails));

      const nextStartOver = directChildren.find(
        (node): node is HTMLButtonElement =>
          node instanceof HTMLButtonElement && node.classList.contains("finished-start-over-original"),
      );

      if (nextStartOver !== currentStartOver) {
        currentStartOver = nextStartOver ?? null;
        setStartOverButton(nextStartOver ?? null);
      }
      setStartOverDisabled(Boolean(nextStartOver?.disabled));
    };

    syncActionTray();
    const observer = new MutationObserver(syncActionTray);
    observer.observe(shell, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    return () => {
      observer.disconnect();
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
          aria-label={finishControlsCollapsed ? "Open creation window" : "Close creation window"}
          aria-expanded={!finishControlsCollapsed}
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

  const startOverDock = actionTray && startOverButton
    ? createPortal(
        <button
          type="button"
          className="finished-start-over-dock"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startOverButton.click();
          }}
          disabled={startOverDisabled}
          title="Start a separate creation"
        >
          Start a separate creation
        </button>,
        actionTray,
      )
    : null;

  return (
    <div
      ref={shellRef}
      className={`chat-widget-shell relative min-h-0 w-full ${finishControlsCollapsed ? "chat-finish-collapsed" : ""} ${className ?? ""}`}
    >
      {showJumpToLatest && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[6.75rem] z-50 flex justify-center px-3 sm:bottom-[7.25rem]">
          <button
            type="button"
            onClick={jumpToLatest}
            className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-white/[.12] bg-[#171220]/95 px-3.5 text-[11px] font-semibold text-white shadow-[0_14px_42px_-18px_rgba(0,0,0,.9)] backdrop-blur-xl transition hover:border-violet/35 hover:bg-[#21182d]"
            aria-label="Jump to latest message"
          >
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-violet/[.15] text-violet">
              <ArrowDown size={12} />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            </span>
            Jump to latest
          </button>
        </div>
      )}
      <ChatWidgetBase
        {...props}
        initialJobId={initialJobId}
        resumeJobId={resumeJobId}
        onJobCreated={handleJobCreated}
        className="h-full w-full"
      />
      {toggle}
      {startOverDock}
    </div>
  );
}
