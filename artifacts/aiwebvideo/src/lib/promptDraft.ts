/**
 * The text someone typed in the creation box, kept for this browser session so switching feature (or page)
 * never means rewriting or pasting it again. It is cleared when the production is actually submitted.
 */
const KEY = "aiwebvideo_prompt_draft";
export const PROMPT_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function parsePromptDraft(raw: string | null, now = Date.now()): string {
  if (!raw) return "";
  try {
    const value = JSON.parse(raw) as { text?: unknown; savedAt?: unknown } | null;
    if (!value || typeof value.text !== "string" || typeof value.savedAt !== "number") return "";
    return now - value.savedAt > PROMPT_DRAFT_MAX_AGE_MS ? "" : value.text.slice(0, 8000);
  } catch { return ""; }
}

export function loadPromptDraft(): string {
  try { return parsePromptDraft(sessionStorage.getItem(KEY)); } catch { return ""; }
}

export function savePromptDraft(text: string) {
  try {
    if (text.trim()) sessionStorage.setItem(KEY, JSON.stringify({ text: text.slice(0, 8000), savedAt: Date.now() }));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage can be blocked */ }
}

export function clearPromptDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
