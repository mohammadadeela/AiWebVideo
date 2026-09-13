import { SecureCheckoutModal } from './SecureCheckoutModal';
import type { CheckoutId } from '@/lib/api-client';

export function SubscriptionCheckoutModal({
  plan,
  planName,
  amountUsd,
  credits,
  jobId,
  onClose,
}: {
  plan: Extract<CheckoutId, 'creator' | 'pro' | 'agency'>;
  planName: string;
  amountUsd: number;
  credits: number;
  jobId?: string | null;
  onClose: () => void;
}) {
  return (
    <SecureCheckoutModal
      plan={plan}
      productName={`${planName} plan`}
      amountUsd={amountUsd}
      credits={credits}
      jobId={jobId}
      billingMode="subscription"
      onClose={onClose}
    />
  );
}
