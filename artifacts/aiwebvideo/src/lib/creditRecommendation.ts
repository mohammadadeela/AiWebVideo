/** All quantities here are internal ledger credits. Display conversion happens only at the UI boundary. */
export function recommendCreditOption<T extends { id: string; credits: number; amountUsd: number }>(
  products: T[], required: number, balance: number, priceFor: (product: T) => number = (product) => product.amountUsd,
): (T & { price: number }) | null {
  const missing = Math.max(0, required - balance);
  if (missing === 0) return null;
  return products.filter((product) => product.credits >= missing && Number.isFinite(priceFor(product)))
    .map((product) => ({ ...product, price: priceFor(product) }))
    .sort((a, b) => a.price - b.price || a.credits - b.credits)[0] ?? null;
}
