# Partial video delivery settlement cases

This is a compact implementation checklist kept beside the regression tests.

- Full requested duration: deliver normally; no duration refund.
- Extension/provider failure after >= 50% completed: stop immediately, never submit another generation, master the last completed provider video, refund only missing whole seconds at the selected customer per-second rate.
- Provider returns a shorter completed file than expected: bill from verified deliverable whole seconds and refund the remainder.
- Less than 50% completed: do not count the fragment as a paid delivery; fail safely so the render route restores the remaining/full reservation.
- Base generation failure or no valid >= 8s video: no partial asset; normal full-refund failure path.
- User cancellation: never convert to partial delivery; discard output and restore the render reservation.
- Voiceover requested on a shortened video: do not squeeze the full narration into the shorter film; refund the narration surcharge through the existing narration-failure settlement.
- Photo + video mode: duration refund is video-only; any missing-photo refund remains independent.
- Download retry: allowed because it retries transfer of an already-generated file, never a paid generation.
- Asset/DB settlement failure after a duration refund: existing job-scoped refund cap prevents double refunds; the normal failure path restores only credits still reserved by the job.
