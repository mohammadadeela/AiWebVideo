import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Shared viewport layer for creator controls. Does not lock document scrolling. */
export function CreatorPopover({ anchor, onClose, children, label, width = 290 }: {
  anchor: RefObject<HTMLElement | null>; onClose: () => void; children: ReactNode; label: string; width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position,setPosition] = useState({ left: 8, top: 8, maxHeight: 360, width });
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.current || !panel.current) return;
      const box = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const vw = viewport?.width ?? window.innerWidth;
      const vh = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const panelWidth = Math.min(width, vw - 16);
      const height = Math.min(panel.current.scrollHeight, 360, vh - 24);
      const below = vh - box.bottom - 8;
      const above = box.top - offsetTop - 8;
      const flip = below < Math.min(height, 180) && above > below;
      const top = flip ? Math.max(offsetTop + 8, box.top - height - 8)
        : Math.min(offsetTop + vh - height - 8, box.bottom + 8);
      setPosition({ left: Math.max(8, Math.min(vw - panelWidth - 8, box.left)),
        top, maxHeight: Math.min(360, vh - 24), width: panelWidth });
    };
    place();
    window.addEventListener('resize',place);
    window.addEventListener('scroll',place,true);
    window.visualViewport?.addEventListener('resize',place);
    return () => {
      window.removeEventListener('resize',place);
      window.removeEventListener('scroll',place,true);
      window.visualViewport?.removeEventListener('resize',place);
      if (panel.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true });
    };
  },[anchor,width]);
  return createPortal(<div ref={panel} data-creator-popover role="dialog" aria-label={label}
    style={{ position: 'fixed', left: position.left, top: position.top, width: position.width,
      maxHeight: position.maxHeight, zIndex: 90 }}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
      const options = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!options.length) return;
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus({ preventScroll: true }); event.preventDefault();
    }}
    className="overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#100c20] p-2 shadow-[0_24px_70px_-26px_rgba(0,0,0,.98)]">
    {children}
  </div>,document.body);
}
