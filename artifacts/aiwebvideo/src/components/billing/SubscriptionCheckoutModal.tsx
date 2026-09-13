import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Check,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { fetchSubscriptions, startCheckout, type CheckoutId, type SubscriptionSummary } from '@/lib/api-client';

const POLL_MS = 1500;
const MAX_WAIT_MS = 120_000;

type CheckoutState = 'idle' | 'opening' | 'waiting' | 'success' | 'error';

function money(value: number) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function centeredPopupFeatures() {
  const availableWidth = Math.max(360, window.screen.availWidth || window.innerWidth);
  const availableHeight = Math.max(560, window.screen.availHeight || window.innerHeight);
  const width = Math.min(540, Math.max(420, Math.round(availableWidth * 0.42)));
  const height = Math.min(760, Math.max(640, Math.round(availableHeight * 0.82)));
  const left = Math.max(0, Math.round((availableWidth - width) / 2));
  const top = Math.max(0, Math.round((availableHeight - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

function writeCheckoutPlaceholder(popup: Window, planName: string) {
  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AiWebVideo · ${planName}</title>
  <style>
    *{box-sizing:border-box} html,body{margin:0;min-height:100%;background:#0d0918;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{min-height:100vh;display:grid;place-items:center;padding:28px;background:radial-gradient(circle at 50% 16%,rgba(139,92,246,.2),transparent 38%),#0d0918}
    .card{width:min(390px,100%);padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:26px;background:rgba(255,255,255,.035);box-shadow:0 32px 90px rgba(0,0,0,.5);text-align:center}
    .mark{width:48px;height:48px;margin:0 auto 16px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#8b5cf6,#ec4899,#f59e0b);font-weight:900;font-size:20px}
    h1{margin:0;font-size:20px;letter-spacing:-.02em} p{margin:8px 0 0;color:#a7a0b8;font-size:13px;line-height:1.55}
    .loader{width:24px;height:24px;margin:22px auto 0;border:2px solid rgba(255,255,255,.16);border-top-color:#a78bfa;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="card"><div class="mark">A</div><h1>Opening secure checkout</h1><p>${planName} · AiWebVideo</p><div class="loader"></div></div>
</body>
</html>`);
    popup.document.close();
  } catch {
    // The provider window still works if a browser blocks document styling.
  }
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
  const [state, setState] = useState<CheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const cancelledRef = useRef(false);
  const checkingRef = useRef(false);

  const submitting = state === 'opening' || state === 'waiting';
  const success = state === 'success';

  useEffect(() => () => {
    cancelledRef.current = true;
    try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch { /* optional */ }
  }, []);

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
          // Provider webhook and browser polling can briefly race.
        }

        const popupClosed = popupRef.current?.closed ?? true;
        if (popupClosed && Date.now() - startedAt > 8_000) {
          const graceEnd = Date.now() + 7_000;
          while (!cancelledRef.current && Date.now() < graceEnd) {
            try {
              const result = await fetchSubscriptions();
              const subscriptions = Array.isArray(result.subscriptions) ? result.subscriptions : [];
              if (subscriptions.some((item) => isActiveSubscription(item, plan, previousIds))) return true;
            } catch { /* retry */ }
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
    cancelledRef.current = false;
    setError(null);
    setState('opening');

    const popup = window.open('about:blank', 'aiwebvideo-subscription', centeredPopupFeatures());
    if (!popup) {
      setState('error');
      setError('Your browser blocked the payment window. Allow pop-ups for AiWebVideo and try again.');
      return;
    }
    popupRef.current = popup;
    writeCheckoutPlaceholder(popup, planName);
    try { popup.focus(); } catch { /* optional */ }

    try {
      const before = await fetchSubscriptions().catch(() => ({ subscriptions: [] as SubscriptionSummary[] }));
      const previousIds = new Set((before.subscriptions ?? []).map((item) => item.id));
      const { checkoutUrl } = await startCheckout(plan, jobId);
      if (popup.closed) throw new Error('Checkout window was closed.');

      popup.location.replace(checkoutUrl);
      try { popup.focus(); } catch { /* optional */ }
      setState('waiting');

      const activated = await waitForActivation(previousIds);
      if (!activated) {
        setState('error');
        setError('The subscription was not completed. Nothing new was activated.');
        return;
      }

      try { if (!popup.closed) popup.close(); } catch { /* optional */ }
      setState('success');
      window.setTimeout(() => {
        const suffix = jobId ? `&job=${encodeURIComponent(jobId)}` : '';
        window.location.href = `/dashboard?checkout=success${suffix}`;
      }, 1150);
    } catch (checkoutError) {
      try { if (!popup.closed) popup.close(); } catch { /* optional */ }
      setState('error');
      setError(checkoutError instanceof Error && checkoutError.message
        ? checkoutError.message
        : 'Subscription checkout could not start. Try again.');
    }
  }

  function close() {
    if (submitting || success) return;
    cancelledRef.current = true;
    try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch { /* optional */ }
    onClose();
  }

  const buttonClass = state === 'success'
    ? 'border-emerald-300/30 bg-emerald-500 shadow-[0_14px_34px_-15px_rgba(16,185,129,.75)]'
    : state === 'error'
      ? 'border-rose-300/20 bg-rose-500 shadow-[0_14px_34px_-15px_rgba(244,63,94,.65)]'
      : 'border-white/10 bg-signature shadow-violet hover:brightness-110';

  const buttonContent = state === 'success'
    ? <><Check size={17} strokeWidth={2.6} /> Active</>
    : state === 'opening'
      ? <><LoaderCircle size={17} className="animate-spin" /> Opening checkout…</>
      : state === 'waiting'
        ? <><RefreshCw size={16} className="animate-spin" /> Waiting for approval…</>
        : state === 'error'
          ? <><AlertCircle size={17} /> Try again · Buy {money(amountUsd)}/mo</>
          : <><ExternalLink size={16} /> Buy {money(amountUsd)}/mo</>;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${planName} subscription checkout`}
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0d0918] shadow-[0_38px_120px_-28px_rgba(0,0,0,.96)] sm:max-w-[600px] sm:rounded-[30px]">
        <div className="pointer-events-none absolute inset-x-16 -top-24 h-44 rounded-full bg-violet/20 blur-3xl" />

        <header className="relative flex items-start justify-between gap-4 border-b border-white/[.07] px-5 py-5 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-mint">
              <ShieldCheck size={13} /> Subscription checkout
            </div>
            <h2 className="mt-1.5 font-display text-xl font-black text-white">{planName}</h2>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={submitting || success}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.025] text-text-muted transition hover:bg-white/[.06] hover:text-white disabled:opacity-40"
            aria-label="Close checkout"
          >
            <X size={16} />
          </button>
        </header>

        <div className="relative p-5 sm:p-7">
          {success ? (
            <div className="rounded-[26px] border border-emerald-300/25 bg-emerald-400/[.08] p-7 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><BadgeCheck size={30} /></span>
              <h3 className="mt-4 font-display text-xl font-black text-white">Subscription active</h3>
              <p className="mt-2 text-sm text-text-muted">{credits.toLocaleString()} credits every month</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><Check size={14} /> Activated</div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-[.13em] text-text-dim">Plan</p>
                  <p className="mt-1.5 text-base font-bold text-white">{planName}</p>
                  <p className="mt-1 text-xs text-text-muted">{credits.toLocaleString()} credits every month</p>
                </div>
                <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                  <p className="text-[10px] uppercase tracking-[.13em] text-text-dim">Today</p>
                  <p className="mt-1.5 font-display text-2xl font-black text-white">{money(amountUsd)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-white/[.08] bg-black/10 px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet/10 text-violet"><CalendarClock size={17} /></span>
                  <div>
                    <p className="text-xs font-bold text-white">Monthly renewal</p>
                    <p className="mt-0.5 text-[10px] text-text-dim">Cancel anytime</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-text-muted">{money(amountUsd)}/mo</span>
              </div>

              <button
                type="button"
                onClick={() => void buySubscription()}
                disabled={submitting}
                className={`mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-75 ${buttonClass}`}
              >
                {buttonContent}
              </button>

              {state === 'waiting' && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-violet/15 bg-violet/[.06] px-3 py-2.5 text-[11px] text-text-muted" aria-live="polite">
                  <LoaderCircle size={14} className="shrink-0 animate-spin text-violet" />
                  Complete the PayPal approval window. AiWebVideo will finish automatically.
                </div>
              )}

              {error && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/[.07] p-3 text-[11px] leading-5 text-rose-200" role="alert">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
