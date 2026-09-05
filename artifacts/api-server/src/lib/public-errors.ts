const TECHNICAL_ERROR_PATTERN = /(?:exact error\s*:|\{\s*"?error"?\s*:|\b(?:INVALID_ARGUMENT|RESOURCE_EXHAUSTED|PERMISSION_DENIED|UNAUTHENTICATED|INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED)\b|\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)\b|personGeneration|allow_adult|generateAudio|negative.?prompt|googleapis\.com|@google\/genai|\bat\s+\S+\s+\([^)]*:\d+:\d+\))/i;

function compact(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

export function containsTechnicalError(message: string): boolean {
  return TECHNICAL_ERROR_PATTERN.test(message);
}

/**
 * Converts provider/implementation errors into safe, actionable API messages.
 * Human-authored messages without technical markers pass through unchanged.
 */
export function publicApiErrorMessage(message: string): string {
  const value = compact(message);
  if (!containsTechnicalError(value)) return value;

  if (/429|RESOURCE_EXHAUSTED|rate.?limit|quota|capacity|spend.?based/i.test(value)) {
    return 'The AI service is busy or has reached its current capacity. Please try again shortly.';
  }
  if (/policy|safety|blocked|content.?filter|responsible.?AI/i.test(value)) {
    return 'The AI safety system could not process this request. Adjust the idea or reference image and try again.';
  }
  if (/timeout|timed out|ETIMEDOUT|DEADLINE_EXCEEDED/i.test(value)) {
    return 'The request took longer than expected. Please try again.';
  }
  if (/INVALID_ARGUMENT|personGeneration|allow_adult|generateAudio|unsupported|400/i.test(value)) {
    return 'The AI service rejected a temporary generation setting. Please try again with a fresh version.';
  }
  if (/UNAVAILABLE|ECONNRESET|ECONNREFUSED|ENOTFOUND|502|503|504|service unavailable/i.test(value)) {
    return 'The AI service is temporarily unavailable. Please try again shortly.';
  }
  return 'The request could not be completed. Please try again.';
}

/**
 * Job errors are stored with complete provider diagnostics for administrators.
 * This function is the privacy boundary used when the job belongs to a normal
 * customer or guest.
 */
export function publicJobErrorMessage(message: string | null): string | null {
  if (!message) return null;
  const value = compact(message);
  if (!containsTechnicalError(value)) return value;

  if (/couldn'?t finish planning|finish planning your production|storyboard/i.test(value)) {
    return "We couldn't finish planning this production. No credits were used. Try again with a clearer idea or different references.";
  }
  if (/photos were delivered instead|photos were delivered.*video/i.test(value)) {
    return 'Your photos are ready, but the video could not be completed. The video credits were refunded. Create a fresh video version to try again.';
  }
  if (/voiceover narration wasn'?t available|narration.*refunded|voiceover.*refund/i.test(value)) {
    return 'Voiceover narration was unavailable, so the narration credits were refunded. Your generated video is still ready.';
  }
  if (/No website screenshots|no screenshots|visual references|reference assets/i.test(value)) {
    return 'This project did not have enough usable visual references. Add a website or reference photos and try again.';
  }
  if (/429|RESOURCE_EXHAUSTED|rate.?limit|quota|capacity|spend.?based/i.test(value)) {
    return 'The AI video service is busy or has reached its current capacity. Your reserved credits were restored. Please try again shortly.';
  }
  if (/policy|safety|blocked|content.?filter|responsible.?AI/i.test(value)) {
    return 'The AI safety system could not generate this request. Your reserved credits were restored. Adjust the idea or reference image and try again.';
  }
  if (/timeout|timed out|ETIMEDOUT|DEADLINE_EXCEEDED/i.test(value)) {
    return 'Generation took longer than expected and was stopped safely. Your reserved credits were restored. Create a fresh version and try again.';
  }
  if (/INVALID_ARGUMENT|personGeneration|allow_adult|generateAudio|unsupported|400/i.test(value)) {
    return 'The video service rejected a temporary generation setting. Your reserved credits were restored. Create a fresh version and try again.';
  }
  if (/returned no video|no video data|empty response|download.*failed/i.test(value)) {
    return 'The AI service did not return a complete video. Your reserved credits were restored. Create a fresh version and try again.';
  }
  if (/UNAVAILABLE|ECONNRESET|ECONNREFUSED|ENOTFOUND|502|503|504|service unavailable/i.test(value)) {
    return 'The AI service is temporarily unavailable. Your project is saved and any reserved credits were restored. Please try again shortly.';
  }
  return 'This production could not be completed. Your project is saved and any reserved credits were restored. Create a fresh version and try again.';
}

export function publicJobMessageContent(message: string): string {
  if (!containsTechnicalError(message)) return message;
  return publicJobErrorMessage(message)
    ?? 'This production could not be completed. Please create a fresh version and try again.';
}
