import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Soft numeric field with − / + buttons.
 * - values are kept as strings so an empty field stays empty (no jumping back to a default)
 * - typing is filtered to digits (and one decimal point when `decimal`)
 * - the native browser spinner is never used
 * - the value is clamped to min/max when the field loses focus or a button is pressed
 */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  placeholder = "0",
  decimal = false,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  decimal?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const numeric = Number(value);
  const hasValue = value.trim() !== "" && Number.isFinite(numeric);

  const format = (next: number) => String(Number(Math.min(max, Math.max(min, next)).toFixed(2)));

  function bump(direction: 1 | -1) {
    if (!hasValue) {
      onChange(format(direction === 1 ? Math.max(min, step) : min));
      return;
    }
    onChange(format(numeric + direction * step));
  }

  function sanitize(raw: string) {
    let next = raw.replace(decimal ? /[^\d.]/g : /\D/g, "");
    if (decimal) {
      const [head, ...rest] = next.split(".");
      next = rest.length ? `${head}.${rest.join("").slice(0, 2)}` : head;
    }
    return next.slice(0, 6);
  }

  return (
    <div
      className={`group relative flex min-w-0 items-center gap-1 rounded-2xl border bg-white/[.035] px-1.5 py-1.5 transition ${
        focused ? "border-violet/60 bg-violet/[.06] ring-4 ring-violet/10" : "border-white/[.09] hover:border-white/20"
      } ${disabled ? "opacity-50" : ""} ${className}`}
    >
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || (hasValue && numeric <= min)}
        onClick={() => bump(-1)}
        aria-label={`Decrease ${label}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white active:scale-90 disabled:opacity-30"
      >
        <Minus size={14} />
      </button>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-text text-center">
        <span className="block truncate text-[10px] font-medium leading-3 text-white/45">{label}</span>
        <span className="flex items-baseline justify-center gap-1">
          <input
            id={id}
            type="text"
            inputMode={decimal ? "decimal" : "numeric"}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              if (hasValue) onChange(format(numeric));
              else if (value.trim() !== "") onChange("");
            }}
            onChange={(event) => onChange(sanitize(event.currentTarget.value))}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") { event.preventDefault(); bump(1); }
              if (event.key === "ArrowDown") { event.preventDefault(); bump(-1); }
            }}
            className="w-full min-w-0 bg-transparent text-center text-[15px] font-semibold tabular-nums text-white outline-none placeholder:text-white/20"
          />
          {unit && <span className="shrink-0 text-[10px] font-medium text-white/35">{unit}</span>}
        </span>
      </label>
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || (hasValue && numeric >= max)}
        onClick={() => bump(1)}
        aria-label={`Increase ${label}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white active:scale-90 disabled:opacity-30"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
