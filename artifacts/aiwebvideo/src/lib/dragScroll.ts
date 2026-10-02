/**
 * Mouse drag-to-scroll for the chat's sliders (rows marked data-drag-scroll).
 *
 * Why this exists: sliders are made of buttons, and the global stylesheet gives every button the
 * "click" hand cursor, so a row that could be scrolled never looked draggable, and with a mouse it
 * could not be dragged at all (touch swipes natively; a mouse only had the scrollbar and wheel).
 *
 * - Hovering a slider that overflows shows a grab cursor (`drag-scroll-ready`, see index.css).
 * - Pressing and moving more than a few pixels drags it and shows grabbing (`drag-scroll-active`).
 * - A press without movement is still an ordinary click on the button underneath.
 * - A drag never counts as a click on whatever is under the pointer when it is released.
 * - Touch and pen are untouched: they keep their native swipe.
 */
// Opt-in only: the chat's feature tabs and its examples strip. Ideas, filters, galleries and admin rows keep the
// normal cursor and normal behaviour.
const SLIDER = "[data-drag-scroll]";
const DRAG_THRESHOLD = 5;
// Things the pointer must be allowed to use normally instead of starting a drag.
const INTERACTIVE = "input, textarea, select, [contenteditable=''], [contenteditable='true'], video[controls], [data-no-drag]";

let installed = false;

function slider(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : null;
  return (element?.closest(SLIDER) as HTMLElement | null) ?? null;
}

function overflows(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth + 1;
}

export function installDragScroll(root: Document = document) {
  if (installed) return () => {};
  installed = true;

  let active: HTMLElement | null = null;
  let pointerId = -1;
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let swallowClick = false;
  let savedBehavior = "";
  let savedSnap = "";

  const onOver = (event: Event) => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType && pointer.pointerType !== "mouse") return;
    const element = slider(event.target);
    if (element) element.classList.toggle("drag-scroll-ready", overflows(element));
  };

  const onDown = (event: Event) => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType !== "mouse" || pointer.button !== 0) return;
    const element = slider(event.target);
    if (!element || !overflows(element)) return;
    if ((event.target as Element).closest(INTERACTIVE)) return;
    active = element;
    pointerId = pointer.pointerId;
    startX = pointer.clientX;
    startScroll = element.scrollLeft;
    dragging = false;
  };

  const onMove = (event: Event) => {
    const pointer = event as PointerEvent;
    if (!active || pointer.pointerId !== pointerId) return;
    const delta = pointer.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      dragging = true;
      // Smooth-scroll and scroll-snap fight a drag, so switch them off while it lasts.
      savedBehavior = active.style.scrollBehavior;
      savedSnap = active.style.scrollSnapType;
      active.style.scrollBehavior = "auto";
      active.style.scrollSnapType = "none";
      active.classList.add("drag-scroll-active");
      try { active.setPointerCapture(pointerId); } catch { /* the pointer may already be gone */ }
    }
    active.scrollLeft = startScroll - delta;
    event.preventDefault();
  };

  const finish = (event: Event) => {
    const pointer = event as PointerEvent;
    if (!active || pointer.pointerId !== pointerId) return;
    if (dragging) {
      swallowClick = true;
      // The click that follows a drag is cancelled; reset even if no click ever arrives.
      window.setTimeout(() => { swallowClick = false; }, 0);
      active.style.scrollBehavior = savedBehavior;
      active.style.scrollSnapType = savedSnap;
      active.classList.remove("drag-scroll-active");
      try { active.releasePointerCapture(pointerId); } catch { /* already released */ }
    }
    active = null;
    dragging = false;
  };

  const onClick = (event: Event) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  };

  // Dragging an image or link inside a slider would start the browser's own ghost-image drag.
  const onDragStart = (event: Event) => {
    if (slider(event.target)?.classList.contains("drag-scroll-ready")) event.preventDefault();
  };

  root.addEventListener("pointerover", onOver, true);
  root.addEventListener("pointerdown", onDown, true);
  root.addEventListener("pointermove", onMove, true);
  root.addEventListener("pointerup", finish, true);
  root.addEventListener("pointercancel", finish, true);
  root.addEventListener("click", onClick, true);
  root.addEventListener("dragstart", onDragStart, true);

  return () => {
    installed = false;
    root.removeEventListener("pointerover", onOver, true);
    root.removeEventListener("pointerdown", onDown, true);
    root.removeEventListener("pointermove", onMove, true);
    root.removeEventListener("pointerup", finish, true);
    root.removeEventListener("pointercancel", finish, true);
    root.removeEventListener("click", onClick, true);
    root.removeEventListener("dragstart", onDragStart, true);
  };
}
