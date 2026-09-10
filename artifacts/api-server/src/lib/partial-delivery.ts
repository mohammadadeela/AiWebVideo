export interface PartialDeliveryMetadata {
  requestedSeconds: number;
  deliveredSeconds: number;
  missingSeconds: number;
  refundedCredits: number;
  noAutomaticRetry: true;
}

/**
 * Build one normalized billing record for a shortened video delivery.
 * Returns null when the requested duration was fully delivered.
 */
export function buildPartialDeliveryMetadata(
  requestedSeconds: number,
  deliveredSeconds: number,
  perSecondCredits: number,
): PartialDeliveryMetadata | null {
  const requested = Math.max(0, Math.round(requestedSeconds));
  const delivered = Math.max(0, Math.min(requested, Math.round(deliveredSeconds)));
  const rate = Math.max(0, Math.round(perSecondCredits));
  const missing = Math.max(0, requested - delivered);
  if (missing === 0) return null;
  return {
    requestedSeconds: requested,
    deliveredSeconds: delivered,
    missingSeconds: missing,
    refundedCredits: missing * rate,
    noAutomaticRetry: true,
  };
}

/** Safely read partial-delivery metadata stored in a job workflow JSON object. */
export function readPartialDeliveryMetadata(value: unknown): PartialDeliveryMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const requestedSeconds = Number(record.requestedSeconds);
  const deliveredSeconds = Number(record.deliveredSeconds);
  const missingSeconds = Number(record.missingSeconds);
  const refundedCredits = Number(record.refundedCredits);
  if (
    !Number.isSafeInteger(requestedSeconds) || requestedSeconds <= 0 ||
    !Number.isSafeInteger(deliveredSeconds) || deliveredSeconds <= 0 ||
    !Number.isSafeInteger(missingSeconds) || missingSeconds <= 0 ||
    !Number.isSafeInteger(refundedCredits) || refundedCredits < 0 ||
    deliveredSeconds + missingSeconds !== requestedSeconds
  ) return null;
  return {
    requestedSeconds,
    deliveredSeconds,
    missingSeconds,
    refundedCredits,
    noAutomaticRetry: true,
  };
}

export function partialDeliveryResultMessage(meta: PartialDeliveryMetadata): string {
  const secondsLabel = meta.missingSeconds === 1 ? 'second' : 'seconds';
  return `Partial video ready — ${meta.deliveredSeconds}s of ${meta.requestedSeconds}s delivered. ` +
    `The AI video provider stopped before the final ${meta.missingSeconds} ${secondsLabel}, so AiWebVideo kept the completed video instead of starting another paid generation. ` +
    `${meta.refundedCredits} credits for the undelivered ${meta.missingSeconds}s were refunded automatically. ` +
    `For video duration, you were charged only for the ${meta.deliveredSeconds}s you received.`;
}
