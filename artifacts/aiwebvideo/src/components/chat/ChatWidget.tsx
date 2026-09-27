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

  // Follow streaming work only while the user is already at the working end.
  // The moment they scroll upward we stop moving the conversation and surface
  // a small jump-to-latest control instead of fighting their reading position.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let messages: HTMLElement | null = null;
    let messageObserver: MutationObserver | null = null;
    let shellObserver: MutationObserver | null = null;
    let frame = 0;

    const nearBottom = (node: HTMLElement) =>
      node.scrollHeight - node.scrollTop - node.clientHeight <= 110;

    const onScroll = () => {
      if (!messages) return;
      const atBottom = nearBottom(messages);
      followLatestRef.current = atBottom;
      if (atBottom) setShowJumpToLatest(false);
    };

    const onMutation = () => {
      if (!messages) return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!messages) return;
        if (followLatestRef.current || nearBottom(messages)) {
          followLatestRef.current = true;
          messages.scrollTo({
            top: messages.scrollHeight,
            behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
          setShowJumpToLatest(false);
        } else {
          setShowJumpToLatest(true);
        }
      });
    };

    const attach = () => {
      const next = shell.querySelector<HTMLElement>("[data-chat-messages]");
      if (!next || next === messages) return Boolean(next);
      messages?.removeEventListener("scroll", onScroll);
      messageObserver?.disconnect();
      messages = next;
      followLatestRef.current = nearBottom(next);
      setShowJumpToLatest(false);
      next.addEventListener("scroll", onScroll, { passive: true });
      messageObserver = new MutationObserver(onMutation);
      messageObserver.observe(next, { childList: true, subtree: true, characterData: true });
      return true;
    };

    attach();
    shellObserver = new MutationObserver(() => attach());
    shellObserver.observe(shell, { childList: true, subtree: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      messages?.removeEventListener("scroll", onScroll);
      messageObserver?.disconnect();
      shellObserver?.disconnect();
    };
  }, []);

  const jumpToLatest = () => {
    const messages = shellRef.current?.querySelector<HTMLElement>("[data-chat-messages]");
    if (!messages) return;
    followLatestRef.current = true;
    setShowJumpToLatest(false);
    messages.scrollTo({
      top: messages.scrollHeight,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

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
      <ChatWidgetBase
        {...props}
        initialJobId={initialJobId}
        resumeJobId={resumeJobId}
        onJobCreated={handleJobCreated}
        className="h-full w-full"
      />
      {showJumpToLatest && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-24 right-3 z-40 inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-[#171222]/95 px-3 text-[10px] font-semibold text-white shadow-[0_16px_44px_-20px_rgba(0,0,0,.95)] backdrop-blur-xl transition hover:border-violet/35 hover:bg-[#211a30] sm:right-4"
          aria-label="Jump to latest generation update"
        >
          <ChevronDown size={15} />
          <span>Latest</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet" aria-hidden="true" />
        </button>
      )}
      {toggle}
      {startOverDock}
    </div>
  );
}
