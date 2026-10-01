/** Price after a percentage discount, rounded to whole cents. Pure, so it is safe anywhere (including tests). */
export function discountedPrice(amountUsd: number, percent: number): number {
  const safeAmount = Math.max(0, Number(amountUsd) || 0);
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.round((safeAmount * (1 - safePercent / 100) + Number.EPSILON) * 100) / 100;
}
