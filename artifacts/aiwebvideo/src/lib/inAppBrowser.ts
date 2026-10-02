/**
 * Apps such as Google, Instagram and Facebook open links in their own embedded browser. It looks like a normal
 * browser but behaves differently: pop-up windows (Google/GitHub sign-in) are often blocked, Google refuses OAuth
 * inside most of them, cookies and storage can be restricted, and old pages are restored from the app's own cache.
 */
export interface InAppBrowser {
  /** A person-friendly name, e.g. "the Instagram app". */
  name: string;
  /** Google (and often GitHub) refuse to sign people in from inside this embedded browser. */
  providerSignInBlocked: boolean;
}

const KNOWN: Array<{ pattern: RegExp; name: string; blocked: boolean }> = [
  { pattern: /FBAN|FBAV|FB_IAB|FBIOS/i, name: "the Facebook app", blocked: true },
  { pattern: /Instagram/i, name: "the Instagram app", blocked: true },
  { pattern: /MicroMessenger/i, name: "WeChat", blocked: true },
  { pattern: /\bLine\//i, name: "the LINE app", blocked: true },
  { pattern: /TikTok|musical_ly|BytedanceWebview|trill/i, name: "the TikTok app", blocked: true },
  { pattern: /Snapchat/i, name: "the Snapchat app", blocked: true },
  { pattern: /LinkedInApp/i, name: "the LinkedIn app", blocked: true },
  { pattern: /Pinterest/i, name: "the Pinterest app", blocked: true },
  { pattern: /Twitter|TwitterAndroid/i, name: "the X (Twitter) app", blocked: true },
  // The Google app's own browser: sign-in windows can be unreliable there, but it is not refused outright.
  { pattern: /\bGSA\/|\bGoogleApp\b/i, name: "the Google app", blocked: false },
];

export function detectInAppBrowser(userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent): InAppBrowser | null {
  const ua = userAgent || "";
  for (const entry of KNOWN) if (entry.pattern.test(ua)) return { name: entry.name, providerSignInBlocked: entry.blocked };
  // Android WebView marks itself "; wv)". An iPhone/iPad embedded browser lacks the "Safari/" token that real Safari has.
  if (/; wv\)/i.test(ua)) return { name: "an app's built-in browser", providerSignInBlocked: true };
  if (/(iPhone|iPad|iPod)/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) {
    return { name: "an app's built-in browser", providerSignInBlocked: true };
  }
  return null;
}
