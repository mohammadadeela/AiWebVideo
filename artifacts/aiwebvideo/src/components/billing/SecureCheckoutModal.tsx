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
  baseAmountUsd: number;
  feeUsd: number;
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
  return `${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function checkoutTotalUsd(baseAmountUsd: number) {
  const base = Math.round((Math.max(0, Number(baseAmountUsd) || 0) + Number.EPSILON) * 100) / 100;
  if (base <= 0) return 0;
  const minimumGross = (base + 0.35) / (1 - 0.0401);
  let total = Math.floor(minimumGross) + 0.99;
  if (total + 0.000001 < minimumGross) total += 1;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function checkoutFeeUsd(baseAmountUsd: number) {
  const base = Math.round((Math.max(0, Number(baseAmountUsd) || 0) + Number.EPSILON) * 100) / 100;
  return Math.round((Math.max(0, checkoutTotalUsd(base) - base) + Number.EPSILON) * 100) / 100;
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
      <span className="mb-1.5 block text-xs font-medium text-white/60">{label}</span>
      <div
        id={id}
        className="h-[52px] overflow-hidden rounded-2xl border border-white/10 bg-white transition focus-within:border-violet/60 focus-within:ring-4 focus-within:ring-violet/15"
      />
    </label>
  );
}

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';

function cardBrand(name: string): CardBrand {
  const value = name.toLowerCase();
  if (value.includes('visa')) return 'visa';
  if (value.includes('master')) return 'mastercard';
  if (value.includes('amex') || value.includes('american')) return 'amex';
  if (value.includes('discover')) return 'discover';
  return 'other';
}

const BRAND_STYLE: Record<CardBrand, string> = {
  visa: 'from-[#1a2fa8] via-[#1f3fd0] to-[#3b6cff]',
  mastercard: 'from-[#1c1c24] via-[#2b2b36] to-[#3f3f4d]',
  amex: 'from-[#0a6aa1] via-[#128ac2] to-[#38b6e8]',
  discover: 'from-[#c2500a] via-[#e0721c] to-[#f79a3d]',
  other: 'from-[#4c2a9a] via-[#6b3fd4] to-[#a05cf0]',
};

function BrandMark({ brand, label }: { brand: CardBrand; label: string }) {
  if (brand === 'mastercard') {
    return (
      <span className="flex items-center" aria-label="Mastercard">
        <span className="h-6 w-6 rounded-full bg-[#eb001b]" />
        <span className="-ml-2.5 h-6 w-6 rounded-full bg-[#f79e1b] mix-blend-screen" />
      </span>
    );
  }
  if (brand === 'visa') return <span className="font-display text-xl font-black italic tracking-tight text-white" aria-label="Visa">VISA</span>;
  if (brand === 'amex') return <span className="rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-black tracking-tight text-[#0a6aa1]" aria-label="American Express">AMEX</span>;
  return <span className="text-sm font-bold capitalize text-white">{label || 'Card'}</span>;
}

/** A saved card drawn in its network's colours, with the pay action right on it. */
function SavedCardTile({ method, total, paying, busy, onPay, onRemove, removing }: {
  method: SavedMethod;
  total: string;
  paying: boolean;
  busy: boolean;
  onPay: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const brand = cardBrand(method.brand);
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white shadow-[0_18px_40px_-22px_rgba(0,0,0,.9)] ${BRAND_STYLE[brand]}`}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/[.10]" />
      <div className="pointer-events-none absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-white/[.06]" />
      <div className="relative flex items-start justify-between">
        <BrandMark brand={brand} label={method.brand} />
        <button
          type="button"
          disabled={busy || removing}
          onClick={onRemove}
          aria-label={`Remove ${method.brand} ending in ${method.lastDigits}`}
          className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white/70 backdrop-blur transition hover:bg-black/35 hover:text-white disabled:opacity-40"
        >
          {removing ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      <p className="relative mt-5 font-utility text-lg font-semibold tracking-[.16em]">•••• {method.lastDigits}</p>
      <div className="relative mt-3 flex items-end justify-between gap-3">
        <p className="text-xs text-white/70">{method.expiry ? `Expires ${method.expiry}` : 'Saved card'}</p>
        <button
          type="button"
          disabled={busy || removing}
          onClick={onPay}
          aria-label={`Pay ${total} with saved ${method.brand} ending in ${method.lastDigits}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[#150f26] shadow-lg transition hover:scale-[1.03] active:scale-95 disabled:opacity-60"
        >
          {paying ? <><LoaderCircle size={15} className="animate-spin" /> Processing</> : <>Pay {total}</>}
        </button>
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-violet' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className="text-sm font-medium text-white">{label}</span>
      {hint && <span className="ml-auto text-xs text-white/40">{hint}</span>}
    </button>
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
  const checkoutTotal = checkoutTotalUsd(amountUsd);
  const checkoutFee = checkoutFeeUsd(amountUsd);
  const totalRef = useRef(checkoutTotal);
  const closingRef = useRef(false);

  const submitting = paymentState === 'processing';
  const hasDiscount = Boolean(originalAmountUsd && originalAmountUsd > amountUsd + 0.005);
  const canShowCardForm = !config || (config.configured && config.advancedCardsEnabled && (!recurring || config.vaultEnabled));

  useEffect(() => { saveCardRef.current = saveCard; }, [saveCard]);
  useEffect(() => {
    amountRef.current = amountUsd;
    totalRef.current = checkoutTotalUsd(amountUsd);
  }, [amountUsd]);

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
            if (Math.abs(order.baseAmountUsd - amountRef.current) > 0.005) {
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
                    if (Math.abs(order.baseAmountUsd - amountRef.current) > 0.005) throw new Error(`Price changed to ${money(order.amountUsd)}.`);
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
                      totalPrice: totalRef.current.toFixed(2),
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
      if (Math.abs(order.baseAmountUsd - amountRef.current) > 0.005) throw new Error(`Price changed to ${money(order.amountUsd)}.`);
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
    ? <><Check size={18} strokeWidth={2.7} /> {recurring ? 'Subscription active' : `Paid ${money(checkoutTotal)}`}</>
    : paymentState === 'processing'
      ? <><LoaderCircle size={18} className="animate-spin" /> Processing…</>
      : paymentState === 'error'
        ? <><AlertCircle size={18} /> Try again · Buy {money(checkoutTotal)}{recurring ? '/mo' : ''}</>
        : <><LockKeyhole size={17} /> Buy {money(checkoutTotal)}{recurring ? '/mo' : ''}</>;

  const totalLabel = `${money(checkoutTotal)}${recurring ? '/mo' : ''}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Checkout for ${productName}`}
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-x-hidden bg-[#080410]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="relative max-h-[94dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#0e0a1b] shadow-[0_38px_120px_-28px_rgba(0,0,0,.96)] sm:max-w-[460px] sm:rounded-[32px]">
        <div className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />

        <header className="relative flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold text-white">{productName}</h2>
            <p className="mt-0.5 text-sm text-white/50">{credits.toLocaleString()} credits{recurring ? ' every month' : ''}</p>
          </div>
          <button type="button" onClick={close} disabled={submitting || Boolean(success)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[.06] text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Close checkout"><X size={16} /></button>
        </header>

        {success ? (
          <div className="relative px-6 pb-10 pt-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><BadgeCheck size={34} /></span>
            <h3 className="mt-5 font-display text-2xl font-black text-white">{recurring ? 'Subscription active' : 'Payment complete'}</h3>
            <p className="mt-2 text-sm text-white/60">{success.creditsGranted.toLocaleString()} credits added{recurring ? ' · renews monthly' : ''}</p>
            <p className="mt-1 text-xs text-white/40">{money(success.amountUsd)} paid</p>
          </div>
        ) : (
          <div className="relative px-6 pb-6">
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-4xl font-black tracking-[-.04em] text-white">{totalLabel}</p>
                <p className="mt-1 text-xs text-white/45">
                  {hasDiscount && <span className="mr-1.5 line-through">{money(originalAmountUsd ?? amountUsd)}</span>}
                  {money(amountUsd)} + {money(checkoutFee)} processing fee
                </p>
              </div>
            </div>

            {savedMethods.length > 0 && (
              <section className="mt-5 space-y-3" aria-label="Saved cards">
                {savedMethods.slice(0, 2).map((method) => (
                  <SavedCardTile
                    key={method.id}
                    method={method}
                    total={money(checkoutTotal)}
                    paying={processingSavedMethodId === method.id && submitting}
                    busy={submitting}
                    removing={removingMethod === method.id}
                    onPay={() => void payWithSavedCard(method)}
                    onRemove={() => void removeSavedCard(method)}
                  />
                ))}
              </section>
            )}

            {!recurring && (
              <div className={`transition-all duration-300 ${googlePayEligible ? 'mt-5 opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`}>
                <div ref={googleButtonRef} className="h-[52px] w-full overflow-hidden rounded-2xl" />
              </div>
            )}

            {(savedMethods.length > 0 || (!recurring && googlePayEligible)) && canShowCardForm && (
              <div className="my-5 flex items-center gap-3 text-xs text-white/35"><span className="h-px flex-1 bg-white/10" />or pay with a card<span className="h-px flex-1 bg-white/10" /></div>
            )}

            {canShowCardForm && (
              <section className={savedMethods.length > 0 || (!recurring && googlePayEligible) ? '' : 'mt-5'}>
                <div className="grid gap-3.5">
                  <FieldShell label="Name on card" id="aiwebvideo-card-name" />
                  <FieldShell label="Card number" id="aiwebvideo-card-number" />
                  <div className="grid grid-cols-2 gap-3.5"><FieldShell label="Expiry" id="aiwebvideo-card-expiry" /><FieldShell label="Security code" id="aiwebvideo-card-cvv" /></div>
                </div>

                {recurring ? (
                  <p className="mt-4 text-xs leading-5 text-white/50">This card is saved for your monthly renewal. Cancel any time from your account.</p>
                ) : config?.vaultEnabled ? (
                  <div className="mt-3"><Switch checked={saveCard} onChange={setSaveCard} label="Save this card" hint="for next time" /></div>
                ) : null}

                <button type="button" onClick={() => void payWithNewCard()} disabled={submitting || !cardEligible || !fieldsReady} className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border px-4 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${buyButtonClass}`}>
                  {buyButtonContent}
                </button>
              </section>
            )}

            {config && (!config.advancedCardsEnabled || (recurring && !config.vaultEnabled)) && (
              <p className="mt-4 rounded-2xl bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
                {recurring ? 'Card subscriptions need saved-card billing enabled for this payment account.' : 'Card payment is unavailable right now. Please try again later.'}
              </p>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-rose-500/10 p-3.5 text-xs leading-5 text-rose-200" role="alert" aria-live="polite"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span></div>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/35"><LockKeyhole size={11} /> Card details go straight to the payment processor. We never see or store them.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
