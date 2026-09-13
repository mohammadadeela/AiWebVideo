import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { ApiError, request, startCheckout, type CheckoutId } from '@/lib/api-client';

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

const CARD_FIELD_STYLE = {
  input: {
    color: '#f8f7ff',
    'background-color': '#151020',
    'font-size': '16px',
    'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif',
    'font-weight': '600',
    'caret-color': '#ffffff',
    padding: '14px 14px',
  },
  'input::placeholder': { color: '#767087' },
  ':focus': { color: '#ffffff', 'background-color': '#171124' },
  '.invalid': { color: '#fb7185' },
  '.valid': { color: '#d8fff1' },
};

type PaymentState = 'idle' | 'processing' | 'success' | 'error';

function money(value: number) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'PRICE_CHANGED') return 'The offer expired. Close checkout and review the current price.';
    if (error.code === 'PAYPAL_ADVANCED_CARDS_NOT_ENABLED') return 'Card checkout is unavailable. Try PayPal instead.';
    if (error.code === 'CARD_PAYMENT_FAILED') return 'The card was not approved. Check the details or try another method.';
    if (error.code === 'PAYMENT_NOT_COMPLETED') return 'Your bank has not completed the payment yet. Try again in a moment.';
    if (error.code?.startsWith('PAYMENT_')) {
      return 'We could not finish verifying this payment. If your bank shows a charge, do not pay again—refresh your balance or contact support.';
    }
    if (error.code === 'RATE_LIMITED') return error.message;
    if (/internal server error/i.test(error.message)) {
      return 'We could not finish this payment. If your bank shows a charge, do not pay again—refresh your balance or contact support.';
    }
    return error.message;
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Payment could not be completed. Please try again.';
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
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (CARD_FIELD_SELECTORS.every((selector) => document.querySelector(selector))) return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  throw new Error('Card fields could not be loaded. Close checkout and try again.');
}

function FieldShell({ label, id }: { label: string; id: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-text-dim">{label}</span>
      <div
        id={id}
        className="h-[54px] overflow-hidden rounded-xl border border-white/10 bg-[#151020] shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition focus-within:border-violet/60 focus-within:ring-2 focus-within:ring-violet/10"
      />
    </label>
  );
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
  const [removingMethod, setRemovingMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CaptureResult | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const cardFieldsRef = useRef<CardFieldsInstance | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const saveCardRef = useRef(false);
  const amountRef = useRef(amountUsd);
  const closingRef = useRef(false);

  const submitting = paymentState === 'processing';
  const hasDiscount = Boolean(originalAmountUsd && originalAmountUsd > amountUsd + 0.005);

  useEffect(() => { saveCardRef.current = saveCard; }, [saveCard]);
  useEffect(() => { amountRef.current = amountUsd; }, [amountUsd]);

  function markError(value: unknown) {
    setPaymentState('error');
    setError(errorMessage(value));
  }

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
    setPaymentState('success');
    try {
      if (result.savedPaymentMethodId) localStorage.setItem(PREFERRED_METHOD_KEY, result.savedPaymentMethodId);
    } catch {
      // Only our opaque saved-method alias is remembered locally.
    }
    window.setTimeout(() => {
      if (closingRef.current) return;
      const suffix = jobId ? `&job=${encodeURIComponent(jobId)}` : '';
      window.location.href = `/dashboard?checkout=success${suffix}`;
    }, 1150);
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
      setPaymentState('idle');

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
          // Optional preference only.
        }
        setSavedMethods(methods);

        if (!nextConfig.configured || !nextConfig.advancedCardsEnabled) {
          setLoading(false);
          return;
        }

        await loadPayPalSdk(nextConfig);
        if (cancelled || !window.paypal) return;

        const cardFields = window.paypal.CardFields({
          style: CARD_FIELD_STYLE,
          createOrder: async () => {
            const order = await createOrder('card');
            if (Math.abs(order.amountUsd - amountRef.current) > 0.005) {
              throw new Error(`Price changed to ${money(order.amountUsd)}. Close checkout and review it.`);
            }
            return order.orderId;
          },
          onApprove: async ({ orderID }) => {
            try {
              setPaymentState('processing');
              const result = await capture(orderID);
              finishPayment(result);
            } catch (captureError) {
              markError(captureError);
            }
          },
          onCancel: () => markError(new Error('Verification was cancelled. Nothing was charged.')),
          onError: (providerError) => markError(providerError),
        });

        if (cardFields.isEligible()) {
          cardFieldsRef.current = cardFields;
          setCardEligible(true);
          setLoading(false);
          await waitForCardFieldContainers();
          if (cancelled) return;
          await Promise.all([
            Promise.resolve(cardFields.NameField({ placeholder: 'Name on card', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-name')),
            Promise.resolve(cardFields.NumberField({ placeholder: 'Card number', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-number')),
            Promise.resolve(cardFields.ExpiryField({ placeholder: 'MM / YY', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-expiry')),
            Promise.resolve(cardFields.CVVField({ placeholder: 'CVV', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-cvv')),
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
                    setPaymentState('processing');
                    setError(null);
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
                    markError(paymentError);
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
                  setPaymentState('processing');
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
                  }).catch((googleError) => markError(googleError));
                },
              });
              googleButtonRef.current.appendChild(button);
              setGooglePayEligible(true);
            }
          } catch {
            // Optional. Hide Google Pay when the merchant, device or browser is not eligible.
          }
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          cardFieldsRef.current = null;
          setCardEligible(false);
          markError(
            bootstrapError instanceof Error && bootstrapError.message.includes('could not be loaded')
              ? bootstrapError
              : new Error('Card fields could not load. Try PayPal instead.'),
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
    setPaymentState('processing');
    setError(null);
    try {
      await cardFieldsRef.current.submit();
    } catch (submitError) {
      markError(submitError);
    }
  }

  async function payWithSavedCard(method: SavedMethod) {
    if (submitting) return;
    setPaymentState('processing');
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
      markError(paymentError);
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
      markError(removeError);
    } finally {
      setRemovingMethod(null);
    }
  }

  async function continueWithPayPal() {
    if (submitting) return;
    setPaymentState('processing');
    setError(null);
    try {
      const { checkoutUrl } = await startCheckout(plan, jobId);
      window.location.href = checkoutUrl;
    } catch (paypalError) {
      markError(paypalError);
    }
  }

  function close() {
    if (submitting || success) return;
    closingRef.current = true;
    onClose();
  }

  const buyButtonClass = paymentState === 'success'
    ? 'border-emerald-300/30 bg-emerald-500 text-white shadow-[0_12px_30px_-12px_rgba(16,185,129,.75)]'
    : paymentState === 'error'
      ? 'border-rose-300/20 bg-rose-500 text-white shadow-[0_12px_30px_-12px_rgba(244,63,94,.65)]'
      : 'border-white/10 bg-signature text-white shadow-violet hover:brightness-110';

  const buyButtonContent = paymentState === 'success'
    ? <><Check size={17} strokeWidth={2.6} /> Paid {money(amountUsd)}</>
    : paymentState === 'processing'
      ? <><LoaderCircle size={17} className="animate-spin" /> Processing…</>
      : paymentState === 'error'
        ? <><AlertCircle size={17} /> Try again · Buy {money(amountUsd)}</>
        : <><LockKeyhole size={16} /> Buy {money(amountUsd)}</>;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Checkout for ${productName}`}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0d0918] shadow-[0_38px_120px_-28px_rgba(0,0,0,.96)] sm:max-w-[820px] sm:rounded-[30px]">
        <div className="pointer-events-none absolute -left-20 -top-28 h-64 w-64 rounded-full bg-violet/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-20 h-52 w-52 rounded-full bg-pink/10 blur-3xl" />

        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[.07] bg-[#0d0918]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-mint">
              <ShieldCheck size={13} /> Checkout
            </div>
            <h2 className="mt-1 truncate font-display text-lg font-bold text-white sm:text-xl">{productName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-[.13em] text-text-dim">Total</p>
              <p className="font-display text-xl font-black text-white">{money(amountUsd)}</p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={submitting || Boolean(success)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.025] text-text-muted transition hover:bg-white/[.06] hover:text-white disabled:opacity-40"
              aria-label="Close checkout"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {success ? (
          <div className="relative px-5 py-12 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-md rounded-[28px] border border-emerald-300/25 bg-emerald-400/[.08] p-7 text-center shadow-[0_24px_70px_-36px_rgba(16,185,129,.9)]">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                <BadgeCheck size={30} />
              </span>
              <h3 className="mt-4 font-display text-xl font-black text-white">Payment complete</h3>
              <p className="mt-2 text-sm text-text-muted">{success.creditsGranted.toLocaleString()} credits added</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
                <Check size={14} /> {money(success.amountUsd)} paid
              </div>
            </div>
          </div>
        ) : (
          <div className="relative grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-white/[.07] bg-white/[.018] p-5 md:border-b-0 md:border-r md:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-text-dim">Order summary</p>
              <div className="mt-4 rounded-2xl border border-white/[.08] bg-black/15 p-4">
                <p className="text-sm font-semibold text-white">{productName}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-text-dim">Credits</span>
                  <span className="font-utility font-bold text-white">{credits.toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-text-dim">Payment</span>
                  <span className="font-semibold text-text-muted">One-time</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                {hasDiscount && (
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-mint px-2 py-0.5 text-[9px] font-black text-[#08211b]">20% OFF</span>
                    <span className="text-xs text-text-dim line-through">{money(originalAmountUsd ?? amountUsd)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between gap-3">
                  <span className="text-xs font-semibold text-text-muted">Total</span>
                  <span className="font-display text-3xl font-black tracking-[-.04em] text-white">{money(amountUsd)}</span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/[.06] bg-black/10 p-3 text-[10px] leading-4 text-text-dim">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-mint" />
                Card data is entered in PayPal-hosted fields and is not stored by AiWebVideo.
              </div>
            </aside>

            <main className="min-w-0 p-5 sm:p-6 md:p-7">
              {savedMethods.length > 0 && (
                <section>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-white">Saved cards</p>
                    <span className="text-[9px] uppercase tracking-[.12em] text-text-dim">One click</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedMethods.slice(0, 4).map((method) => (
                      <div key={method.id} className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.025] p-2">
                        <button
                          type="button"
                          disabled={submitting || removingMethod === method.id}
                          onClick={() => void payWithSavedCard(method)}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left transition hover:bg-white/[.04] disabled:opacity-50"
                        >
                          <CreditCard size={16} className="shrink-0 text-violet" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold text-white">{method.brand} •••• {method.lastDigits}</span>
                            <span className="mt-0.5 block text-[9px] text-text-dim">{method.expiry ? `Exp ${method.expiry}` : 'Saved card'}</span>
                          </span>
                          <span className="text-[10px] font-black text-mint">Buy</span>
                        </button>
                        <button
                          type="button"
                          disabled={submitting || removingMethod === method.id}
                          onClick={() => void removeSavedCard(method)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-dim transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                          aria-label={`Remove ${method.brand} ending in ${method.lastDigits}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div ref={googleButtonRef} className={`${googlePayEligible ? 'mt-4 min-h-[48px] overflow-hidden rounded-xl' : 'hidden'}`} />

              {googlePayEligible && cardEligible && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/[.08]" />
                  <span className="text-[9px] font-bold uppercase tracking-[.13em] text-text-dim">or card</span>
                  <span className="h-px flex-1 bg-white/[.08]" />
                </div>
              )}

              {loading && (
                <div className="grid gap-3">
                  <div className="h-[72px] animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                  <div className="h-[72px] animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-[72px] animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                    <div className="h-[72px] animate-pulse rounded-xl border border-white/10 bg-white/[.025]" />
                  </div>
                </div>
              )}

              {!loading && cardEligible && (
                <section>
                  {!googlePayEligible && <p className="mb-3 text-xs font-bold text-white">Card details</p>}
                  <div className="grid gap-3">
                    <FieldShell label="Name on card" id="aiwebvideo-card-name" />
                    <FieldShell label="Card number" id="aiwebvideo-card-number" />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldShell label="Expiry" id="aiwebvideo-card-expiry" />
                      <FieldShell label="Security code" id="aiwebvideo-card-cvv" />
                    </div>
                  </div>

                  {config?.vaultEnabled && (
                    <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2.5 text-[11px] text-text-muted transition hover:bg-white/[.035]">
                      <input
                        type="checkbox"
                        checked={saveCard}
                        onChange={(event) => setSaveCard(event.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-black/30 accent-[#8b5cf6]"
                      />
                      <span className="font-semibold text-white">Save this card</span>
                      <span className="ml-auto text-[9px] text-text-dim">for faster checkout</span>
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => void payWithNewCard()}
                    disabled={submitting}
                    className={`mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${buyButtonClass}`}
                  >
                    {buyButtonContent}
                  </button>
                </section>
              )}

              {!loading && !cardEligible && (
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] px-3 py-2.5 text-[11px] text-amber-100">
                  Card payment is unavailable on this browser. Use PayPal below.
                </div>
              )}

              {error && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/[.07] p-3 text-[11px] leading-5 text-rose-200" role="alert" aria-live="polite">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => void continueWithPayPal()}
                disabled={submitting}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 text-xs font-bold text-text-muted transition hover:border-violet/25 hover:bg-white/[.055] hover:text-white disabled:opacity-50"
              >
                <WalletCards size={15} /> Buy with PayPal
              </button>
            </main>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
