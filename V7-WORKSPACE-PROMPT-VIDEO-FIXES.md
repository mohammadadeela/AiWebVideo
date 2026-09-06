# AiWebVideo V7 verification

## Production error fixed

The Gemini/Veo request no longer sends `negativePrompt` in either the legacy video config builder or the continuous-video base request. The production error `Negative prompt is not supported in your use case` is therefore removed at the request source. A regression helper/test also treats `negativePrompt` as a forbidden Gemini Developer API field, and public-error sanitization hides that provider diagnostic if it ever appears again.

## Reliable text policy

All AI-generated on-screen typography is disabled by default. If a customer explicitly requests visible marketing copy, the internal planner and video master prompt require short, correctly spelled English text only. Existing website/reference text is never translated, redrawn, or corrected; non-English website UI is kept as source imagery and directed with wider/stable framing instead of asking Veo to recreate dense lettering. Brand/proper names remain unchanged. Spoken dialogue/narration remains controlled separately by the selected audio/language setting.

For website branded endings, the deterministic overlay uses the website hostname/domain rather than a possibly non-English page title. This avoids AI typography entirely and avoids Arabic/other-script shaping problems in the final deterministic brand card.

## Prompt required before generation

The main creator now requires a non-empty prompt for:

- Website Video
- AI Video
- Product Photos
- Product Video
- Talking Scene

Website URL + prompt are both required. Product modes require prompt + product reference image(s). Backend validation also enforces the prompt for website capture and Studio generation, so direct API calls cannot bypass the UI requirement.

## Workspace routing

- A user who was already signed in when the landing page opens is redirected to `/dashboard`.
- If a signed-in user opened a landing URL with `?create=website|video|photo|product-video|scenario`, that intent is carried into Workspace.
- A guest can configure the landing creator, but pressing Generate authenticates first, creates/saves the job, then routes to `/dashboard?job=...`.
- Studio generations created from a public page also route to their exact Workspace chat after the job/plan exists.
- Error cases do not navigate away before a job exists, so validation/capacity/credit messages stay visible.

## Chat history and previous prompts

Website jobs persist URL, exact customer prompt, and setup summary immediately when the job is created. Studio jobs persist uploaded-reference information, exact prompt, and setup summary. Restoring a chat now keeps previous creative-choice and variant messages instead of hiding them; only internal source-continuation bookkeeping remains hidden.

The database thread query already loads the complete ancestor/descendant job conversation in chronological order, so new versions of the same chat keep their earlier prompts and details.

## Done button position

Closing Smart Settings scrolls back to the main source/prompt block (Website URL + prompt / equivalent Studio prompt) rather than merely centering the Generate button. The Generate button remains focused and the scroll behavior works with both the Workspace chat scroller and the public-page scroller.

## Verification performed here

- Parsed all 172 TypeScript/TSX source files with TypeScript 5.8.3: 0 syntax errors.
- Static regression checks passed for prompt validation, transcript persistence, Workspace routing, English generated-text policy, domain closing label, and absence of runtime `negativePrompt` configuration.
- A full pnpm install/typecheck/build could not run in this sandbox because outbound access to the npm registry is disabled. Run the repository's normal `pnpm run typecheck` and `pnpm run build` during VPS deployment, where dependencies are already available/installed.
