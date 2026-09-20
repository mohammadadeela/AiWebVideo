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
import { ApiError, request, type CheckoutId } from '@/lib/api-client';

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
  subscriptionId?: string | null;
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
    buttonSizeMode?: string;
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

// PayPal Card Fields are hosted inside an iframe. Keep the iframe itself visually
// transparent and let the application-owned container below provide the single
// visible input surface. This avoids the nested "box inside a box" appearance.
// These properties are limited to PayPal's documented Card Fields styling API.
const CARD_FIELD_STYLE = {
  input: {
    color: '#171321',
    background: 'transparent',
    border: '0',
    borderRadius: '0',
    boxShadow: 'none',
    fontSize: '16px',
    lineHeight: '22px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: '600',
    height: '54px',
    padding: '0 14px',
    outline: 'none',
  },
  ':focus': {
    color: '#171321',
    background: 'transparent',
    border: '0',
    boxShadow: 'none',
    outline: 'none',
  },
  '.invalid': { color: '#b4233d' },
  '.valid': { color: '#171321' },
};

type PaymentState = 'idle' | 'processing' | 'success' | 'error';
type BillingMode = 'one_time' | 'subscription';

let configCache: { value: CheckoutConfig; expiresAt: number } | null = null;
let configPromise: Promise<CheckoutConfig> | null = null;

function money(value: number) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'PRICE_CHANGED') return 'The price changed. Close checkout, review it, and try again.';
    if (error.code === 'PAYPAL_RECURRING_CARDS_NOT_ENABLED') return 'Monthly card billing is not available for this payment account yet. Try another card.';
    if (error.code === 'PAYPAL_ADVANCED_CARDS_NOT_ENABLED') return 'Card checkout is temporarily unavailable. Try again later.';
    if (error.code === 'CARD_PAYMENT_FAILED') return 'The card was not approved. Check the details or try another payment method.';
    if (error.code === 'PAYMENT_NOT_COMPLETED') return 'Your bank has not completed the payment yet. Try again in a moment.';
    if (error.code === 'PAYMENT_METHOD_NOT_FOUND') return 'This saved card is no longer available. Use another saved card or enter a new card.';
    if (error.code === 'PAYMENT_METHOD_REQUIRED') return 'Choose a saved card or enter a new card to continue.';
    if (error.code === 'PAYMENT_METHOD_OWNERSHIP_MISMATCH') return 'This saved card could not be verified for your account. Please use another card.';
    if (error.code === 'SUBSCRIPTION_VAULT_PENDING') return error.message;
    if (error.code?.startsWith('PAYMENT_')) {
      return 'We could not finish verifying this payment. If your bank shows a charge, do not pay again—refresh your balance or contact support.';
    }
    if (error.code === 'RATE_LIMITED') return error.message;
    if (/internal server error/i.test(error.message)) {
      return 'We could not finish this payment. If your bank shows a charge, do not pay again—refresh your balance or contact support.';
    }
    return error.message;
  }
  const raw = error instanceof Error ? error.message : '';
  if (/payment request ui|user closed/i.test(raw)) return 'Google Pay was closed. Nothing was charged.';
  return raw || 'Payment could not be completed. Please try again.';
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

async function getCheckoutConfig() {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.value;
  if (!configPromise) {
    configPromise = request<CheckoutConfig>('/api/paypal-card/config')
      .then((value) => {
        configCache = { value, expiresAt: Date.now() + 2 * 60_000 };
        return value;
      })
      .finally(() => { configPromise = null; });
  }
  return configPromise;
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

export async function prewarmSecureCheckout() {
  try {
    const config = await getCheckoutConfig();
    if (!config.configured || !config.advancedCardsEnabled) return;
    await Promise.all([
      loadPayPalSdk(config),
      config.googlePayEnabled ? loadGooglePaySdk().catch(() => undefined) : Promise.resolve(),
    ]);
  } catch {
    // Prewarming is best-effort. The visible checkout retries normally.
  }
}

if (typeof window !== 'undefined') {
  const idle = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number };
  if (idle.requestIdleCallback) idle.requestIdleCallback(() => { void prewarmSecureCheckout(); }, { timeout: 1500 });
  else window.setTimeout(() => { void prewarmSecureCheckout(); }, 350);
}

async function waitForCardFieldContainers() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (CARD_FIELD_SELECTORS.every((selector) => document.querySelector(selector))) return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  throw new Error('Card fields could not be loaded. Close checkout and try again.');
}

function FieldShell({ label, id }: { label: string; id: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[13px] font-bold tracking-[.01em] text-[#d9d5e4]">{label}</span>
      <div
        id={id}
        className="h-[56px] overflow-hidden rounded-[12px] border border-white/[.12] bg-white shadow-[0_10px_24px_-22px_rgba(139,92,246,.7)] transition focus-within:border-violet/50 focus-within:ring-2 focus-within:ring-violet/20"
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
  billingMode = 'one_time',
  onClose,
}: {
  plan: CheckoutId;
  productName: string;
  amountUsd: number;
  originalAmountUsd?: number | null;
  credits: number;
  jobId?: string | null;
  billingMode?: BillingMode;
  onClose: () => void;
}) {
  const recurring = billingMode === 'subscription';
  const [config, setConfig] = useState<CheckoutConfig | null>(configCache?.value ?? null);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [cardEligible, setCardEligible] = useState(false);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [googlePayEligible, setGooglePayEligible] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [preferredSavedMethodId, setPreferredSavedMethodId] = useState<string | null>(null);
  const [processingSavedMethodId, setProcessingSavedMethodId] = useState<string | null>(null);
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
  const canShowCardForm = !config || (config.configured && config.advancedCardsEnabled && (!recurring || config.vaultEnabled));

  useEffect(() => { saveCardRef.current = saveCard; }, [saveCard]);
  useEffect(() => { amountRef.current = amountUsd; }, [amountUsd]);

  function markError(value: unknown) {
    setPaymentState('error');
    setError(errorMessage(value));
  }

  async function createOrder(source: 'card' | 'saved_card' | 'google_pay', paymentMethodId?: string) {
    const endpoint = recurring ? '/api/paypal-card/subscription-orders' : '/api/paypal-card/orders';
    return request<CardOrder>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        plan,
        source,
        saveCard: recurring || (source === 'card' ? saveCardRef.current : false),
        expectedAmountUsd: amountRef.current,
        ...(paymentMethodId ? { paymentMethodId } : {}),
        ...(jobId ? { jobId } : {}),
      }),
    });
  }

  async function capture(orderId: string) {
    const endpoint = recurring
      ? `/api/paypal-card/subscription-orders/${encodeURIComponent(orderId)}/capture`
      : `/api/paypal-card/orders/${encodeURIComponent(orderId)}/capture`;
    return request<CaptureResult>(endpoint, { method: 'POST', body: '{}' });
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
    }, 1250);
  }

  useEffect(() => {
    closingRef.current = false;
    let cancelled = false;

    async function bootstrap() {
      setCardEligible(false);
      setFieldsReady(false);
      setGooglePayEligible(false);
      cardFieldsRef.current = null;
      setError(null);
      setPaymentState('idle');

      try {
        const [nextConfig, methodsResponse] = await Promise.all([
          getCheckoutConfig(),
          request<{ methods: SavedMethod[] }>('/api/paypal-card/methods').catch(() => ({ methods: [] })),
        ]);
        if (cancelled) return;
        setConfig(nextConfig);

        let methods = methodsResponse.methods;
        try {
          const preferred = localStorage.getItem(PREFERRED_METHOD_KEY);
          setPreferredSavedMethodId(preferred);
          if (preferred) methods = [...methods].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
        } catch {
          setPreferredSavedMethodId(null);
        }
        setSavedMethods(methods);

        if (!nextConfig.configured || !nextConfig.advancedCardsEnabled || (recurring && !nextConfig.vaultEnabled)) return;
        await Promise.all([
          loadPayPalSdk(nextConfig),
          !recurring && nextConfig.googlePayEnabled ? loadGooglePaySdk().catch(() => undefined) : Promise.resolve(),
        ]);
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
          await waitForCardFieldContainers();
          if (cancelled) return;
          await Promise.all([
            Promise.resolve(cardFields.NameField({ placeholder: 'Name on card', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-name')),
            Promise.resolve(cardFields.NumberField({ placeholder: '1234 5678 9012 3456', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-number')),
            Promise.resolve(cardFields.ExpiryField({ placeholder: 'MM / YY', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-expiry')),
            Promise.resolve(cardFields.CVVField({ placeholder: '123', style: CARD_FIELD_STYLE }).render('#aiwebvideo-card-cvv')),
          ]);
          if (!cancelled) setFieldsReady(true);
        }

        if (!recurring && nextConfig.googlePayEnabled && window.paypal.Googlepay) {
          try {
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
                    if (Math.abs(order.amountUsd - amountRef.current) > 0.005) throw new Error(`Price changed to ${money(order.amountUsd)}.`);
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
                buttonType: 'buy',
                buttonColor: 'black',
                buttonSizeMode: 'fill',
                allowedPaymentMethods: googleConfig.allowedPaymentMethods,
                onClick: () => {
                  setError(null);
                  setPaymentState('idle');
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
              button.style.width = '100%';
              googleButtonRef.current.appendChild(button);
              setGooglePayEligible(true);
            }
          } catch {
            // Google Pay stays hidden when the buyer, device, or merchant is not eligible.
          }
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          cardFieldsRef.current = null;
          setCardEligible(false);
          markError(new Error('Card checkout could not load. Please try again in a moment.'));
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      cardFieldsRef.current = null;
    };
  }, [plan, jobId, recurring]);

  async function payWithNewCard() {
    if (!cardFieldsRef.current || !fieldsReady || submitting) return;
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
    setProcessingSavedMethodId(method.id);
    setPaymentState('processing');
    setError(null);
    try {
      const order = await createOrder('saved_card', method.id);
      if (Math.abs(order.amountUsd - amountRef.current) > 0.005) throw new Error(`Price changed to ${money(order.amountUsd)}.`);
      try {
        localStorage.setItem(PREFERRED_METHOD_KEY, method.id);
        setPreferredSavedMethodId(method.id);
      } catch { /* optional */ }
      if (order.payerActionRequired) {
        if (!order.payerActionUrl) throw new Error('Your bank requires verification. Try the card again.');
        window.location.href = order.payerActionUrl;
        return;
      }
      const result = await capture(order.orderId);
      finishPayment(result);
    } catch (paymentError) {
      setProcessingSavedMethodId(null);
      if (paymentError instanceof ApiError && paymentError.code === 'PAYMENT_METHOD_NOT_FOUND') {
        setSavedMethods((current) => current.filter((item) => item.id !== method.id));
        try {
          if (localStorage.getItem(PREFERRED_METHOD_KEY) === method.id) {
            localStorage.removeItem(PREFERRED_METHOD_KEY);
            setPreferredSavedMethodId(null);
          }
        } catch { /* optional */ }
      }
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
        if (localStorage.getItem(PREFERRED_METHOD_KEY) === method.id) {
          localStorage.removeItem(PREFERRED_METHOD_KEY);
          setPreferredSavedMethodId(null);
        }
      } catch { /* optional */ }
    } catch (removeError) {
      markError(removeError);
    } finally {
      setRemovingMethod(null);
    }
  }


  function close() {
    if (submitting || success) return;
    closingRef.current = true;
    onClose();
  }

  const buyButtonClass = paymentState === 'success'
    ? 'border-emerald-300/30 bg-emerald-500 text-white shadow-[0_14px_36px_-14px_rgba(16,185,129,.78)]'
    : paymentState === 'error'
      ? 'border-rose-300/20 bg-rose-500 text-white shadow-[0_14px_36px_-14px_rgba(244,63,94,.7)]'
      : 'border-white/10 bg-signature text-white shadow-violet hover:brightness-110';

  const buyButtonContent = paymentState === 'success'
    ? <><Check size={18} strokeWidth={2.7} /> {recurring ? 'Subscription active' : `Paid ${money(amountUsd)}`}</>
    : paymentState === 'processing'
      ? <><LoaderCircle size={18} className="animate-spin" /> Processing…</>
      : paymentState === 'error'
        ? <><AlertCircle size={18} /> Try again · Buy {money(amountUsd)}{recurring ? '/mo' : ''}</>
        : <><LockKeyhole size={17} /> Buy {money(amountUsd)}{recurring ? '/mo' : ''}</>;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Checkout for ${productName}`}
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-x-hidden bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="relative max-h-[94dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0d0918] shadow-[0_38px_120px_-28px_rgba(0,0,0,.96)] sm:max-w-[860px] sm:rounded-[30px]">
        <div className="pointer-events-none absolute -left-20 -top-28 h-64 w-64 rounded-full bg-violet/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-20 h-52 w-52 rounded-full bg-pink/10 blur-3xl" />

        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[.07] bg-[#0d0918]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-mint"><ShieldCheck size={13} /> Checkout</div>
            <h2 className="mt-1 truncate font-display text-lg font-bold text-white sm:text-xl">{productName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-[.13em] text-text-dim">{recurring ? 'Today' : 'Total'}</p>
              <p className="font-display text-xl font-black text-white">{money(amountUsd)}{recurring ? '/mo' : ''}</p>
            </div>
            <button type="button" onClick={close} disabled={submitting || Boolean(success)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.025] text-text-muted transition hover:bg-white/[.06] hover:text-white disabled:opacity-40" aria-label="Close checkout"><X size={16} /></button>
          </div>
        </header>

        {success ? (
          <div className="relative px-5 py-12 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-md rounded-[28px] border border-emerald-300/25 bg-emerald-400/[.08] p-7 text-center shadow-[0_24px_70px_-36px_rgba(16,185,129,.9)]">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><BadgeCheck size={30} /></span>
              <h3 className="mt-4 font-display text-xl font-black text-white">{recurring ? 'Subscription active' : 'Payment complete'}</h3>
              <p className="mt-2 text-sm text-text-muted">{success.creditsGranted.toLocaleString()} credits added{recurring ? ' · renews monthly' : ''}</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><Check size={14} /> {money(success.amountUsd)} paid</div>
            </div>
          </div>
        ) : (
          <div className="relative grid min-w-0 gap-0 md:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="border-b border-white/[.07] bg-white/[.018] p-5 md:border-b-0 md:border-r md:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-text-dim">Order summary</p>
              <div className="mt-4 rounded-2xl border border-white/[.08] bg-black/15 p-4">
                <p className="text-sm font-semibold text-white">{productName}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-text-dim">Credits</span><span className="font-utility font-bold text-white">{credits.toLocaleString()}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="text-text-dim">Payment</span><span className="font-semibold text-text-muted">{recurring ? 'Monthly' : 'One-time'}</span></div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
                {hasDiscount && (
                  <div className="mb-2 flex items-center justify-between gap-3"><span className="rounded-full bg-mint px-2 py-0.5 text-[9px] font-black text-[#08211b]">20% OFF</span><span className="text-xs text-text-dim line-through">{money(originalAmountUsd ?? amountUsd)}</span></div>
                )}
                <div className="flex items-end justify-between gap-3"><span className="text-xs font-semibold text-text-muted">{recurring ? 'Due today' : 'Total'}</span><span className="font-display text-3xl font-black tracking-[-.04em] text-white">{money(amountUsd)}</span></div>
                {recurring && <p className="mt-2 text-[10px] leading-4 text-text-dim">Renews monthly at {money(amountUsd)} until cancelled.</p>}
              </div>

              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-mint/10 bg-mint/[.035] p-3 text-[11px] leading-5 text-[#bbb5ca]">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-mint" />
                Your card details are securely handled by the payment processor. AiWebVideo does not store your full card number or CVV.
              </div>
            </aside>

            <main className="min-w-0 overflow-x-hidden p-5 sm:p-6 md:p-7">
              {savedMethods.length > 0 && (
                <section className="rounded-[22px] border border-mint/20 bg-gradient-to-br from-mint/[.07] via-violet/[.05] to-transparent p-4 shadow-[0_24px_70px_-42px_rgba(45,212,191,.45)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-mint/20 bg-mint/10 text-mint">
                        <WalletCards size={18} />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-white">Pay with your saved card</p>
                          <span className="rounded-full border border-mint/20 bg-mint/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-mint">Fastest</span>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-text-muted">No need to enter your card details again. Choose a saved card below.</p>
                      </div>
                    </div>
                    <ShieldCheck size={17} className="mt-1 shrink-0 text-mint" />
                  </div>

                  <div className="space-y-3">
                    {savedMethods.slice(0, 4).map((method) => {
                      const preferred = preferredSavedMethodId === method.id;
                      const isPaying = processingSavedMethodId === method.id && submitting;
                      return (
                        <div
                          key={method.id}
                          className={`group overflow-hidden rounded-2xl border transition ${preferred ? 'border-violet/45 bg-violet/[.09]' : 'border-white/10 bg-black/15 hover:border-violet/30'}`}
                        >
                          <div className="flex items-center gap-3 p-3.5">
                            <button
                              type="button"
                              disabled={submitting || removingMethod === method.id}
                              onClick={() => void payWithSavedCard(method)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-55"
                              aria-label={`Pay ${money(amountUsd)} with saved ${method.brand} ending in ${method.lastDigits}`}
                            >
                              <span className="relative flex h-12 w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-violet/35 via-[#211730] to-black/40 shadow-lg">
                                <span className="absolute left-2 top-1.5 text-[6px] font-black uppercase tracking-[.14em] text-white/55">Saved</span>
                                <CreditCard size={20} className="mt-2 text-white" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-[11px] font-black uppercase tracking-[.08em] text-white">{method.brand || 'Card'}</span>
                                  {preferred && <span className="rounded-full bg-violet/15 px-2 py-0.5 text-[8px] font-bold text-violet">Last used</span>}
                                </span>
                                <span className="mt-1 block font-utility text-[15px] font-bold tracking-[.11em] text-white">•••• •••• •••• {method.lastDigits}</span>
                                <span className="mt-1 block text-[9px] text-text-dim">{method.expiry ? `Expires ${method.expiry}` : 'Securely saved for faster checkout'}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={submitting || removingMethod === method.id}
                              onClick={() => void removeSavedCard(method)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-dim transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                              aria-label={`Remove ${method.brand} ending in ${method.lastDigits}`}
                            >
                              {removingMethod === method.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={submitting || removingMethod === method.id}
                            onClick={() => void payWithSavedCard(method)}
                            className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-white/[.08] bg-white/[.035] px-4 text-[11px] font-black text-mint transition hover:bg-mint/[.08] disabled:opacity-55"
                          >
                            {isPaying ? <><LoaderCircle size={14} className="animate-spin" /> Paying with saved card…</> : <><LockKeyhole size={13} /> Pay {money(amountUsd)} with this saved card</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-white/[.08]" /><span className="text-[9px] font-bold uppercase tracking-[.15em] text-text-dim">or use another payment method</span><span className="h-px flex-1 bg-white/[.08]" /></div>
                </section>
              )}

              {!recurring && (
                <div className={`transition-all duration-300 ${googlePayEligible ? 'mt-4 opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`}>
                  <div className="rounded-2xl border border-white/[.10] bg-white/[.035] p-2 shadow-[0_16px_34px_-26px_rgba(0,0,0,.8)]">
                    <div ref={googleButtonRef} className="h-[56px] w-full" />
                  </div>
                </div>
              )}

              {!recurring && googlePayEligible && (
                <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-white/[.08]" /><span className="text-[10px] font-bold uppercase tracking-[.16em] text-text-dim">or enter card details</span><span className="h-px flex-1 bg-white/[.08]" /></div>
              )}

              {canShowCardForm && (
                <section className={savedMethods.length || googlePayEligible ? 'mt-4' : ''}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Card details</p>
                      <p className="mt-1 text-[10px] leading-4 text-text-dim">Enter a credit or debit card. Your browser may offer its saved payment details.</p>
                    </div>
                    <CreditCard size={17} className="shrink-0 text-text-dim" />
                  </div>
                  <div className="grid gap-4">
                    <FieldShell label="Name on card" id="aiwebvideo-card-name" />
                    <FieldShell label="Card number" id="aiwebvideo-card-number" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><FieldShell label="Expiry" id="aiwebvideo-card-expiry" /><FieldShell label="Security code (CVV)" id="aiwebvideo-card-cvv" /></div>
                  </div>

                  {recurring ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-violet/15 bg-violet/[.055] px-3.5 py-3 text-[11px] leading-5 text-text-muted">
                      <ShieldCheck size={15} className="shrink-0 text-violet" />
                      This card will be securely saved for your monthly renewal. Cancel anytime from your account.
                    </div>
                  ) : config?.vaultEnabled ? (
                    <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[.06] bg-white/[.02] px-3.5 py-3 text-[11px] text-text-muted transition hover:bg-white/[.035]">
                      <input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} className="h-4 w-4 rounded border-white/20 bg-black/30 accent-[#8b5cf6]" />
                      <span className="font-semibold text-white">Save this card</span><span className="ml-auto text-[10px] text-text-dim">for next time</span>
                    </label>
                  ) : null}

                  <button type="button" onClick={() => void payWithNewCard()} disabled={submitting || !cardEligible || !fieldsReady} className={`mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${buyButtonClass}`}>
                    {buyButtonContent}
                  </button>
                </section>
              )}

              {config && (!config.advancedCardsEnabled || (recurring && !config.vaultEnabled)) && (
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] px-3 py-2.5 text-[11px] leading-5 text-amber-100">
                  {recurring ? 'Card subscriptions need saved-card billing enabled for this payment account.' : 'Card payment is unavailable right now. Please try again later.'}
                </div>
              )}

              {error && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/[.07] p-3 text-[11px] leading-5 text-rose-200" role="alert" aria-live="polite"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span></div>
              )}

            </main>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
