/** Never echo model-facing instructions in customer-facing planning UI. */
export function publicPlanningCopy(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  if (!text || /^(?:Goal:|SYSTEM(?:\s+PROMPT|\s+INSTRUCTION)?\s*:|INTERNAL\s+INSTRUCTIONS?\s*:)/i.test(text)
    || /User additions after this prompt have priority|Do not invent an unrelated brand/i.test(text)) return fallback;
  return text;
}
