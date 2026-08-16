# AiWebVideo pricing and site audit

Checked: 2026-08-10

## Outcome

The default public catalog now keeps gross customer revenue at or above 2× the direct generation API cost for the configured Gemini models. This is a provider-cost floor, not a promise of 2× net profit after payment fees, tax, VPS/storage, support, free previews, refunds, or promotions.

Pricing sources:

- Gemini Developer API pricing: https://ai.google.dev/gemini-api/docs/pricing
- RunPod pricing: https://www.runpod.io/pricing
- RunPod serverless billing details: https://docs.runpod.io/serverless/pricing

## Verified provider costs and credit rules

| Generation | Published provider cost | Customer credits | Lowest subscription revenue | Gross revenue / provider cost |
| --- | ---: | ---: | ---: | ---: |
| Veo 3.1 Fast, 1080p | $0.12/sec | 1/sec | $0.2475/sec | 2.06× |
| Veo 3.1 Fast, 4K | $0.30/sec | 3/sec | $0.7425/sec | 2.48× |
| Veo 3.1 Standard, 1080p when explicitly selected | $0.40/sec | 4/sec | $0.99/sec | 2.48× |
| Veo 3.1 Standard, 4K when explicitly selected | $0.60/sec | 5/sec | $1.2375/sec | 2.06× |
| Gemini 3.1 Flash Image, 4K | $0.151/image | 8 per set of four | $1.98/set | 3.28× before small input/text cost |

The lowest subscription credit value is the Pro plan: $99 / 400 = $0.2475 per credit.

AI narration adds six credits. Gemini 3.1 Flash TTS audio output is $20 per million audio tokens and audio is counted at 25 tokens per second; a 56-second narration is about $0.028 of audio output before its small text/script cost.

## Catalog checked

| Product | Price | Credits | Result |
| --- | ---: | ---: | --- |
| Creator monthly | $39 | 150 | Passes 2× Fast 1080p floor |
| Pro monthly | $99 | 400 | Passes 2× Fast 1080p floor |
| Agency monthly | $249 | 1,000 | Passes 2× Fast 1080p floor |
| 100-credit top-up | $25 | 100 | Passes 2× Fast 1080p floor |
| 8-second 1080p pack | $2.99 | 14 | Covers video plus six narration credits and conservative overhead |
| ~24-second 1080p pack | $7.99 | 30 | Covers video plus six narration credits and conservative overhead |
| ~56-second 1080p pack | $17.99 | 62 | Covers video plus six narration credits and conservative overhead |

## Billing and credit fixes made

- First-time and zero-credit customers now see a persistent workspace notice with direct **Buy credits** and **View plans** actions.
- The exhausted-credit modal shows the exact estimated credit requirement and current balance.
- A dedicated **Recharge 100 credits for $25** section now exists at `/pricing#buy-credits`, with card and PayPal checkout.
- Free-plan accounts can buy credits and generate. One-time purchases no longer falsely change the account to a Creator subscription.
- Only real subscription events change the plan; rendering is controlled by the atomic credit balance check.
- One-time video packs now include the six credits charged for narration.
- 1080p, 4K, narration, and photo costs are disclosed separately instead of claiming every output uses one credit per second.
- The entire Admin landing-content editor was removed, including video and pricing controls. Homepage pricing and credit grants now come only from the fixed, tested checkout catalog in code.
- Stripe and PayPal catalogs remain covered by an equality regression test.
- Automatic Fast-to-Standard fallback was removed because it could spend Standard-model API rates after reserving only Fast-priced credits.
- If Standard is explicitly configured, server-side credit pricing automatically switches to conservative Standard rates.
- Successful Gemini video and image calls now add estimated provider cost to each job, so the Admin cost dashboard no longer shows zero for Gemini generation.

## Site simplification and performance review

- Route-level code splitting was added. The initial minified JavaScript shell fell from about 506 KB to 195 KB; dashboard, chat, admin, pricing, profile, and content pages now load as separate chunks.
- Stale, unused client credit constants were replaced with the same clear 1080p/4K/narration quote rules used by the UI.
- Uploaded development screenshots, pasted prompt notes, dependency folders, compiled output, and TypeScript build caches are excluded from the delivery archive because they are not required to deploy from source.
- PM2 was retained because the current deployment workflow and the latest deployment record still use the single `aiwebvideo-web` PM2 process.

## Keep vs. remove

Keep the core customer path: capture/upload → mode and format → storyboard → exact credit quote → generation → saved results. Keep chat history, profile/billing, the provider controls, cancellation/refunds, and the Admin cost view; each supports an active workflow.

Do not add more generation modes until usage data shows demand. The current nine mode choices already create decision load. If future analytics show very low use, combine **Feature Tour**, **Tutorial**, and **Buy Journey** under one guided-video selector rather than deleting their server capabilities.

## Operational guardrails

1. Keep `GEMINI_VIDEO_MODEL=veo-3.1-fast-generate-preview` for the public catalog.
2. Set `GPU_COST_PER_SECOND_USD` to the exact RunPod endpoint rate; RunPod bills from worker start to full stop, not only model inference time.
3. Re-run the pricing tests before changing any plan price, credit grant, model, resolution rule, fallback, or promotion.
4. Compare monthly payment revenue with `generation_cost_usd`, plus VPS, storage, payment fees, taxes, refunds, and free-preview costs. The code enforces a direct provider-cost multiple, not full accounting profit.
5. Create production Stripe Price objects with the exact prices and updated one-time credit grants documented in `README-DEPLOY.md`.
