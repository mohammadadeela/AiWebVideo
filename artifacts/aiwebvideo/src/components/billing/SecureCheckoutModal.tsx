import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, CreditCard, LockKeyhole, Trash2, WalletCards, X } from 'lucide-react';
import { ApiError, request, startCheckout, type CheckoutId } from '@/lib/api-client';
import { displayCredits } from '@/lib/credits';

interface CheckoutConfig {
  configured: boolean;
  clientId: string | null;
  environment: 'sandbox' | 'live';
  sdkBase: string;
  advancedCardsEnabled: boolean;
  vaultEnabled: boolean;
  googlePayEnabled: boolean;
  userIdToken: string | null;
}

interface SavedMethod {
  id: string;
  brand: string;
  lastDigits: string;
  expiry: string | null;
}

interface CardOrder {
  orderId: string;
  amountUsd: number;
  normalAmountUsd: number;
  discountApplied: boolean;
  creditsGranted: number;
  source: 'card' | 'saved_card' | 'google_pay';
  providerStatus?: string | null;
  payerActionRequired?: boolean;
  payerActionUrl?: string | null;
}

interface CaptureResult {
  ok: boolean;
  orderId: string;
  amountUsd: number;
  creditsGranted: number;
  savedPaymentMethodId?: string | null;
}

interface HostedField {
  render(selector: string): Promise<void> | void;
}

interface CardFieldsInstance {
  isEligible(): boolean;
  NameField(options?: Record<string, unknown>): HostedField;
  NumberField(options?: Record<string, unknown>): HostedField;
  ExpiryField(options?: Record<string, unknown>): HostedField;
  CVVField(options?: Record<string, unknown>): HostedField;
  submit(): Promise<void>;
}

interface PayPalGooglePayClient {
  config(): Promise<{
    allowedPaymentMethods: unknown[];
    merchantInfo?: Record<string, unknown>;
    apiVersion?: number;
    apiVersionMinor?: number;
  }>;
  confirmOrder(input: { orderId: string; paymentMethodData: unknown }): Promise<{ status?: string }>;
  initiatePayerAction(input: { orderId: string }): Promise<unknown>;
}

interface PayPalSdk {
  CardFields(options: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string; liabilityShift?: string }) => Promise<void> | void;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }): CardFieldsInstance;
  Googlepay?: () => PayPalGooglePayClient;
}

interface GooglePaymentsClient {
  isReadyToPay(input: Record<string, unknown>): Promise<{ result: boolean }>;
  createButton(input: {
    onClick: () => void;
    allowedPaymentMethods?: unknown[];
    buttonType?: string;
    buttonColor?: string;
  }): HTMLElement;
  loadPaymentData(input: Record<string, unknown>): Promise<unknown>;
}

interface GooglePayNamespace {
  payments?: {
    api?: {
      PaymentsClient: new (options: Record<string, unknown>) => GooglePaymentsClient;
    };
  };
}

declare global {
  interface Window {
    paypal?: PayPalSdk;
    google?: GooglePayNamespace;
  }
}

const PREFERRED_METHOD_KEY = 'aiwebvideo:preferred-payment-method';
const CARD_FIELD_SELECTORS = [
  '#aiwebvideo-card-name',
  '#aiwebvideo-card-number',
  '#aiwebvideo-card-expiry',
  '#aiwebvideo-card-cvv',
] as const;

function money(value: number) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'PRICE_CHANGED') return 'The offer expired. Close checkout and review the current price.';
    if (error.code === 'PAYPAL_ADVANCED_CARDS_NOT_ENABLED') return 'Card checkout is unavailable for this merchant account. Try PayPal.';
    if (error.code === 'CARD_PAYMENT_FAILED') return 'The card was not approved. Check the details or try another method.';
    if (error.code === 'RATE_LIMITED') return error.message;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Payment could not be completed. Please try again.';
}

function scriptPromise(id: string, src: string, attributes?: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Payment library failed to load.')), { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    for (const [key, value] of Object.entries(attributes ?? {})) script.setAttribute(key, value);
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Payment library failed to load.')), { once: true });
    document.head.appendChild(script);
  });
}

async function loadPayPalSdk(config: CheckoutConfig) {
  if (!config.clientId) throw new Error('Card checkout is not configured.');
  const components = config.googlePayEnabled ? 'card-fields,googlepay' : 'card-fields';
  const src = `${config.sdkBase}/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture&components=${encodeURIComponent(components)}`;
  const key = `${config.environment}:${config.clientId}:${components}:${config.userIdToken ?? ''}`;
  const current = document.getElementById('aiwebvideo-paypal-sdk') as HTMLScriptElement | null;
  if (current && current.dataset.checkoutKey !== key) {
    current.remove();
    try { delete window.paypal; } catch { window.paypal = undefined; }
  }
  await scriptPromise('aiwebvideo-paypal-sdk', src, {
    'data-page-type': 'checkout',
    'data-checkout-key': key,
    ...(config.userIdToken ? { 'data-user-id-token': config.userIdToken } : {}),
  });
  const loaded = document.getElementById('aiwebvideo-paypal-sdk') as HTMLScriptElement | null;
  if (loaded) loaded.dataset.checkoutKey = key;
  if (!window.paypal) throw new Error('Card checkout is unavailable in this browser.');
}

async function loadGooglePaySdk() {
  await scriptPromise('aiwebvideo-google-pay-sdk', 'https://pay.google.com/gp/p/js/pay.js');
}

async function waitForCardFieldContainers() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (CARD_FIELD_SELECTORS.every((selector) => document.querySelector(selector))) return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  throw new Error('Card fields could not be loaded. Close checkout and try again.');
}

export function SecureCheckoutModal({
  plan,
  productName,
  amountUsd,
  originalAmountUsd,
  credits,
  jobId,
  onClose,
}: {
  plan: CheckoutId;
  productName: string;
  amountUsd: number;
  originalAmountUsd?: number | null;
  credits: number;
  jobId?: string | null;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardEligible, setCardEligible] = useState(false);
  const [googlePayEligible, setGooglePayEligible] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingMethod, setRemovingMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CaptureResult | null>(null);
  const cardFieldsRef = useRef<CardFieldsInstance | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const saveCardRef = useRef(false);
  const amountRef = useRef(amountUsd);
  const closingRef = useRef(false);

  useEffect(() => { saveCardRef.current = saveCard; }, [saveCard]);
  useEffect(() => { amountRef.current = amountUsd; }, [amountUsd]);

  async function createOrder(source: 'card' | 'saved_card' | 'google_pay', paymentMethodId?: string) {
    return request<CardOrder>('/api/paypal-card/orders', {
      method: 'POST',
      body: JSON.stringify({
        plan,
        source,
        saveCard: source === 'card' ? saveCardRef.current : false,
        expectedAmountUsd: amountRef.current,
        ...(paymentMethodId ? { paymentMethodId } : {}),
        ...(jobId ? { jobId } : {}),
      }),
    });
  }

  async function capture(orderId: string) {
    return request<CaptureResult>(`/api/paypal-card/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      body: '{}',
    });
  }

  function finishPayment(result: CaptureResult) {
    setSuccess(result);
    setError(null);
    try {
      if (result.savedPaymentMethodId) localStorage.setItem(PREFERRED_METHOD_KEY, result.savedPaymentMethodId);
    } catch {
      // The optional local preference stores only our opaque payment-method alias.
    }
    window.setTimeout(() => {
      if (closingRef.current) return;
      const suffix = jobId ? `&job=${encodeURIComponent(jobId)}` : '';
      window.location.href = `/dashboard?checkout=success${suffix}`;
    }, 700);
  }

  useEffect(() => {
    closingRef.current = false;
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setCardEligible(false);
      setGooglePayEligible(false);
      cardFieldsRef.current = null;
      setError(null);

      try {
        const [nextConfig, methodsResponse] = await Promise.all([
          request<CheckoutConfig>('/api/paypal-card/config'),
          request<{ methods: SavedMethod[] }>('/api/paypal-card/methods').catch(() => ({ methods: [] })),
        ]);
        if (cancelled) return;

        setConfig(nextConfig);
        let methods = methodsResponse.methods;
        try {
          const preferred = localStorage.getItem(PREFERRED_METHOD_KEY);
          if (preferred) methods = [...methods].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
        } catch {
          // Local preference is optional.
        }
        setSavedMethods(methods);

        if (!nextConfig.configured || !nextConfig.advancedCardsEnabled) {
          setLoading(false);
          return;
        }

        await loadPayPalSdk(nextConfig);
        if (cancelled || !window.paypal) return;

        const cardFields = window.paypal.CardFields({
          style: {
            input: {
              color: '#f8f7ff',
              'font-size': '16px',
              'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif',
              'font-weight': '500',
            },
            ':focus': { color: '#ffffff' },
            '.invalid': { color: '#fb7185' },
            '.valid': { color: '#d8fff1' },
          },
          createOrder: async () => {
            const order = await createOrder('card');
            if (Math.abs(order.amountUsd - amountRef.current) > 0.005) {
              throw new Error(`Price changed to ${money(order.amountUsd)}. Close checkout and review it.`);
            }
            return order.orderId;
          },
          onApprove: async ({ orderID }) => {
            const result = await capture(orderID);
            finishPayment(result);
          },
          onCancel: () => {
            setSubmitting(false);
            setError('Verification was cancelled. Nothing was charged.');
          },
          onError: (providerError) => {
            setSubmitting(false);
            setError(errorMessage(providerError));
          },
        });

        if (cardFields.isEligible()) {
          cardFieldsRef.current = cardFields;
          setCardEligible(true);
          setLoading(false);
          await waitForCardFieldContainers();
          if (cancelled) return;
          await Promise.all([
            Promise.resolve(cardFields.NameField({ placeholder: 'Name on card' }).render('#aiwebvideo-card-name')),
            Promise.resolve(cardFields.NumberField({ placeholder: 'Card number' }).render('#aiwebvideo-card-number')),
            Promise.resolve(cardFields.ExpiryField({ placeholder: 'MM/YY' }).render('#aiwebvideo-card-expiry')),
            Promise.resolve(cardFields.CVVField({ placeholder: 'CVV' }).render('#aiwebvideo-card-cvv')),
          ]);
        }

        if (nextConfig.googlePayEnabled && window.paypal.Googlepay) {
          try {
            await loadGooglePaySdk();
            const GoogleClient = window.google?.payments?.api?.PaymentsClient;
            if (!GoogleClient || !window.paypal.Googlepay) throw new Error('Google Pay unavailable');
            const paypalGoogle = window.paypal.Googlepay();
            const googleConfig = await paypalGoogle.config();
            const paymentClient = new GoogleClient({
              environment: nextConfig.environment === 'live' ? 'PRODUCTION' : 'TEST',
              paymentDataCallbacks: {
                onPaymentAuthorized: async (paymentData: unknown) => {
                  try {
                    setSubmitting(true);
                    const order = await createOrder('google_pay');
                    if (Math.abs(order.amountUsd - amountRef.current) > 0.005) {
                      throw new Error(`Price changed to ${money(order.amountUsd)}. Close checkout and review it.`);
                    }
                    const paymentMethodData = (paymentData as { paymentMethodData?: unknown })?.paymentMethodData;
                    const confirmed = await paypalGoogle.confirmOrder({ orderId: order.orderId, paymentMethodData });
                    if (confirmed.status === 'PAYER_ACTION_REQUIRED') {
                      await paypalGoogle.initiatePayerAction({ orderId: order.orderId });
                    } else if (confirmed.status && confirmed.status !== 'APPROVED' && confirmed.status !== 'COMPLETED') {
                      throw new Error('Google Pay could not authorize this payment.');
                    }
                    const result = await capture(order.orderId);
                    finishPayment(result);
                    return { transactionState: 'SUCCESS' };
                  } catch (paymentError) {
                    setSubmitting(false);
                    setError(errorMessage(paymentError));
                    return { transactionState: 'ERROR', error: { message: errorMessage(paymentError) } };
                  }
                },
              },
            });
            const ready = await paymentClient.isReadyToPay({
              apiVersion: googleConfig.apiVersion ?? 2,
              apiVersionMinor: googleConfig.apiVersionMinor ?? 0,
              allowedPaymentMethods: googleConfig.allowedPaymentMethods,
            });
            if (ready.result && googleButtonRef.current) {
              googleButtonRef.current.replaceChildren();
              const button = paymentClient.createButton({
                buttonType: 'pay',
                buttonColor: 'black',
                allowedPaymentMethods: googleConfig.allowedPaymentMethods,
                onClick: () => {
                  setError(null);
                  void paymentClient.loadPaymentData({
                    apiVersion: googleConfig.apiVersion ?? 2,
                    apiVersionMinor: googleConfig.apiVersionMinor ?? 0,
                    allowedPaymentMethods: googleConfig.allowedPaymentMethods,
                    merchantInfo: googleConfig.merchantInfo ?? {},
                    transactionInfo: {
                      currencyCode: 'USD',
                      totalPriceStatus: 'FINAL',
                      totalPrice: amountRef.current.toFixed(2),
                    },
                    callbackIntents: ['PAYMENT_AUTHORIZATION'],
                  }).catch((googleError) => {
                    setSubmitting(false);
                    setError(errorMessage(googleError));
                  });
                },
              });
              googleButtonRef.current.appendChild(button);
              setGooglePayEligible(true);
            }
          } catch {
            // Google Pay is optional and is hidden when the buyer is not eligible.
          }
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          cardFieldsRef.current = null;
          setCardEligible(false);
          setError(
            bootstrapError instanceof Error && bootstrapError.message.includes('could not be loaded')
              ? bootstrapError.message
              : 'Card fields could not load. Try again or use PayPal.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      cardFieldsRef.current = null;
    };
  }, [plan, jobId]);

  async function payWithNewCard() {
    if (!cardFieldsRef.current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await cardFieldsRef.current.submit();
    } catch (submitError) {
      setSubmitting(false);
      setError(errorMessage(submitError));
    }
  }

  async function payWithSavedCard(method: SavedMethod) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder('saved_card', method.id);
      if (Math.abs(order.amountUsd - amountRef.current) > 0.005) {
        throw new Error(`Price changed to ${money(order.amountUsd)}. Close checkout and review it.`);
      }
      try { localStorage.setItem(PREFERRED_METHOD_KEY, method.id); } catch { /* optional */ }

      if (order.payerActionRequired) {
        if (!order.payerActionUrl) throw new Error('Your bank requires verification. Try the card again.');
        window.location.href = order.payerActionUrl;
        return;
      }

      const result = await capture(order.orderId);
      finishPayment(result);
    } catch (paymentError) {
      setSubmitting(false);
      setError(errorMessage(paymentError));
    }
  }

  async function removeSavedCard(method: SavedMethod) {
    if (removingMethod || submitting) return;
    setRemovingMethod(method.id);
    setError(null);
    try {
      await request<{ deleted: true }>(`/api/paypal-card/methods/${encodeURIComponent(method.id)}`, { method: 'DELETE' });
      setSavedMethods((current) => current.filter((item) => item.id !== method.id));
      try {
        if (localStorage.getItem(PREFERRED_METHOD_KEY) === method.id) localStorage.removeItem(PREFERRED_METHOD_KEY);
      } catch { /* optional */ }
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setRemovingMethod(null);
    }
  }

  async function continueWithPayPal() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { checkoutUrl } = await startCheckout(plan, jobId);
      window.location.href = checkoutUrl;
    } catch (paypalError) {
      setSubmitting(false);
      setError(errorMessage(paypalError));
    }
  }

  function close() {
    if (submitting || success) return;
    closingRef.current = true;
    onClose();
  }

  const hasDiscount = Boolean(originalAmountUsd && originalAmountUsd > amountUsd + 0.005);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Checkout for ${productName}`}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#100c1d] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_34px_110px_-30px_rgba(0,0,0,.95)] sm:max-w-[500px] sm:rounded-[28px] sm:p-6">
        <div className="pointer-events-none absolute inset-x-20 -top-20 h-40 rounded-full bg-violet/20 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-white">Checkout</h2>
            <p className="mt-1 truncate text-xs text-text-muted">{productName}</p>
          </div>
          <button type="button" onClick={close} disabled={submitting || Boolean(success)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close checkout">
            <X size={16} />
          </button>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]">
          <div className="flex items-center justify-between gap-4 border-b border-white/[.07] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[.13em] text-text-dim">Order</p>
              <p className="mt-1 text-sm font-semibold text-white">{credits.toLocaleString()} credits</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-text-muted">One-time</span>
          </div>
          <div className="flex items-end justify-between gap-4 px-4 py-3.5">
            <p className="text-xs font-semibold text-text-muted">Total</p>
            <div className="text-right">
              {hasDiscount && <p className="text-[11px] text-text-dim line-through">{money(originalAmountUsd ?? amountUsd)}</p>}
              <div className="flex items-center justify-end gap-2">
                {hasDiscount && <span className="rounded-full bg-mint px-2 py-0.5 text-[9px] font-black text-[#08211b]">20% OFF</span>}
                <p className="font-display text-2xl font-black text-white">{money(amountUsd)}</p>
              </div>
            </div>
          </div>
        </div>

        {success ? (
          <div className="relative mt-4 rounded-2xl border border-mint/30 bg-mint/[.08] p-5 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-mint/15 text-mint"><BadgeCheck size={22} /></span>
            <p className="mt-3 text-sm font-bold text-white">Payment complete</p>
            <p className="mt-1 text-xs text-text-muted">{displayCredits(success.creditsGranted).toLocaleString()} credits added</p>
          </div>
        ) : (
          <>
            {savedMethods.length > 0 && (
              <section className="relative mt-4">
                <p className="mb-2 text-xs font-semibold text-white">Saved cards</p>
                <div className="space-y-2">
                  {savedMethods.map((method) => (
                    <div key={method.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.025] p-2.5">
                      <button type="button" disabled={submitting || removingMethod === method.id} onClick={() => void payWithSavedCard(method)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition hover:bg-white/[.04] disabled:opacity-50">
                        <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-violet"><CreditCard size={18} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-white">{method.brand} •••• {method.lastDigits}</span>
                          <span className="mt-0.5 block text-[10px] text-text-dim">{method.expiry ? `Expires ${method.expiry}` : 'Saved card'}</span>
                        </span>
                        <span className="text-[10px] font-bold text-mint">Buy</span>
                      </button>
                      <button type="button" disabled={submitting || removingMethod === method.id} onClick={() => void removeSavedCard(method)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-dim transition hover:bg-pink/10 hover:text-pink disabled:opacity-40" aria-label={`Remove ${method.brand} ending in ${method.lastDigits}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div ref={googleButtonRef} className={`${googlePayEligible ? 'relative mt-4 min-h-11 overflow-hidden rounded-xl' : 'hidden'}`} />

            {loading && (
              <div className="relative mt-4 grid gap-2.5">
                <div className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                <div className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                  <div className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                </div>
              </div>
            )}

            {!loading && cardEligible && (
              <section className="relative mt-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white"><CreditCard size={14} className="text-violet" /> Card</div>
                <div className="grid gap-2.5">
                  <div id="aiwebvideo-card-name" className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus-within:border-violet/50" />
                  <div id="aiwebvideo-card-number" className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus-within:border-violet/50" />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div id="aiwebvideo-card-expiry" className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus-within:border-violet/50" />
                    <div id="aiwebvideo-card-cvv" className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus-within:border-violet/50" />
                  </div>
                </div>

                {config?.vaultEnabled && (
                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[11px] text-text-muted">
                    <input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} className="h-4 w-4 rounded border-white/20 bg-black/30 accent-[#8b5cf6]" />
                    Save card for next time
                  </label>
                )}

                <button type="button" onClick={() => void payWithNewCard()} disabled={submitting} className="premium-button mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-signature px-4 text-sm font-bold text-white shadow-violet transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                  <LockKeyhole size={15} /> {submitting ? 'Processing…' : `Buy ${money(amountUsd)}`}
                </button>
              </section>
            )}

            {!loading && !cardEligible && (
              <p className="relative mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-3 py-2.5 text-[11px] text-amber-100">Card checkout is unavailable here. Try PayPal.</p>
            )}

            {error && <p className="relative mt-3 rounded-xl border border-pink/20 bg-pink/[.06] p-3 text-xs leading-5 text-pink">{error}</p>}

            <button type="button" onClick={() => void continueWithPayPal()} disabled={submitting} className="relative mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-4 text-xs font-semibold text-text-muted transition hover:border-violet/25 hover:bg-white/[.06] hover:text-white disabled:opacity-50">
              <WalletCards size={15} /> Buy with PayPal
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
