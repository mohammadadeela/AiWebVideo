/** A soft on/off switch with a label. Replaces native checkboxes. */
export function ToggleRow({ checked, onChange, label, hint, disabled = false }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.03] px-3.5 py-3 text-left transition hover:border-white/20 disabled:opacity-50"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-violet" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-tight text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-4 text-white/45">{hint}</span>}
      </span>
    </button>
  );
}
