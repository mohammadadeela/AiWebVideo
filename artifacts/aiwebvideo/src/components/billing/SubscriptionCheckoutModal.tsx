import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, CalendarClock, X } from 'lucide-react';
import { fetchSubscriptions, startCheckout, type CheckoutId, type SubscriptionSummary } from '@/lib/api-client';

const POLL_MS = 1600;
const MAX_WAIT_MS = 120_000;

function money(value: number) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function centeredPopupFeatures() {
  const width = Math.min(520, Math.max(360, window.screen.availWidth - 40));
  const height = Math.min(760, Math.max(620, window.screen.availHeight - 80));
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

function isActiveSubscription(subscription: SubscriptionSummary, plan: string, previousIds: Set<string>) {
  if (previousIds.has(subscription.id)) return false;
  const status = String(subscription.status ?? '').toLowerCase();
  return subscription.plan === plan && ['active', 'approved'].includes(status);
}

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
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const cancelledRef = useRef(false);
  const checkingRef = useRef(false);

  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

  const perCredit = useMemo(() => amountUsd / Math.max(1, credits), [amountUsd, credits]);

  async function waitForActivation(previousIds: Set<string>) {
    if (checkingRef.current) return false;
    checkingRef.current = true;
    const startedAt = Date.now();
    try {
      while (!cancelledRef.current && Date.now() - startedAt < MAX_WAIT_MS) {
        try {
          const result = await fetchSubscriptions();
          const subscriptions = Array.isArray(result.subscriptions) ? result.subscriptions : [];
          if (subscriptions.some((item) => isActiveSubscription(item, plan, previousIds))) return true;
        } catch {
          // Webhook settlement can race the browser. Keep checking while the
          // provider window is open instead of turning a transient read into a failure.
        }

        const popupClosed = popupRef.current?.closed ?? true;
        if (popupClosed && Date.now() - startedAt > 8_000) {
          // Give the verified PayPal webhook a short grace period after the
          // approval window closes before deciding the flow was abandoned.
          const graceEnd = Date.now() + 6_000;
          while (!cancelledRef.current && Date.now() < graceEnd) {
            try {
              const result = await fetchSubscriptions();
              const subscriptions = Array.isArray(result.subscriptions) ? result.subscriptions : [];
              if (subscriptions.some((item) => isActiveSubscription(item, plan, previousIds))) return true;
            } catch { /* retry below */ }
            await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
          }
          return false;
        }
        await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
      }
      return false;
    } finally {
      checkingRef.current = false;
    }
  }

  async function buySubscription() {
    if (submitting || success) return;
    setSubmitting(true);
    setError(null);

    // Open synchronously from the user's click so strict popup blockers allow
    // it. AiWebVideo stays open behind the provider approval window.
    const popup = window.open('about:blank', 'aiwebvideo-subscription', centeredPopupFeatures());
    if (!popup) {
      setSubmitting(false);
      setError('Allow pop-ups for AiWebVideo, then try again.');
      return;
    }
    popupRef.current = popup;

    try {
      popup.document.title = 'AiWebVideo checkout';
      popup.document.body.innerHTML = '<div style="font-family:system-ui;background:#100c1d;color:white;min-height:100vh;display:grid;place-items:center;margin:0"><div style="opacity:.75">Opening checkout…</div></div>';
    } catch {
      // A browser can restrict access to the temporary about:blank document.
    }

    try {
      const before = await fetchSubscriptions().catch(() => ({ subscriptions: [] as SubscriptionSummary[] }));
      const previousIds = new Set((before.subscriptions ?? []).map((item) => item.id));
      const { checkoutUrl } = await startCheckout(plan, jobId);
      if (popup.closed) throw new Error('Checkout window was closed.');
      popup.location.replace(checkoutUrl);

      const activated = await waitForActivation(previousIds);
      if (!activated) {
        setError('Subscription was not completed. You can try again.');
        setSubmitting(false);
        return;
      }

      try { if (!popup.closed) popup.close(); } catch { /* optional */ }
      setSuccess(true);
      window.setTimeout(() => {
        const suffix = jobId ? `&job=${encodeURIComponent(jobId)}` : '';
        window.location.href = `/dashboard?checkout=success${suffix}`;
      }, 700);
    } catch (checkoutError) {
      try { if (!popup.closed) popup.close(); } catch { /* optional */ }
      setSubmitting(false);
      setError(checkoutError instanceof Error && checkoutError.message
        ? checkoutError.message
        : 'Subscription checkout could not start. Try again.');
    }
  }

  function close() {
    if (submitting || success) return;
    cancelledRef.current = true;
    onClose();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${planName} subscription checkout`}
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="relative w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#100c1d] p-4 shadow-[0_34px_110px_-30px_rgba(0,0,0,.95)] sm:max-w-[480px] sm:rounded-[28px] sm:p-6">
        <div className="pointer-events-none absolute inset-x-16 -top-24 h-44 rounded-full bg-violet/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Checkout</h2>
            <p className="mt-1 text-xs text-text-muted">{planName} plan</p>
          </div>
          <button type="button" onClick={close} disabled={submitting || success} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close checkout">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="relative mt-5 rounded-2xl border border-mint/30 bg-mint/[.08] p-5 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-mint/15 text-mint"><BadgeCheck size={22} /></span>
            <p className="mt-3 text-sm font-bold text-white">Subscription active</p>
            <p className="mt-1 text-xs text-text-muted">{credits.toLocaleString()} credits every month</p>
          </div>
        ) : (
          <>
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]">
              <div className="flex items-center justify-between gap-4 border-b border-white/[.07] px-4 py-3.5">
                <div>
                  <p className="text-[10px] uppercase tracking-[.13em] text-text-dim">Plan</p>
                  <p className="mt-1 text-sm font-semibold text-white">{planName}</p>
                </div>
                <span className="font-utility text-sm font-semibold text-mint">{credits.toLocaleString()} credits/mo</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/[.07]">
                <div className="bg-[#100c1d] px-4 py-3">
                  <p className="text-[10px] text-text-dim">Today</p>
                  <p className="mt-1 font-display text-xl font-bold text-white">{money(amountUsd)}</p>
                </div>
                <div className="bg-[#100c1d] px-4 py-3">
                  <p className="text-[10px] text-text-dim">Renews</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white"><CalendarClock size={13} className="text-violet" /> Monthly</p>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => void buySubscription()} disabled={submitting} className="premium-button relative mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-signature px-4 text-sm font-bold text-white shadow-violet transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55">
              {submitting ? 'Confirming…' : `Buy ${money(amountUsd)}/mo`}
            </button>
            <p className="relative mt-2 text-center text-[10px] text-text-dim">Cancel anytime · recurring approval opens in a small PayPal window</p>
            {error && <p className="relative mt-3 rounded-xl border border-pink/20 bg-pink/[.06] p-3 text-xs leading-5 text-pink">{error}</p>}
            <p className="relative mt-3 text-center text-[9px] text-text-dim">${perCredit.toFixed(3)} per credit</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
