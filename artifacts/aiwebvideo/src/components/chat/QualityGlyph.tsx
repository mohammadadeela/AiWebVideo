type Quality = "1080p" | "4k";

/** 4K / HD badge — a proper glyph instead of a generic sparkle. */
export function QualityGlyph({ quality, size = 20 }: { quality: Quality; size?: number }) {
  const is4k = quality === "4k";
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-[7px] font-black leading-none tracking-tight ${
        is4k
          ? "bg-gradient-to-br from-gold via-pink to-violet text-[#1b1030] shadow-[0_4px_14px_-4px_rgba(236,72,153,.7)]"
          : "border border-white/20 bg-white/[.08] text-white/75"
      }`}
      style={{ height: size, minWidth: Math.round(size * 1.5), fontSize: Math.round(size * 0.48) }}
    >
      {is4k ? "4K" : "HD"}
    </span>
  );
}
