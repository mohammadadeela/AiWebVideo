import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AdminReportRange } from '@/lib/api-client';
import { FilterBar, FilterSelect, Segmented, StatCard, Empty } from './adminUi';

type Row = Record<string, unknown>;

const ranges: Array<{ value: AdminReportRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function row(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}
function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}
function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function text(value: unknown, fallback = '—') {
  const result = String(value ?? '').trim();
  return result || fallback;
}
function money(value: unknown, digits = 2) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number(value));
}
function count(value: unknown) {
  return new Intl.NumberFormat().format(number(value));
}
function percent(value: unknown) {
  return `${number(value).toFixed(1)}%`;
}
function date(value: unknown) {
  return value ? new Date(String(value)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}
function statusClass(value: unknown) {
  const status = text(value, '').toLowerCase();
  if (status === 'paid' || status === 'active') return 'bg-mint/10 text-mint';
  if (status === 'pending' || status === 'past_due') return 'bg-amber-300/10 text-amber-200';
  return 'bg-pink/10 text-pink';
}

type ReportTab = 'payments' | 'products' | 'health';

export function AdminReports({ report, range, loading, onRangeChange }: {
  report: Row | null;
  range: AdminReportRange;
  loading: boolean;
  onRangeChange: (range: AdminReportRange) => void;
}) {
  const [tab, setTab] = useState<ReportTab>('payments');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [productType, setProductType] = useState('all');

  if (!report && loading) {
    return <div className="mt-6 flex min-h-64 items-center justify-center gap-3 text-sm text-text-muted"><RefreshCw size={16} className="animate-spin text-violet" /> Loading…</div>;
  }
  if (!report) return <Empty>Reports could not be loaded.</Empty>;

  const period = row(report.period);
  const lifetime = row(report.lifetime);
  const customers = row(report.customers);
  const subscriptions = row(report.subscriptions);
  const credits = row(report.credits);
  const productions = row(report.productions);
  const products = rows(report.products);
  const plans = rows(subscriptions.plans);
  const timeline = rows(report.timeline);
  const payments = rows(report.recentPayments);

  const filteredPayments = payments.filter((payment) => {
    if (paymentStatus !== 'all' && text(payment.status, '').toLowerCase() !== paymentStatus) return false;
    const haystack = `${text(payment.email, '')} ${text(payment.product_id, '')} ${text(payment.provider_ref, '')} ${text(payment.kind, '')}`.toLowerCase();
    return haystack.includes(paymentSearch.trim().toLowerCase());
  });
  const filteredProducts = products.filter((product) => productType === 'all' || text(product.category, '').toLowerCase() === productType);
  const maxTimeline = Math.max(1, ...timeline.flatMap((item) => [number(item.net_revenue), number(item.provider_cost)]));

  return (
    <div className="mt-6 space-y-5">
      <Segmented
        value={range}
        onChange={(next) => onRangeChange(next as AdminReportRange)}
        options={ranges.map((item) => [item.value, item.label] as [string, string])}
        disabled={loading}
        label="Report period"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(period.net_revenue)} hint={`${count(period.paid_transactions)} payments · avg ${money(period.average_order_value)}`} tone="mint" />
        <StatCard label="Profit" value={money(period.gross_profit)} hint={`${percent(period.margin_percent)} margin · ${money(period.provider_cost)} AI cost`} tone={number(period.gross_profit) >= 0 ? 'mint' : 'pink'} />
        <StatCard label="Monthly recurring" value={money(subscriptions.mrr)} hint={`${count(subscriptions.active_subscribers)} active subscribers`} tone="violet" />
        <StatCard label="Refunds" value={money(period.refunded_revenue)} hint={`${count(period.refunded_transactions)} refunded · ${money(period.pending_revenue)} pending`} tone={number(period.refunded_transactions) ? 'pink' : 'gold'} />
      </section>

      <section className="rounded-3xl border border-border bg-panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-text-primary">Revenue vs AI cost</h3>
          <p className="text-xs text-text-dim">
            Lifetime {money(lifetime.net_revenue)} · profit {money(lifetime.gross_profit)} · {count(lifetime.paying_customers)} paying customers
          </p>
        </div>
        <div className="mt-4 space-y-2.5">
          {timeline.map((item) => {
            const revenue = number(item.net_revenue);
            const cost = number(item.provider_cost);
            return (
              <div key={text(item.period)} className="grid grid-cols-[64px_1fr_84px] items-center gap-3 text-[11px]">
                <span className="text-text-dim">{text(item.label)}</span>
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-white/[.05]" title={`Revenue ${money(revenue)}`}><span className="block h-full rounded-full bg-mint" style={{ width: `${Math.max(revenue > 0 ? 2 : 0, (revenue / maxTimeline) * 100)}%` }} /></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[.04]" title={`AI cost ${money(cost)}`}><span className="block h-full rounded-full bg-pink/80" style={{ width: `${Math.max(cost > 0 ? 2 : 0, (cost / maxTimeline) * 100)}%` }} /></div>
                </div>
                <span className="text-right font-utility text-text-muted">{money(revenue)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-[11px] text-text-dim"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-mint" />Revenue</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-pink/80" />AI cost</span></div>
      </section>

      <Segmented
        value={tab}
        onChange={(next) => setTab(next as ReportTab)}
        options={[['payments', 'Payments'], ['products', 'Products & plans'], ['health', 'Health']]}
        label="Report section"
      />

      {tab === 'payments' && (
        <section className="overflow-hidden rounded-3xl border border-border bg-panel">
          <FilterBar search={paymentSearch} onSearch={setPaymentSearch} placeholder="Search customer, product or reference" active={paymentStatus !== 'all'} onClear={() => setPaymentStatus('all')}>
            <FilterSelect label="Status" value={paymentStatus} onChange={setPaymentStatus} options={[['all', 'All statuses'], ['paid', 'Paid'], ['pending', 'Pending'], ['refunded', 'Refunded'], ['reversed', 'Reversed']]} />
          </FilterBar>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-panel-alt text-text-dim"><tr><th className="p-3">Date</th><th>Customer</th><th>Product</th><th>Amount</th><th>Credits</th><th className="pr-3">Status</th></tr></thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((payment) => (
                  <tr key={text(payment.id)}>
                    <td className="p-3 text-text-dim">{date(payment.created_at)}</td>
                    <td className="max-w-56 truncate font-semibold text-text-primary" title={text(payment.provider_ref)}>{text(payment.email)}</td>
                    <td className="text-text-muted">{text(payment.product_id)}</td>
                    <td className="font-semibold text-text-primary">{money(payment.amount_usd)}</td>
                    <td className="text-text-muted">{count(payment.credits_granted)}</td>
                    <td className="pr-3"><span className={`rounded-full px-2 py-1 text-[10px] capitalize ${statusClass(payment.status)}`}>{text(payment.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredPayments.length && <Empty>No payments match.</Empty>}
          </div>
        </section>
      )}

      {tab === 'products' && (
        <section className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-border bg-panel">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-panel-alt text-text-dim"><tr><th className="p-4">Plan</th><th>Price</th><th>Active</th><th>Auto-renewing</th><th className="pr-4">MRR</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {plans.map((plan) => (
                    <tr key={text(plan.plan)}>
                      <td className="p-4 font-semibold text-text-primary">{text(plan.name)}</td>
                      <td className="text-text-muted">{money(plan.monthlyPriceUsd)}</td>
                      <td className="font-semibold text-mint">{count(plan.active_subscribers)}</td>
                      <td className="text-text-muted">{count(plan.auto_renewing)}{number(plan.past_due) > 0 && <span className="ml-2 text-amber-200">{count(plan.past_due)} past due</span>}</td>
                      <td className="pr-4 font-utility font-semibold text-violet">{money(number(plan.auto_renewing) * number(plan.monthlyPriceUsd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!plans.length && <Empty>No plans.</Empty>}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-panel">
            <FilterBar active={productType !== 'all'} onClear={() => setProductType('all')}>
              <FilterSelect label="Type" value={productType} onChange={setProductType} options={[['all', 'All types'], ['subscription', 'Subscriptions'], ['video package', 'Video packages'], ['credit pack', 'Credit packs'], ['legacy', 'Legacy']]} />
            </FilterBar>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-panel-alt text-text-dim"><tr><th className="p-4">Product</th><th>Price</th><th>Sales</th><th>Revenue</th><th>Refunds</th><th className="pr-4">Lifetime</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product) => {
                    const current = row(product.period);
                    const all = row(product.lifetime);
                    return (
                      <tr key={text(product.productId)}>
                        <td className="p-4"><p className="font-semibold text-text-primary">{text(product.name)}</p><p className="mt-0.5 text-[10px] capitalize text-text-dim">{text(product.category)}</p></td>
                        <td className="text-text-muted">{money(product.priceUsd)}</td>
                        <td className="font-semibold text-mint">{count(current.paid_sales)}</td>
                        <td className="font-utility font-semibold text-text-primary">{money(current.net_revenue)}</td>
                        <td className={number(current.refunded_sales) ? 'text-pink' : 'text-text-muted'}>{count(current.refunded_sales)}</td>
                        <td className="pr-4 font-utility text-violet">{money(all.net_revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredProducts.length && <Empty>No products match.</Empty>}
            </div>
          </div>
        </section>
      )}

      {tab === 'health' && (
        <section className="grid gap-3 lg:grid-cols-3">
          {([
            ['Credits', [['Purchased', credits.credits_purchased], ['Spent', credits.credits_spent], ['Refunded', credits.credits_refunded], ['Customer balances', credits.current_customer_balance]]],
            ['Productions', [['Total', productions.total], ['Completed', productions.completed], ['Running', productions.running], ['Failed', productions.failed]]],
            ['Customers', [['Registered', customers.total_users], ['New in period', customers.new_users], ['Paying in period', customers.period_paying_users], ['Conversion', percent(customers.lifetime_conversion_percent)]]],
          ] as Array<[string, Array<[string, unknown]>]>).map(([title, items]) => (
            <div key={title} className="rounded-3xl border border-border bg-panel p-5">
              <h3 className="font-semibold text-text-primary">{title}</h3>
              <dl className="mt-3 divide-y divide-border text-xs">
                {items.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2.5"><dt className="text-text-dim">{label}</dt><dd className="font-utility font-semibold text-text-primary">{typeof value === 'string' ? value : count(value)}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
