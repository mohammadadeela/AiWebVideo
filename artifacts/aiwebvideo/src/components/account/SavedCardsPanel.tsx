import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Check, CreditCard, LoaderCircle, ShieldCheck, Trash2, WalletCards } from 'lucide-react';
import { request } from '@/lib/api-client';

interface SavedMethod {
  id: string;
  brand: string;
  lastDigits: string;
  expiry: string | null;
}

interface CheckoutConfig {
  vaultEnabled: boolean;
}

export function SavedCardsPanel() {
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [vaultEnabled, setVaultEnabled] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      request<{ methods: SavedMethod[] }>('/api/paypal-card/methods').catch(() => ({ methods: [] })),
      request<CheckoutConfig>('/api/paypal-card/config').catch(() => ({ vaultEnabled: false })),
    ]).then(([methodResult, config]) => {
      if (cancelled) return;
      setMethods(Array.isArray(methodResult.methods) ? methodResult.methods : []);
      setVaultEnabled(Boolean(config.vaultEnabled));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function remove(method: SavedMethod) {
    if (removing) return;
    if (removeCandidate !== method.id) {
      setRemoveCandidate(method.id);
      setNotice(null);
      return;
    }

    setRemoving(method.id);
    setNotice(null);
    try {
      await request<{ deleted: true }>(`/api/paypal-card/methods/${encodeURIComponent(method.id)}`, { method: 'DELETE' });
      setMethods((current) => current.filter((item) => item.id !== method.id));
      setRemoveCandidate(null);
      setNotice('Card removed.');
    } catch {
      setNotice('This card could not be removed right now.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section id="payment-methods" className="mx-auto mt-5 w-full max-w-7xl px-5">
      <div className="rounded-3xl border border-white/[.08] bg-panel p-5 shadow-[0_24px_80px_-55px_rgba(0,0,0,.85)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet/20 bg-violet/10 text-violet">
              <WalletCards size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">Saved cards</h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">Manage cards you chose to save during checkout.</p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.035] px-4 text-xs font-bold text-text-primary transition hover:border-violet/25 hover:bg-white/[.06]"
          >
            Buy credits
          </Link>
        </div>

        {loading ? (
          <div className="mt-5 flex min-h-24 items-center justify-center rounded-2xl border border-white/[.07] bg-bg/20 text-text-dim">
            <LoaderCircle size={18} className="animate-spin" aria-label="Loading saved cards" />
          </div>
        ) : methods.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {methods.map((method) => {
              const confirming = removeCandidate === method.id;
              const isRemoving = removing === method.id;
              return (
                <div key={method.id} className="rounded-2xl border border-white/[.08] bg-bg/25 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/15 text-violet">
                      <CreditCard size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text-primary">{method.brand} •••• {method.lastDigits}</p>
                      <p className="mt-1 text-[10px] text-text-dim">{method.expiry ? `Expires ${method.expiry}` : 'Saved payment method'}</p>
                    </div>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint/10 text-mint" title="Ready for checkout">
                      <Check size={14} />
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(removing)}
                    onClick={() => void remove(method)}
                    className={`mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition disabled:opacity-50 ${
                      confirming
                        ? 'border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15'
                        : 'border-white/[.08] bg-white/[.025] text-text-muted hover:bg-white/[.05] hover:text-white'
                    }`}
                  >
                    {isRemoving ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {isRemoving ? 'Removing…' : confirming ? 'Confirm remove' : 'Remove card'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-white/[.1] bg-bg/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-text-primary">No saved cards yet</p>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  {vaultEnabled
                    ? 'Choose “Save this card” the next time you pay by card.'
                    : 'Saved cards will appear here when card saving is enabled for your payment account.'}
                </p>
              </div>
            </div>
            <Link href="/pricing" className="shrink-0 text-xs font-bold text-violet transition hover:text-mint">Go to pricing →</Link>
          </div>
        )}

        {notice && <p className="mt-3 text-xs text-text-muted" role="status">{notice}</p>}
      </div>
    </section>
  );
}
