// Re-export the established query layer unchanged, with focused wrappers for
// partial delivery and user-requested cancellation billing.
export * from './queries-base.js';

import {
  completeJobWithResult as completeJobWithResultBase,
  getJob,
  refundJobCredits as refundJobCreditsBase,
  updateJob as updateJobBase,
} from './queries-base.js';
import {
  partialDeliveryResultMessage,
  readPartialDeliveryMetadata,
} from './partial-delivery.js';

const GENERIC_READY_MESSAGE = 'Your production is ready to view and download.';

/**
 * A user choosing Stop after paid AI production has started does not refund the
 * production reservation. Provider work may already have started (or may be
 * impossible to cancel remotely), so keeping the reservation avoids turning a
 * customer cancellation into an operator/provider loss.
 *
 * Genuine provider failures, interrupted-server recovery, partial delivery,
 * missing narration, and every other non-user cancellation keep using the
 * normal refund path unchanged.
 */
function isUserRequestedCancellationRefund(reason: string) {
  return /^Cancelled (?:render refund|before production)\b/i.test(reason.trim());
}

export async function refundJobCredits(
  jobId: string,
  userId: string,
  requestedAmount: number,
  reason: string,
): Promise<number> {
  if (isUserRequestedCancellationRefund(reason)) {
    console.info(
      `[credits] cancellation keeps reservation job=${jobId} user=${userId} amount=${Math.max(0, requestedAmount)} reason=${reason}`,
    );
    return 0;
  }
  return refundJobCreditsBase(jobId, userId, requestedAmount, reason);
}

/**
 * Existing render/storyboard cancellation paths used to zero credits_spent
 * after refunding. The refund wrapper above deliberately keeps the charge, so
 * also keep the authoritative job spend and replace stale "credits restored"
 * status text with the exact amount that was consumed.
 */
export async function updateJob(
  id: string,
  patch: Parameters<typeof updateJobBase>[1],
): ReturnType<typeof updateJobBase> {
  if (patch.status === 'cancelled' && patch.credits_spent === 0) {
    const current = await getJob(id);
    const chargedCredits = Math.max(0, current?.credits_spent ?? 0);
    const { credits_spent: _legacyReset, ...rest } = patch;
    return updateJobBase(id, {
      ...rest,
      status_message: chargedCredits > 0
        ? `Cancelled · ${chargedCredits} credits used · not refundable after Stop`
        : 'Cancelled',
    });
  }
  return updateJobBase(id, patch);
}

export async function completeJobWithResult(
  jobId: string,
  workflowState: Record<string, unknown>,
  resultMessage: string,
  errorMessage: string | null,
): Promise<void> {
  const current = await getJob(jobId);
  const currentWorkflow = current?.workflow_state && typeof current.workflow_state === 'object'
    ? current.workflow_state as Record<string, unknown>
    : null;
  const partialDelivery = readPartialDeliveryMetadata(currentWorkflow?.partialDelivery);

  if (!partialDelivery) {
    return completeJobWithResultBase(jobId, workflowState, resultMessage, errorMessage);
  }

  const partialMessage = partialDeliveryResultMessage(partialDelivery);
  const trimmedResult = resultMessage.trim();
  const additionalResult = trimmedResult && trimmedResult !== GENERIC_READY_MESSAGE
    ? trimmedResult
    : '';

  return completeJobWithResultBase(
    jobId,
    {
      ...workflowState,
      partialDelivery,
    },
    additionalResult ? `${partialMessage} ${additionalResult}` : partialMessage,
    errorMessage,
  );
}
