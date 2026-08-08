export function QuickReplyChips({
  options,
  onSelect,
  disabled,
}: {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 animate-fade-in" role="group" aria-label="Quick replies">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          className="group rounded-2xl border border-white/10 bg-white/[.035] px-4 py-2.5 text-[13px] font-medium text-text-primary
                     shadow-[0_8px_24px_-20px_rgba(0,0,0,.9)] transition-all duration-200
                     hover:-translate-y-0.5 hover:border-violet/45 hover:bg-violet/10 hover:shadow-[0_12px_28px_-20px_rgba(139,92,246,.75)]
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet
                     disabled:pointer-events-none disabled:opacity-40"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
