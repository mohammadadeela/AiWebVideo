import { useEffect, useState } from 'react';
import { CreditCard, LoaderCircle, Trash2 } from 'lucide-react';
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
    <div id="payment-methods">
      <p className="mb-2 text-xs font-semibold text-text-muted">Saved cards</p>
      {loading ? (
        <div className="flex h-16 items-center justify-center rounded-2xl bg-white/[.03] text-text-dim">
          <LoaderCircle size={16} className="animate-spin" aria-label="Loading saved cards" />
        </div>
      ) : methods.length > 0 ? (
        <div className="space-y-2">
          {methods.map((method) => {
            const confirming = removeCandidate === method.id;
            const isRemoving = removing === method.id;
            return (
              <div key={method.id} className="flex items-center gap-3 rounded-2xl bg-white/[.04] px-3.5 py-3">
                <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet/30 to-pink/20 text-white">
                  <CreditCard size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{method.brand} •••• {method.lastDigits}</p>
                  {method.expiry && <p className="text-[11px] text-text-dim">Expires {method.expiry}</p>}
                </div>
                <button
                  type="button"
                  disabled={Boolean(removing)}
                  onClick={() => void remove(method)}
                  aria-label={confirming ? "Confirm remove card" : "Remove card"}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition disabled:opacity-50 ${
                    confirming ? "bg-rose-500/15 text-rose-200" : "text-text-muted hover:bg-white/[.06] hover:text-white"
                  }`}
                >
                  {isRemoving ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {confirming ? "Confirm" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/[.03] px-4 py-3.5 text-xs leading-5 text-text-dim">
          {vaultEnabled ? "No saved cards. Tick “Save this card” when you next pay." : "No saved cards."}
        </p>
      )}
      {notice && <p className="mt-2 text-xs text-text-muted" role="status">{notice}</p>}
    </div>
  );
}
