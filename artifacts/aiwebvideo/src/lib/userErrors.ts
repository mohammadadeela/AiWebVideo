/**
 * What a customer reads when something goes wrong. One place, so the same trouble always gets the same calm,
 * useful sentence: what happened, and what to do next. No status codes, no "Failed to fetch", no stack traces.
 */

export type FailureKind = "offline" | "timeout" | "network" | "session" | "credits" | "forbidden" | "missing" | "conflict" | "too_large" | "file_type" | "invalid" | "rate_limited" | "busy" | "server" | "unknown";

const MESSAGES: Record<FailureKind, string> = {
  offline: "You seem to be offline. Check your connection and try again. Nothing you entered is lost.",
  timeout: "This is taking longer than expected. Check your connection and try again.",
  network: "We could not reach the server. Check your connection and try again in a moment.",
  session: "Your session has ended. Please sign in again. What you entered is kept.",
  credits: "You do not have enough credits for this. Add credits or choose a smaller option.",
  forbidden: "You do not have permission to do that.",
  missing: "We could not find that. It may have been removed.",
  conflict: "That changed while you were working. Refresh the page and try again.",
  too_large: "That file is too large to upload. Use a smaller file (photos up to 10 MB each) and try again.",
  file_type: "That file type is not supported. Use JPEG, PNG or WEBP photos.",
  invalid: "Some details need another look. Check what you entered and try again.",
  rate_limited: "You are going a little fast. Wait a moment and try again.",
  busy: "The service is busy or restarting. Please try again in a minute.",
  server: "Something went wrong on our side. Please try again in a moment.",
  unknown: "Something went wrong. Please try again.",
};

export function failureMessage(kind: FailureKind): string {
  return MESSAGES[kind];
}

export function kindForStatus(status: number): FailureKind | null {
  switch (status) {
    case 401: return "session";
    case 402: return "credits";
    case 403: return "forbidden";
    case 404: case 410: return "missing";
    case 408: case 504: return status === 408 ? "timeout" : "busy";
    case 409: return "conflict";
    case 413: return "too_large";
    case 415: return "file_type";
    case 422: return "invalid";
    case 429: return "rate_limited";
    case 502: case 503: return "busy";
    default: return status >= 500 ? "server" : null;
  }
}

/**
 * The words for a failed reply. The server's own sentence wins when it sent one (it knows the details); when the reply had
 * no usable body (a proxy page, an empty 502, a closed connection) the status decides, and only then the caller's fallback.
 */
export function failureText(data: unknown, status: number, fallback: string): string {
  const said = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
  if (typeof said === "string" && said.trim()) return said.trim();
  const kind = kindForStatus(status);
  // A plain 400 with no words keeps the caller's own sentence, which knows what was being attempted.
  return kind ? MESSAGES[kind] : fallback;
}

export interface NetworkFailure { kind: "offline" | "timeout" | "network"; code: "NETWORK_OFFLINE" | "NETWORK_TIMEOUT" | "NETWORK_FAILED"; message: string }

/**
 * Turns what fetch throws into a failure we can explain, or null when it is not a connection problem (a deliberate
 * cancel stays a cancel, and a programming error stays visible to developers).
 */
export function classifyNetworkError(error: unknown, online = typeof navigator === "undefined" || navigator.onLine !== false): NetworkFailure | null {
  const name = (error as { name?: string } | null)?.name;
  if (name === "AbortError") return null;
  if (name === "TimeoutError") return online ? { kind: "timeout", code: "NETWORK_TIMEOUT", message: MESSAGES.timeout } : { kind: "offline", code: "NETWORK_OFFLINE", message: MESSAGES.offline };
  if (error instanceof TypeError) return online ? { kind: "network", code: "NETWORK_FAILED", message: MESSAGES.network } : { kind: "offline", code: "NETWORK_OFFLINE", message: MESSAGES.offline };
  return null;
}

/** The sentence to show for anything caught in a try/catch: our own failures read well already, anything else is explained calmly. */
export function userMessage(error: unknown, fallback = MESSAGES.unknown): string {
  if (error && typeof error === "object" && (error as { name?: string }).name === "ApiError") {
    const message = (error as { message?: string }).message;
    if (message && message.trim()) return message;
  }
  const network = classifyNetworkError(error);
  if (network) return network.message;
  // Raw browser wording must never reach a customer.
  const raw = error instanceof Error ? error.message : "";
  if (!raw || /failed to fetch|load failed|networkerror|the operation was aborted|signal timed out|unexpected token|json|undefined|cannot read propert/i.test(raw)) return fallback;
  return raw;
}
