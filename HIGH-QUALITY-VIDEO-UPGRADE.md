# High-quality AI video upgrade

This build changes AiWebVideo's default video path from a speed-first setup to a final-quality-first setup.

## What changed

- **Premium Veo by default:** `veo-3.1-generate-preview` is now the default final-render model. Fast remains an explicit operator override only.
- **Native 24 FPS:** the UI and renderer now default to Veo's native 24 FPS instead of converting every output to 30/60 FPS and implying extra generated motion quality.
- **Direct 1080p / 4K requests:** each 8-second Veo scene is requested at the selected provider resolution, then mastered with a high-quality H.264 pass (`medium`, CRF 14–15) instead of a lower-quality fast re-encode.
- **Better Custom / Scenario references:** up to three uploaded images can be passed as Veo asset references per scene. They preserve people/products/places/style without forcing the same reference photo to become the literal first frame of every clip.
- **More varied custom films:** reference combinations rotate across fallback scenes and the planner is told to vary framing/action while keeping subject identity consistent.
- **Scene-first prompts:** the actual scene direction and customer brief are now the highest-priority runtime prompt content. The customer brief budget was increased substantially rather than truncating it to a tiny fragment.
- **Anti-AI-artifact direction:** runtime prompts explicitly reject poster/storyboard/infographic outputs, fake Arabic/English, fake UI, fake logos, warped hands/faces, flicker, morphing, and repeated stock-looking compositions.
- **Square-safe framing:** 1:1 renders keep important content inside the central crop-safe area.
- **32s / 64s presets:** the standard durations align to complete 8-second Veo scenes instead of 24s / 56s labels.
- **Pricing/credits updated for premium generation:** premium 1080p is quoted at 4 credits/sec and 4K at 5 credits/sec, with narration charged separately.

## Deployment requirement

Use this in `.env.local` for final-quality customer renders:

```env
GEMINI_VIDEO_MODEL=veo-3.1-generate-preview
```

Do not set the Fast model unless you intentionally want cheaper draft/testing renders.

## One-time prices

The project now grants the following credits for premium final renders:

- Quick pack: **$9.99 / 38 credits**
- Standard pack: **$34.99 / 134 credits** (32s)
- Full pack: **$69.99 / 262 credits** (64s)

The server controls the charge amount through its fixed payment catalog. Only the payment Client ID and Secret are required in `.env.local`.

## Important quality note

No prompt can guarantee that a generative model will reproduce tiny interface text or a logo perfectly inside a moving phone screen. For final advertisements, use Veo for the cinematic scene and keep critical Arabic copy, exact logos, and exact UI as deterministic post-production overlays whenever brand/text accuracy is mandatory.
