export type PaidGenerationStage = 'storyboarding' | 'rendering';

export interface PaidGenerationSnapshot {
  user_id: string | null;
  status: string;
  credits_spent: number;
}

/**
 * Provider-queue guard checked at the instant an attempt is about to start.
 * This catches a cancellation/refund that happens after the HTTP route's
 * exact authorization check but while a request is waiting for capacity.
 */
export function isPaidProviderReservationActive(
  snapshot: PaidGenerationSnapshot | null | undefined,
  expectedStage: PaidGenerationStage
) {
  return Boolean(
    snapshot &&
    snapshot.user_id &&
    snapshot.status === expectedStage &&
    Number.isSafeInteger(Number(snapshot.credits_spent)) &&
    Number(snapshot.credits_spent) > 0
  );
}

/**
 * Final defense before a paid model call. Public API handlers must first
 * atomically reserve/settle the full production amount on the owned job.
 */
export function isPaidProviderCallAuthorized(
  snapshot: PaidGenerationSnapshot | null | undefined,
  userId: string,
  requiredCredits: number,
  expectedStage: PaidGenerationStage
) {
  if (!snapshot || !isPaidProviderReservationActive(snapshot, expectedStage)) return false;
  return Boolean(
    snapshot.user_id === userId &&
    Number.isSafeInteger(requiredCredits) &&
    requiredCredits > 0 &&
    Number(snapshot.credits_spent) >= requiredCredits
  );
}
