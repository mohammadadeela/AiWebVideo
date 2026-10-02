/** What to tell someone while a link is being read, so a slow page never looks like a frozen app. */
export type LinkMessages = readonly [string, string, string];

export function linkStatusMessage(elapsedSeconds: number, messages: LinkMessages): string {
  if (elapsedSeconds < 3) return messages[0];
  if (elapsedSeconds < 9) return messages[1];
  return messages[2];
}

/** True when the text looks like a web address worth reading (a scheme is optional: "shop.com/item" counts). */
export function looksLikeLink(value: string): boolean {
  const text = value.trim();
  if (!text || /\s/.test(text)) return false;
  return /^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(text) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(text);
}

export function withScheme(value: string): string {
  const text = value.trim();
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}
