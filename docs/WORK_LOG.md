# Work log

## 2026-09-30 — Generation toolbar buttons
- Request/example brief: “Redesign AiWebVideo's Style, Ideas, References, model, duration, aspect ratio, quality and audio buttons into a compact, readable toolbar that feels consistent with the existing dark brand and works on phones.” Screenshot supplied by Mohammad.
- Changed: `WebsiteBriefForm.tsx` and scoped toolbar styles in `index.css`. Desktop buttons are 36px high, touch/mobile targets are 44px, text is 12px, model emphasis is restrained violet, and ratio outlines match portrait/landscape/square proportions. References highlight when files are attached. Open states and keyboard focus have distinct borders.
- Interaction: Existing Radix Popover dependency positions model/duration/setting panels in a portal with collision padding, bounded height and scrolling; Escape/outside interaction dismisses them and focus is managed by the primitive. Style/Ideas retain their inline panels and support Escape/outside-composer dismissal.
- Preserved: Existing choices, model compatibility, attachment limits, credits, generation callbacks, chat auto-scroll, backend and deployment configuration. No migrations, new dependencies, or environment variables.
- Verified: Frozen-lockfile dependency installation, frontend TypeScript check, frontend Vite production build and `git diff --check` passed. Radix API checked against https://www.radix-ui.com/primitives/docs/components/popover on 2026-09-30.
- Remaining: Browser visual/interaction verification is blocked: Chromium is absent and Playwright downloads return invalid/truncated ZIP archives. Do not treat this update as visually verified or deployed.
- Review checklist: At 320/390/768/1440px open every menu, confirm viewport bounds, choose each ratio, switch model and confirm compatible settings, change duration, attach/remove an image, Escape/outside-click dismissal and focus return, keyboard traversal and reduced motion. Verify the toolbar in landing and workspace contexts.
- Continue: Complete browser review before release; Hostinger deployment remains the existing `README-DEPLOY.md` workflow.


## 2026-09-30 — Make the toolbar redesign visibly distinct
- Request: The first redesign still looked like the old boxed buttons in the user's updated screenshot.
- Changed: Borderless creative actions; one shared output-settings surface; a pale violet model selector with dark text; no repeated chevrons on numeric/audio controls; high-contrast proportionate ratio icons; mobile groups wrap with 44px targets.
- Preserved: Menu behavior, all generation settings, compatibility, file limits and callbacks. This is a targeted toolbar revision.
- Verification: Frontend typecheck, production build and diff checks run for this revision. Browser visual QA remains unavailable in this environment (previous local Chromium download and cloud-localhost access failures).

## 2026-09-30 — Profile/admin simplification, pricing, studio direction, example gallery, checkout
- Profile page: credits card with usage bar and %, tabs for usage/projects/billing/security (keeps #usage and #billing links). Admin: shared filter bar, rarely used filters behind "More", simplified tabs.
- Pricing: credit packs $4.99/$14.99/$24.99 (70/265/460 credits), one-video packs $5.99/$27.99/$79.99 sized to cover Cinema 2 1080p + narration. Shared price list in `lib/pricing.ts`; contract test keeps it identical to the server. Welcome price still clears 2x provider cost.
- Studio direction is server-owned (`lib/studio-direction.ts`): master prompts for interior and architecture, unit-labelled site block (plot, setback, floors, buildable footprint), idempotent composition. Interior/architecture images use their own prompt and four consistent camera views. The browser sends only the customer's words; idea directions and example templates travel separately and are never shown.
- Product link is optional and read automatically (paste, blur or generate). Extraction understands ProductGroup/@graph/array types, relative and social images and falls back to ranked page images.
- Example gallery: admin uploads images and videos together, selects several and assigns them to a feature (saving is blocked until every item has one). Landing shows a label-free masonry with filters; each chat shows its feature's examples. "Make one like this" attaches the example as a hidden style template and replaces its subject with the customer's references. Videos are re-encoded for phones (H.264, faststart) with a poster frame.
- Checkout redesigned: compact single column, saved cards in network colours with Pay on the card, switch instead of checkbox.
- Verified: typecheck, production builds, 216 tests (9 pre-existing failures in older checkout-copy contract tests and a queue-message test, unchanged), plus jsdom runs of the real chat form and gallery. Not verified: real Gemini output quality, real payment flow, real browsers/phones.

## 2026-10-01 — Follow-up: gallery regression fix, phone-video tooling, green test suite
- Landing gallery now also shows older homepage videos that have no feature yet (they open the generator; filed items open "make one like this"), so the section is never empty after deploy.
- Admin Homepage: "Optimize videos for phones" re-encodes already-uploaded videos one at a time (`POST /api/admin/marketing/optimize`), skipping files that are already H.264 + fast-start; nothing is published until Save. Verified against real ffmpeg (HEVC + slow-start in, H.264/yuv420p + fast-start + poster out; corrupt input returns the original).
- Test suite brought in line with the current checkout design: the repo's tests contradicted each other about a PayPal redirect fallback (older ones required it, `checkout-ui-contract` forbids it). Followed the newer rule (card-only, no PayPal button). Decision for the owner: if customers must have a PayPal fallback when card fields cannot load, restore `continueWithPayPal` and flip those assertions.
- 229 tests pass, 0 fail.
