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
  const [hasUnseenBelow, setHasUnseenBelow] = useState(false);
  const [latestButtonBottom, setLatestButtonBottom] = useState(16);
  const shellRef = useRef<HTMLDivElement>(null);
  const openedChatAutoScrollRef = useRef<string | null>(null);
  const latestScrollElementRef = useRef<HTMLElement | null>(null);
  const autoFollowRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const userScrollIntentRef = useRef(false);
  // When a generation finishes the result is pinned to the top of the view for a few seconds (while its pictures and
  // video settle), and the follow-the-bottom logic below stands aside. Any wheel or touch from the reader ends it at once.
  const finishLockUntilRef = useRef(0);
  const realignFinishedRef = useRef<(smooth: boolean) => void>(() => {});

  useEffect(() => {
    const nextChatId = resumeJobId ?? initialJobId ?? null;
    setActiveChatId(nextChatId);
    setFinishControlsCollapsed(readFinishedPanelState(nextChatId));
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
    setShowJumpToLatest(false);
    setHasUnseenBelow(false);
  }, [initialJobId, resumeJobId]);

  const jumpToLatest = () => {
    const scroller = latestScrollElementRef.current;
    if (!scroller) return;
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
    setHasUnseenBelow(false);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  // ChatGPT/Claude-style follow mode:
  // - follow new content only while the reader is already near the bottom;
  // - immediately stop following when the reader scrolls upward;
  // - resume automatically when they return to the bottom;
  // - expose a jump-to-latest control whenever newer content sits below.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let attached: HTMLElement | null = null;
    let contentObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let touchY: number | null = null;
    let scheduledFrame = 0;
    let detachListeners = () => {};

    const isNearBottom = (element: HTMLElement) =>
      element.scrollHeight - element.scrollTop - element.clientHeight <= 100;

    const updateButtonPosition = (element: HTMLElement) => {
      const shellRect = shell.getBoundingClientRect();
      const messagesRect = element.getBoundingClientRect();
      const nextBottom = Math.max(12, Math.round(shellRect.bottom - messagesRect.bottom + 12));
      setLatestButtonBottom(nextBottom);
    };

    const markUserScrollUp = (element: HTMLElement) => {
      autoFollowRef.current = false;
      userScrollIntentRef.current = true;
      setShowJumpToLatest(element.scrollHeight > element.clientHeight + 4);
    };

    const scheduleFollow = (element: HTMLElement, markUnread: boolean) => {
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = window.requestAnimationFrame(() => {
        updateButtonPosition(element);
        if (Date.now() < finishLockUntilRef.current) {
          realignFinishedRef.current(false);
          setShowJumpToLatest(false);
          setHasUnseenBelow(false);
          return;
        }
        if (autoFollowRef.current) {
          const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          element.scrollTo({
            top: element.scrollHeight,
            behavior: reducedMotion ? "auto" : "smooth",
          });
          setHasUnseenBelow(false);
        } else {
          const hasBelow = element.scrollHeight - element.scrollTop - element.clientHeight > 4;
          setShowJumpToLatest(hasBelow);
          if (markUnread && hasBelow) setHasUnseenBelow(true);
        }
      });
    };

    const attach = (element: HTMLElement) => {
      if (attached === element) return;
      detachListeners();
      contentObserver?.disconnect();
      resizeObserver?.disconnect();

      attached = element;
      latestScrollElementRef.current = element;
      lastScrollTopRef.current = element.scrollTop;
      updateButtonPosition(element);

      const onScroll = () => {
        if (Date.now() < finishLockUntilRef.current) {
          // our own scroll to the finished result is not the reader scrolling up
          lastScrollTopRef.current = element.scrollTop;
          updateButtonPosition(element);
          return;
        }
        const currentTop = element.scrollTop;
        const movingUp = currentTop < lastScrollTopRef.current - 1;
        const distanceFromBottom = element.scrollHeight - currentTop - element.clientHeight;
        const trulyAtBottom = distanceFromBottom <= 12;

        if (movingUp) {
          autoFollowRef.current = false;
          userScrollIntentRef.current = true;
        }

        if (userScrollIntentRef.current) {
          if (trulyAtBottom) {
            autoFollowRef.current = true;
            userScrollIntentRef.current = false;
            setShowJumpToLatest(false);
            setHasUnseenBelow(false);
          } else {
            autoFollowRef.current = false;
            setShowJumpToLatest(element.scrollHeight > element.clientHeight + 4);
          }
        } else if (isNearBottom(element)) {
          autoFollowRef.current = true;
          setShowJumpToLatest(false);
          setHasUnseenBelow(false);
        } else {
          setShowJumpToLatest(element.scrollHeight > element.clientHeight + 4);
        }
        lastScrollTopRef.current = currentTop;
        updateButtonPosition(element);
      };

      const onWheel = (event: WheelEvent) => {
        finishLockUntilRef.current = 0;
        if (event.deltaY < 0) markUserScrollUp(element);
      };

      const onTouchStart = (event: TouchEvent) => {
        touchY = event.touches[0]?.clientY ?? null;
      };

      const onTouchMove = (event: TouchEvent) => {
        finishLockUntilRef.current = 0;
        const nextY = event.touches[0]?.clientY ?? null;
        if (touchY !== null && nextY !== null && nextY > touchY + 2) {
          markUserScrollUp(element);
        }
        touchY = nextY;
      };

      const onTouchEnd = () => {
        touchY = null;
      };

      element.addEventListener("scroll", onScroll, { passive: true });
      element.addEventListener("wheel", onWheel, { passive: true });
      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("touchmove", onTouchMove, { passive: true });
      element.addEventListener("touchend", onTouchEnd, { passive: true });

      detachListeners = () => {
        element.removeEventListener("scroll", onScroll);
        element.removeEventListener("wheel", onWheel);
        element.removeEventListener("touchstart", onTouchStart);
        element.removeEventListener("touchmove", onTouchMove);
        element.removeEventListener("touchend", onTouchEnd);
      };

      contentObserver = new MutationObserver(() => scheduleFollow(element, true));
      contentObserver.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      resizeObserver = new ResizeObserver(() => scheduleFollow(element, false));
      resizeObserver.observe(element);
      const contentRoot = element.firstElementChild;
      if (contentRoot instanceof HTMLElement) resizeObserver.observe(contentRoot);

      if (isNearBottom(element)) {
        autoFollowRef.current = true;
        setShowJumpToLatest(false);
      } else {
        setShowJumpToLatest(element.scrollHeight > element.clientHeight + 4);
      }
    };

    const discoverMessages = () => {
      const messages = shell.querySelector<HTMLElement>("[data-chat-messages]");
      if (messages) attach(messages);
    };

    discoverMessages();
    const shellObserver = new MutationObserver(discoverMessages);
    shellObserver.observe(shell, { childList: true, subtree: true });
    const onWindowResize = () => {
      if (attached) updateButtonPosition(attached);
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      shellObserver.disconnect();
      contentObserver?.disconnect();
      resizeObserver?.disconnect();
      detachListeners();
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      window.removeEventListener("resize", onWindowResize);
      if (latestScrollElementRef.current === attached) latestScrollElementRef.current = null;
    };
  }, []);

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
      if (openedChatAutoScrollRef.current === chatId || userScrollIntentRef.current) return;
      openedChatAutoScrollRef.current = chatId;

      const align = () => {
        if (userScrollIntentRef.current) return;
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

          const alignToFinishedResult = (smooth = true) => {
            const messages = shell.querySelector<HTMLElement>("[data-chat-messages]");
            if (!messages) return;

            // Completion is the one intentional exception to normal follow-mode:
            // even if the user scrolled upward while waiting, reveal the newly
            // finished image/video so they never have to hunt for it. The lock
            // keeps it there while media settles; the reader's own scroll ends it.
            // Follow-to-bottom stays OFF afterwards: a late-loading poster or the
            // action tray growing must never carry the view past the result. It
            // switches back on as soon as the reader themselves reaches the bottom.
            autoFollowRef.current = false;
            userScrollIntentRef.current = false;
            setShowJumpToLatest(false);
            setHasUnseenBelow(false);

            const results = messages.querySelectorAll<HTMLElement>('[data-generated-result="true"]');
            const result = results[results.length - 1];
            const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            const behavior: ScrollBehavior = reducedMotion || !smooth ? "auto" : "smooth";

            if (!result) {
              messages.scrollTo({ top: messages.scrollHeight, behavior });
              lastScrollTopRef.current = messages.scrollHeight;
              return;
            }

            const messagesRect = messages.getBoundingClientRect();
            const top = Math.max(0, messages.scrollTop + result.getBoundingClientRect().top - messagesRect.top - 10);
            if (Math.abs(top - messages.scrollTop) > 2) messages.scrollTo({ top, behavior });
            lastScrollTopRef.current = top;

            // Outside the workspace the whole page scrolls too: bring the chat's top just under the site header.
            if (!window.location.pathname.startsWith("/dashboard")) {
              const stickyHeaderOffset = window.matchMedia?.("(max-width: 767px)").matches ? 72 : 92;
              const delta = messagesRect.top - stickyHeaderOffset;
              if (Math.abs(delta) > 24) window.scrollBy({ top: delta, behavior });
            }
          };

          finishLockUntilRef.current = Date.now() + 4500;
          realignFinishedRef.current = (smooth) => alignToFinishedResult(smooth);

          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => alignToFinishedResult(true));
          });
          window.setTimeout(() => { if (Date.now() < finishLockUntilRef.current) alignToFinishedResult(false); }, 220);
          window.setTimeout(() => { if (Date.now() < finishLockUntilRef.current) alignToFinishedResult(false); }, 720);
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
      {toggle}
      {startOverDock}
      {showJumpToLatest && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute left-1/2 z-[80] inline-flex min-h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/[.12] bg-[#151027]/95 px-3 text-[10px] font-semibold text-white shadow-[0_14px_38px_-18px_rgba(0,0,0,.95)] backdrop-blur-xl transition hover:border-violet/35 hover:bg-[#1b1430]"
          style={{ bottom: latestButtonBottom }}
          aria-label="Jump to latest message"
        >
          <ArrowDown size={13} className="text-mint" />
          <span>Latest</span>
          {hasUnseenBelow && (
            <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_rgba(52,217,196,.75)]" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
