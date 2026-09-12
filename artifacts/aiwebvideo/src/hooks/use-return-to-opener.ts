import { useEffect } from 'react';

type ScrollPosition = {
  element: HTMLElement;
  left: number;
  top: number;
};

type ReturnSnapshot = {
  opener: HTMLElement;
  route: string;
  scrollPositions: ScrollPosition[];
  windowX: number;
  windowY: number;
};

const OPEN_OVERLAY_SELECTOR = '[role="dialog"][aria-modal="true"]';

function currentRoute() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function activationTarget(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-expanded]')
    : null;
}

function captureReturnSnapshot(opener: HTMLElement): ReturnSnapshot {
  const scrollPositions: ScrollPosition[] = [];
  let parent = opener.parentElement;
  while (parent) {
    if (parent.scrollHeight > parent.clientHeight + 1 || parent.scrollWidth > parent.clientWidth + 1) {
      scrollPositions.push({ element: parent, left: parent.scrollLeft, top: parent.scrollTop });
    }
    parent = parent.parentElement;
  }
  return {
    opener,
    route: currentRoute(),
    scrollPositions,
    windowX: window.scrollX,
    windowY: window.scrollY,
  };
}

function restoreReturnSnapshot(snapshot: ReturnSnapshot) {
  if (snapshot.route !== currentRoute()) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (snapshot.route !== currentRoute()) return;
      for (const position of snapshot.scrollPositions) {
        if (!position.element.isConnected) continue;
        position.element.scrollLeft = position.left;
        position.element.scrollTop = position.top;
      }
      window.scrollTo(snapshot.windowX, snapshot.windowY);
      if (snapshot.opener.isConnected) snapshot.opener.focus({ preventScroll: true });
    });
  });
}

/**
 * Preserve the user's place whenever a site control opens a modal, drawer,
 * menu, accordion, or other aria-expanded surface. Closing returns focus to
 * the opener and restores both the page and nested chat scroll positions.
 */
export function useReturnToOpener() {
  useEffect(() => {
    let pending: ReturnSnapshot | null = null;
    let pendingAt = 0;
    const expanded = new Map<HTMLElement, ReturnSnapshot>();
    const overlays = new Map<Element, ReturnSnapshot>();

    const rememberActivation = (event: Event) => {
      const opener = activationTarget(event.target);
      if (!opener) return;
      pending = captureReturnSnapshot(opener);
      pendingAt = Date.now();
    };

    const syncExpandedControl = (control: HTMLElement) => {
      const isOpen = control.getAttribute('aria-expanded') === 'true';
      if (isOpen && !expanded.has(control)) {
        const snapshot = pending?.opener === control && Date.now() - pendingAt < 1_500
          ? pending
          : captureReturnSnapshot(control);
        expanded.set(control, snapshot);
      } else if (!isOpen) {
        const snapshot = expanded.get(control);
        if (snapshot) restoreReturnSnapshot(snapshot);
        expanded.delete(control);
      }
    };

    const syncOverlays = () => {
      const openNow = new Set(document.querySelectorAll(OPEN_OVERLAY_SELECTOR));
      for (const overlay of openNow) {
        if (overlays.has(overlay)) continue;
        const fallback = document.activeElement instanceof HTMLElement && !overlay.contains(document.activeElement)
          ? captureReturnSnapshot(document.activeElement)
          : null;
        const snapshot = pending && Date.now() - pendingAt < 1_500 ? pending : fallback;
        if (snapshot) overlays.set(overlay, snapshot);
      }
      for (const [overlay, snapshot] of overlays) {
        if (openNow.has(overlay)) continue;
        overlays.delete(overlay);
        restoreReturnSnapshot(snapshot);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') rememberActivation(event);
    };

    document.addEventListener('pointerdown', rememberActivation, true);
    document.addEventListener('keydown', onKeyDown, true);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          syncExpandedControl(mutation.target);
        }
      }
      syncOverlays();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      childList: true,
      subtree: true,
    });
    syncOverlays();

    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', rememberActivation, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
