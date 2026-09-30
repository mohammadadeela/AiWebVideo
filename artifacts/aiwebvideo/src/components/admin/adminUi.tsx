import { useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

/** Small shared building blocks so every admin screen looks and behaves the same. */

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-8 text-center text-sm text-text-dim">{children}</p>;
}

const TONES = {
  violet: 'text-violet',
  mint: 'text-mint',
  pink: 'text-pink',
  gold: 'text-amber-200',
} as const;

export function StatCard({ label, value, hint, tone = 'violet' }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <article className="rounded-2xl border border-border bg-panel p-4 sm:p-5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-2 font-utility text-2xl font-bold ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-4 text-text-dim">{hint}</p>}
    </article>
  );
}

/** Pill-style single choice control (replaces dropdowns that only have a few options). */
export function Segmented({ value, onChange, options, label, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[value: string, label: string]>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} className="chat-scroll flex gap-1 overflow-x-auto rounded-2xl bg-white/[.04] p-1">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`min-h-9 shrink-0 rounded-xl px-3.5 text-xs font-semibold transition disabled:opacity-60 ${value === id ? 'bg-white text-[#1b1030] shadow' : 'text-text-muted hover:text-white'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[value: string, label: string]>;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-10 min-w-0 rounded-xl border bg-bg px-3 text-xs text-text-primary outline-none transition focus:border-violet/50 ${value !== options[0]?.[0] ? 'border-violet/40' : 'border-border'}`}
    >
      {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  );
}

/**
 * One filter bar for every table: a search box, the few filters people use daily inline,
 * and everything else tucked behind "More" (with a dot when one of them is active).
 */
export function FilterBar({ search, onSearch, placeholder, children, more, moreActive = false, active, onClear }: {
  search?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  more?: ReactNode;
  moreActive?: boolean;
  active: boolean;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {onSearch && (
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              value={search ?? ''}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={placeholder ?? 'Search'}
              className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-base text-text-primary outline-none transition focus:border-violet/50 sm:text-xs"
            />
          </div>
        )}
        {children}
        {more && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className={`relative inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${open ? 'border-violet/50 bg-violet/10 text-white' : 'border-border text-text-muted hover:text-white'}`}
          >
            <SlidersHorizontal size={13} /> More
            {moreActive && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-violet" />}
          </button>
        )}
        {active && (
          <button type="button" onClick={onClear} className="inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-violet transition hover:bg-violet/10">
            <X size={13} /> Clear
          </button>
        )}
      </div>
      {more && open && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white/[.03] p-2">{more}</div>}
    </div>
  );
}
