import { useState, type ComponentType } from 'react';
import {
  BadgeDollarSign,
  CalendarRange,
  CreditCard,
  FileVideo,
  Gauge,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingUp,
  UserRoundCheck,
  Users,
  WalletCards,
  type LucideProps,
} from 'lucide-react';
import type { AdminReportRange } from '@/lib/api-client';

type Row = Record<string, unknown>;

const ranges: Array<{ value: AdminReportRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
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
  return value ? new Date(String(value)).toLocaleString() : '—';
}

function statusClass(value: unknown) {
  const status = text(value, '').toLowerCase();
  if (status === 'paid' || status === 'active') return 'bg-mint/10 text-mint';
  if (status === 'pending' || status === 'past_due') return 'bg-amber-300/10 text-amber-200';
  return 'bg-pink/10 text-pink';
}

function Metric({ label, value, hint, icon: Icon, tone = 'violet' }: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<LucideProps>;
  tone?: 'violet' | 'mint' | 'pink' | 'gold';
}) {
  const tones = {
    violet: 'bg-violet/10 text-violet',
    mint: 'bg-mint/10 text-mint',
    pink: 'bg-pink/10 text-pink',
    gold: 'bg-amber-300/10 text-amber-200',
  };
  return (
    <article className="rounded-2xl border border-border bg-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-text-dim">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={15} /></span>
      </div>
      <p className="mt-3 font-utility text-2xl font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-text-dim">{hint}</p>
    </article>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="p-8 text-center text-xs text-text-dim">{children}</p>;
}

export function AdminReports({ report, range, loading, onRangeChange, onViewUser }: {
  report: Row | null;
  range: AdminReportRange;
  loading: boolean;
  onRangeChange: (range: AdminReportRange) => void;
  onViewUser: (userId: string) => void;
}) {
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('all');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionSearchBy, setTransactionSearchBy] = useState('all');
  const [transactionStatus, setTransactionStatus] = useState('all');
  if (!report && loading) {
    return <div className="mt-7 flex min-h-80 items-center justify-center rounded-3xl border border-border bg-panel"><div className="flex items-center gap-3 text-sm text-text-muted"><RefreshCw size={17} className="animate-spin text-violet" /> Loading financial reports…</div></div>;
  }
  if (!report) return <Empty>Financial reports could not be loaded.</Empty>;

  const period = row(report.period);
  const lifetime = row(report.lifetime);
  const customers = row(report.customers);
  const subscriptions = row(report.subscriptions);
  const credits = row(report.credits);
  const productions = row(report.productions);
  const products = rows(report.products);
  const subscriptionPlans = rows(subscriptions.plans);
  const timeline = rows(report.timeline);
  const paymentKinds = rows(report.paymentKinds);
  const recentPayments = rows(report.recentPayments);
  const filteredProducts = products.filter((product) => {
    const category = text(product.category, '').toLowerCase();
    const matchesCategory = productCategory === 'all' || category === productCategory;
    const haystack = `${text(product.name, '')} ${text(product.productId, '')} ${category}`.toLowerCase();
    return matchesCategory && haystack.includes(productSearch.trim().toLowerCase());
  });
  const filteredPayments = recentPayments.filter((payment) => {
    if (transactionStatus !== 'all' && text(payment.status, '').toLowerCase() !== transactionStatus) return false;
    const fields: Record<string, string> = {
      customer: text(payment.email, ''),
      product: text(payment.product_id, ''),
      reference: `${text(payment.provider_ref, '')} ${text(payment.provider_capture_ref, '')}`,
      type: text(payment.kind, ''),
    };
    const haystack = transactionSearchBy === 'all' ? Object.values(fields).join(' ') : fields[transactionSearchBy] ?? '';
    return haystack.toLowerCase().includes(transactionSearch.trim().toLowerCase());
  });
  const maxTimelineValue = Math.max(1, ...timeline.flatMap((item) => [number(item.net_revenue), number(item.provider_cost)]));

  return (
    <div className="mt-7 space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-panel p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-violet"><CalendarRange size={17} /><p className="font-utility text-[9px] font-semibold uppercase tracking-[.16em]">Financial reporting</p></div>
          <h2 className="mt-2 font-display text-2xl font-bold text-text-primary">Revenue, subscriptions and purchases</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-text-dim">Real PayPal payments, refunds, plan activity, credit flow, production cost and gross profit. Revenue cards use completed paid transactions only.</p>
        </div>
        <label className="block shrink-0 text-[10px] font-semibold uppercase tracking-[.12em] text-text-dim">
          Report period
          <select value={range} disabled={loading} onChange={(event) => onRangeChange(event.target.value as AdminReportRange)} className="mt-1.5 min-w-44 rounded-xl border border-border bg-bg px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-text-primary outline-none focus:border-violet/50 disabled:opacity-60">
            {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={`${text(report.rangeLabel)} collected`} value={money(period.net_revenue)} hint={`${count(period.paid_transactions)} completed payment${number(period.paid_transactions) === 1 ? '' : 's'}`} icon={BadgeDollarSign} tone="mint" />
        <Metric label="Subscription revenue" value={money(period.subscription_revenue)} hint={`${count(period.new_subscribers)} new subscriber${number(period.new_subscribers) === 1 ? '' : 's'} · ${count(period.renewals)} renewals`} icon={RefreshCw} />
        <Metric label="One-time revenue" value={money(period.one_time_revenue)} hint="Video packages and credit top-ups" icon={WalletCards} tone="violet" />
        <Metric label="Gross profit" value={money(period.gross_profit)} hint={`${money(period.provider_cost)} AI provider cost · ${percent(period.margin_percent)} margin`} icon={TrendingUp} tone={number(period.gross_profit) >= 0 ? 'mint' : 'pink'} />
        <Metric label="Active subscribers" value={count(subscriptions.active_subscribers)} hint={`${count(subscriptions.auto_renewing_subscribers)} auto-renewing · ${count(subscriptions.ending_subscribers)} ending`} icon={UserRoundCheck} tone="violet" />
        <Metric label="Monthly recurring revenue" value={money(subscriptions.mrr)} hint={`${money(subscriptions.arr)} annualized run rate`} icon={CreditCard} tone="mint" />
        <Metric label="Refunds / reversals" value={money(period.refunded_revenue)} hint={`${count(period.refunded_transactions)} transaction${number(period.refunded_transactions) === 1 ? '' : 's'} · gross sales ${money(period.gross_revenue)}`} icon={RotateCcw} tone={number(period.refunded_transactions) ? 'pink' : 'gold'} />
        <Metric label="Paying customers" value={count(period.paying_customers)} hint={`${count(customers.new_users)} new account${number(customers.new_users) === 1 ? '' : 's'} in this period`} icon={Users} tone="gold" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Average paid order', money(period.average_order_value), 'Across completed payments'],
          ['Pending checkouts', `${count(period.pending_transactions)} · ${money(period.pending_revenue)}`, 'Created but not captured'],
          ['Credits sold', count(period.credits_sold), 'Granted by completed purchases'],
          ['Lifetime average order', money(lifetime.average_order_value), 'Across all completed payments'],
        ].map(([label, value, hint]) => <article key={label} className="rounded-2xl border border-border bg-panel-alt/70 px-4 py-3"><p className="text-[9px] uppercase tracking-[.12em] text-text-dim">{label}</p><p className="mt-1.5 font-utility text-base font-semibold text-text-primary">{value}</p><p className="mt-1 text-[9px] text-text-dim">{hint}</p></article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border border-border bg-panel p-5">
          <div><h3 className="font-semibold text-text-primary">Revenue vs AI cost · last 12 months</h3><p className="mt-1 text-[10px] text-text-dim">Net collected revenue excludes refunded and reversed transactions.</p></div>
          <div className="mt-5 space-y-3">
            {timeline.map((item) => {
              const revenue = number(item.net_revenue);
              const providerCost = number(item.provider_cost);
              return <div key={text(item.period)} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 text-[10px]">
                <span className="text-text-dim">{text(item.label)}</span>
                <div className="space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-white/[.05]" title={`Revenue ${money(revenue)}`}><span className="block h-full rounded-full bg-mint" style={{ width: `${Math.max(revenue > 0 ? 2 : 0, (revenue / maxTimelineValue) * 100)}%` }} /></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[.04]" title={`Provider cost ${money(providerCost)}`}><span className="block h-full rounded-full bg-pink/80" style={{ width: `${Math.max(providerCost > 0 ? 2 : 0, (providerCost / maxTimelineValue) * 100)}%` }} /></div>
                </div>
                <span className="w-24 text-right font-utility text-text-muted">{money(revenue)}</span>
              </div>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-[9px] text-text-dim"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-mint" /> Net revenue</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-pink/80" /> AI provider cost</span></div>
        </div>

        <div className="space-y-3 rounded-3xl border border-border bg-panel p-5">
          <div><h3 className="font-semibold text-text-primary">Lifetime business snapshot</h3><p className="mt-1 text-[10px] text-text-dim">All completed payment and provider-cost history.</p></div>
          {[
            ['Net collected', money(lifetime.net_revenue), 'text-mint'],
            ['Gross sales', money(lifetime.gross_revenue), 'text-text-primary'],
            ['Refunded / reversed', money(lifetime.refunded_revenue), 'text-pink'],
            ['Provider cost', money(lifetime.provider_cost), 'text-text-muted'],
            ['Gross profit', money(lifetime.gross_profit), number(lifetime.gross_profit) >= 0 ? 'text-mint' : 'text-pink'],
            ['Profit margin', percent(lifetime.margin_percent), 'text-violet'],
            ['Paying customers', count(lifetime.paying_customers), 'text-text-primary'],
            ['Customer conversion', percent(customers.lifetime_conversion_percent), 'text-gold'],
          ].map(([label, value, color]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-panel-alt px-3 py-2.5"><span className="text-[10px] text-text-dim">{label}</span><strong className={`font-utility text-xs ${color}`}>{value}</strong></div>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-panel">
        <div className="border-b border-border p-5"><div className="flex items-center gap-2"><CreditCard size={17} className="text-violet" /><h3 className="font-semibold text-text-primary">Subscription plan report</h3></div><p className="mt-1 text-[10px] text-text-dim">How many people subscribe to each plan, renewal health and current recurring value.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-panel-alt text-text-dim"><tr><th className="p-4">Plan</th><th>Price</th><th>Credits / month</th><th>Active people</th><th>Auto-renewing</th><th>Ending</th><th>Past due</th><th>Inactive history</th><th className="pr-4">Plan MRR</th></tr></thead><tbody className="divide-y divide-border">{subscriptionPlans.map((plan) => <tr key={text(plan.plan)}><td className="p-4"><p className="font-semibold text-text-primary">{text(plan.name)}</p><p className="mt-1 font-utility text-[9px] text-text-dim">{text(plan.plan)}</p></td><td className="font-semibold text-text-primary">{money(plan.monthlyPriceUsd)}</td><td className="text-text-muted">{count(plan.creditsPerMonth)}</td><td className="font-semibold text-mint">{count(plan.active_subscribers)}</td><td className="text-text-muted">{count(plan.auto_renewing)}</td><td className="text-text-muted">{count(plan.ending)}</td><td className={number(plan.past_due) ? 'font-semibold text-amber-200' : 'text-text-muted'}>{count(plan.past_due)}</td><td className="text-text-muted">{count(plan.inactive)}</td><td className="pr-4 font-utility font-semibold text-violet">{money(number(plan.auto_renewing) * number(plan.monthlyPriceUsd))}</td></tr>)}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-panel">
        <div className="border-b border-border p-5"><div className="flex items-center gap-2"><ReceiptText size={17} className="text-mint" /><h3 className="font-semibold text-text-primary">Every plan, video package and credit pack</h3></div><p className="mt-1 text-[10px] text-text-dim">Exact purchases and money collected for each catalog item in {text(report.rangeLabel).toLowerCase()}, alongside lifetime totals.</p></div>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product, package or plan" className="w-full rounded-xl border border-border bg-bg py-2.5 pl-9 pr-3 text-xs text-text-primary" /></div><select value={productCategory} onChange={(event) => setProductCategory(event.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2.5 text-xs text-text-primary"><option value="all">All product types</option><option value="subscription">Subscriptions</option><option value="video package">Video packages</option><option value="credit pack">Credit packs</option><option value="legacy">Legacy</option></select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1160px] text-left text-xs"><thead className="bg-panel-alt text-text-dim"><tr><th className="p-4">Product</th><th>Type</th><th>Price</th><th>Credits</th><th>Period purchases</th><th>Period customers</th><th>Period revenue</th><th>Refunds</th><th>Lifetime purchases</th><th className="pr-4">Lifetime revenue</th></tr></thead><tbody className="divide-y divide-border">{filteredProducts.map((product) => { const current = row(product.period); const all = row(product.lifetime); return <tr key={text(product.productId)}><td className="p-4"><p className="font-semibold text-text-primary">{text(product.name)}</p><p className="mt-1 font-utility text-[9px] text-text-dim">{text(product.productId)}</p></td><td><span className="rounded-full bg-violet/10 px-2 py-1 text-[9px] capitalize text-violet">{text(product.category)}</span></td><td className="font-semibold text-text-primary">{money(product.priceUsd)}</td><td className="text-text-muted">{count(product.credits)}</td><td className="font-semibold text-mint">{count(current.paid_sales)}</td><td className="text-text-muted">{count(current.buyers)}</td><td className="font-utility font-semibold text-text-primary">{money(current.net_revenue)}</td><td className={number(current.refunded_sales) ? 'text-pink' : 'text-text-muted'}>{count(current.refunded_sales)} · {money(current.refunds)}</td><td className="text-text-muted">{count(all.paid_sales)}</td><td className="pr-4 font-utility font-semibold text-violet">{money(all.net_revenue)}</td></tr>; })}</tbody></table>{!filteredProducts.length && <Empty>No products match these filters.</Empty>}</div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-panel p-5"><div className="flex items-center gap-2"><Gauge size={17} className="text-mint" /><h3 className="font-semibold text-text-primary">Credit economy</h3></div><div className="mt-4 space-y-2">{[
          ['Credits purchased', count(credits.credits_purchased)],
          ['Credits spent', count(credits.credits_spent)],
          ['Credits refunded', count(credits.credits_refunded)],
          ['All positive grants', count(credits.total_positive_credits)],
          ['Current customer balances', count(credits.current_customer_balance)],
        ].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-panel-alt px-3 py-2.5"><span className="text-[10px] text-text-dim">{label}</span><strong className="font-utility text-xs text-text-primary">{value}</strong></div>)}</div></div>
        <div className="rounded-3xl border border-border bg-panel p-5"><div className="flex items-center gap-2"><FileVideo size={17} className="text-violet" /><h3 className="font-semibold text-text-primary">Production health</h3></div><div className="mt-4 space-y-2">{[
          ['All productions', count(productions.total)],
          ['Completed', count(productions.completed)],
          ['Running now', count(productions.running)],
          ['Failed', count(productions.failed)],
          ['Cancelled', count(productions.cancelled)],
        ].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-panel-alt px-3 py-2.5"><span className="text-[10px] text-text-dim">{label}</span><strong className="font-utility text-xs text-text-primary">{value}</strong></div>)}</div></div>
        <div className="rounded-3xl border border-border bg-panel p-5"><div className="flex items-center gap-2"><Users size={17} className="text-gold" /><h3 className="font-semibold text-text-primary">Customer health</h3></div><div className="mt-4 space-y-2">{[
          ['Registered users', count(customers.total_users)],
          ['New in period', count(customers.new_users)],
          ['Paying in period', count(customers.period_paying_users)],
          ['Lifetime paying users', count(customers.lifetime_paying_users)],
          ['Past-due subscribers', count(subscriptions.past_due_subscribers)],
        ].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-panel-alt px-3 py-2.5"><span className="text-[10px] text-text-dim">{label}</span><strong className="font-utility text-xs text-text-primary">{value}</strong></div>)}</div></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <div className="overflow-hidden rounded-3xl border border-border bg-panel"><div className="border-b border-border p-5"><h3 className="font-semibold text-text-primary">Payment mix</h3><p className="mt-1 text-[10px] text-text-dim">Transactions grouped by type and status.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead className="bg-panel-alt text-text-dim"><tr><th className="p-3">Type</th><th>Status</th><th>Count</th><th>Customers</th><th>Amount</th></tr></thead><tbody className="divide-y divide-border">{paymentKinds.map((item, index) => <tr key={`${text(item.kind)}-${text(item.status)}-${index}`}><td className="p-3 capitalize text-text-muted">{text(item.kind).replaceAll('_', ' ')}</td><td><span className={`rounded-full px-2 py-1 text-[9px] capitalize ${statusClass(item.status)}`}>{text(item.status)}</span></td><td className="text-text-muted">{count(item.transactions)}</td><td className="text-text-muted">{count(item.customers)}</td><td className="font-semibold text-text-primary">{money(item.amount)}</td></tr>)}</tbody></table>{!paymentKinds.length && <Empty>No payments in this period.</Empty>}</div></div>
        <div className="overflow-hidden rounded-3xl border border-border bg-panel"><div className="border-b border-border p-5"><h3 className="font-semibold text-text-primary">Recent transactions</h3><p className="mt-1 text-[10px] text-text-dim">Latest payments, pending checkouts, refunds, invoices and customer references.</p></div><div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" /><input value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Search transactions" className="w-full rounded-xl border border-border bg-bg py-2.5 pl-9 pr-3 text-xs text-text-primary" /></div><select value={transactionSearchBy} onChange={(event) => setTransactionSearchBy(event.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2.5 text-xs text-text-primary"><option value="all">Search everything</option><option value="customer">Customer</option><option value="product">Product</option><option value="reference">Reference</option><option value="type">Payment type</option></select><select value={transactionStatus} onChange={(event) => setTransactionStatus(event.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2.5 text-xs text-text-primary"><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="reversed">Reversed</option></select></div><div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="sticky top-0 z-10 bg-panel-alt text-text-dim"><tr><th className="p-3">Date</th><th>Customer</th><th>Product</th><th>Type</th><th>Amount</th><th>Credits</th><th>Status</th><th>Invoice</th><th className="pr-3">Reference</th></tr></thead><tbody className="divide-y divide-border">{filteredPayments.map((payment) => <tr key={text(payment.id)}><td className="p-3 text-text-dim">{date(payment.created_at)}</td><td className="max-w-52"><button type="button" disabled={!payment.user_id} onClick={() => onViewUser(text(payment.user_id))} title={payment.user_id ? `View all information for ${text(payment.email)}` : text(payment.email)} className="max-w-52 truncate text-left font-semibold text-text-primary transition hover:text-violet hover:underline disabled:cursor-default disabled:hover:text-text-primary disabled:hover:no-underline">{text(payment.email)}</button></td><td className="text-text-muted">{text(payment.product_id)}</td><td className="capitalize text-text-muted">{text(payment.kind).replaceAll('_', ' ')}</td><td className="font-semibold text-text-primary">{money(payment.amount_usd)}</td><td className="text-text-muted">{count(payment.credits_granted)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] capitalize ${statusClass(payment.status)}`}>{text(payment.status)}</span></td><td className="text-text-muted">{payment.invoice_emailed_at ? 'Emailed' : 'Not emailed'}</td><td className="max-w-44 truncate pr-3 font-utility text-[9px] text-text-dim" title={text(payment.provider_ref)}>{text(payment.provider_ref)}</td></tr>)}</tbody></table>{!filteredPayments.length && <Empty>No transactions match these filters.</Empty>}</div></div>
      </section>
    </div>
  );
}
