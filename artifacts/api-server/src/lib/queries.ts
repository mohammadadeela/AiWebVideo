// Re-export the established query layer unchanged, with one completion wrapper
// that turns saved partial-delivery metadata into the final user-facing result.
export * from './queries-base.js';

import {
  completeJobWithResult as completeJobWithResultBase,
  getJob,
} from './queries-base.js';
import {
  partialDeliveryResultMessage,
  readPartialDeliveryMetadata,
} from './partial-delivery.js';

const GENERIC_READY_MESSAGE = 'Your production is ready to view and download.';

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
