/**
 * Website-mode Idea chips show only their short text in the prompt box. The longer creative direction
 * travels with the brief between these markers so it survives the landing preview, sign-in redirects and
 * stored drafts. The server splits it off on arrival; anything the customer can see goes through
 * visibleBrief(), so the direction is never displayed.
 */
const OPEN = "[[AIWEBVIDEO_DIRECTION]]";
const CLOSE = "[[/AIWEBVIDEO_DIRECTION]]";

export function withHiddenDirection(text: string, direction?: string | null): string {
  const clean = visibleBrief(text);
  const extra = direction?.trim();
  return extra ? `${clean}\n\n${OPEN}\n${extra}\n${CLOSE}` : clean;
}

/** The customer's own words, with any hidden direction removed. */
export function visibleBrief(text: string | null | undefined): string {
  if (!text) return "";
  const start = text.indexOf(OPEN);
  if (start < 0) return text;
  const end = text.indexOf(CLOSE, start);
  return `${text.slice(0, start)}${end < 0 ? "" : text.slice(end + CLOSE.length)}`.trim();
}
