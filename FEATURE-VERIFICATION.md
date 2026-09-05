# AiWebVideo feature verification — continuous generation architecture

## Public creator features

| Feature | Frontend route | Planning mode | Final engine | Verified contract |
|---|---|---|---|---|
| Website Video | URL + campaign brief | `video` or selected website recipe | One Veo base video + continuation of the same Veo video | Yes |
| AI Video | Studio `idea` | `ai-video` internally | Text/reference-to-video continuous Veo | Yes |
| Product Photos | Studio `product` + `photos` | Reference-based photo plan | Gemini image generation + image master | Yes |
| Product Video | Studio `product` + `video` | `product-video` internally | Reference-faithful continuous Veo | Yes |
| Talking Scene | Studio `scenario` | `talking-scene` internally | Prompt/reference continuous Veo | Yes |

## Website campaign recipes

`Promo`, `Cinematic`, `Tutorial`, `Feature tour`, `How to buy`, and `LinkedIn` each retain a distinct planning/runtime mode. All video recipes now enter the same continuous-film renderer rather than a per-scene clip renderer.

## Continuous-video rule

The active `generateMarketingVideo()` path does not generate independent scene files and concatenate them. It generates an initial Veo video and, when the requested duration is longer than the base generation, extends that exact returned Veo video through Veo video extension. The final provider video is downloaded once and mastered/trimmed to the exact requested whole-second duration.

Customer duration range: **8–144 seconds**, any whole second.

The 144-second product cap reflects Veo 3.1's current extension limit: initial 8-second generation plus up to 20 seven-second extensions can yield up to 148 seconds; AiWebVideo caps the UI at 144 seconds and trims to the exact requested duration.

## Permanent server-side quality direction

Every video request receives the customer brief plus a server-side master production directive that enforces continuous identity, brand/product fidelity, typography safety, resolved actions, premium cinematography, audio continuity, no black/loading filler, no duplicate/replayed opening, and a resolved ending.

Every generated image receives a server-side master image directive for product/person/logo identity, no fake or misspelled text, accurate geometry/materials, clean commercial lighting, and artifact avoidance.

## Delivery-resolution note

Veo 3.1 video extension currently requires a 720p continuity source. Therefore:

- An 8-second generation can be requested from Veo natively at 720p/1080p/4K where supported.
- Videos longer than 8 seconds use Veo's 720p extension chain, then AiWebVideo masters the final continuous source to the selected 1080p or 4K delivery canvas.
- The UI labels longer output as **1080p master** / **4K mastered**, not native 4K.

## Validation performed in this package

- Parsed all TypeScript/TSX files with TypeScript transpilation: no syntax errors.
- Static feature-contract audit: frontend entries, recipe modes, studio upload modes, planner routing, runtime routing, continuous extension path, exact duration handling, and hidden quality directives all present.
- Project tests were updated for the continuous architecture and exact whole-second duration policy.

A live provider end-to-end generation still requires the deployed environment, valid `GEMINI_API_KEY`, database, ffmpeg, and external API/network access. This package cannot honestly claim a live provider render was executed inside the offline build environment.
