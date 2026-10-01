/**
 * The price of a production is frozen when planning reserves its credits.
 *
 * Why: planning priced the job from the request, while render re-priced it from the saved workflow and
 * the plan. Any difference between the two (an audio default, a model fallback, a length the planner
 * adjusted) made the render ask for MORE than was reserved, and a customer with an exact balance was
 * sent to the buy window halfway through a production they had already paid for.
 *
 * Rule: once a plan exists, the render charge equals what was reserved. The only thing a customer can still
 * change after planning is AI narration, so only that add-on may move the number, in either direction.
 */
export interface PlannedBilling {
  /** Credits reserved at planning (the price the customer saw and agreed to). */
  reservedCredits: number;
  /** What AI narration costs for this production (0 for photo sets). */
  narrationCredits: number;
  /** Whether narration was part of the reserved price. */
  narrationIncluded: boolean;
}

export function plannedBillingFrom(input: { totalCredits: number; narrationCredits: number; narrationIncluded: boolean }): PlannedBilling {
  return {
    reservedCredits: Math.max(0, Math.round(input.totalCredits)),
    narrationCredits: Math.max(0, Math.round(input.narrationCredits)),
    narrationIncluded: input.narrationIncluded && input.narrationCredits > 0,
  };
}

export function isPlannedBilling(value: unknown): value is PlannedBilling {
  const v = value as Partial<PlannedBilling> | null | undefined;
  return Boolean(v)
    && Number.isFinite(v!.reservedCredits) && (v!.reservedCredits as number) > 0
    && Number.isFinite(v!.narrationCredits)
    && typeof v!.narrationIncluded === 'boolean';
}

/** The render charge: the reserved price, plus or minus the narration add-on if it changed. */
export function plannedRenderCost(planned: PlannedBilling, wantsNarration: boolean): number {
  const withoutNarration = planned.reservedCredits - (planned.narrationIncluded ? planned.narrationCredits : 0);
  return Math.max(1, withoutNarration + (wantsNarration ? planned.narrationCredits : 0));
}
