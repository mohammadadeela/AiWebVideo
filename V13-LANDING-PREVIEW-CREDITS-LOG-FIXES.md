# V13 Landing Preview, Credits UX, and Render Log Fixes

## Public landing flow
- Website mode is the only public creator that can run before authentication.
- The visitor must enter a valid website URL and promotion brief before starting.
- Smart settings and optional references remain available.
- Credit prices are hidden everywhere inside the landing-page creator.
- The landing CTA is `Preview my website`.
- The backend performs only the safe website capture/brand-read phase for the guest.
- The real favicon/tab icon and distinct useful screenshots are shown immediately as capture completes.
- The guest flow stops at `preview_ready`; storyboard and paid video generation do not start.
- `Continue in Workspace` then asks the visitor to sign in or create an account.
- The guest job is claimed into the authenticated account, guest attachments are restored/uploaded, and the saved URL, promotion, duration, format, quality, audio and narration language are persisted.
- Workspace starts the free direction/storyboard step automatically, then stops at the explicit final `Generate` button. No render credits are spent until that click.
- If sign-in involved a reload, the active guest job id remains in local storage and the landing-page auth redirect reopens that exact job instead of losing it.

## Other creator modes
- AI Video, Product Photos, Product Video and Talking Scene are authentication-gated as soon as the visitor selects them on the public landing page.
- After authentication the visitor is sent to Workspace with the selected creator mode.

## Insufficient credits
- The credit modal is now a compact three-tab checkout UI:
  1. Plans
  2. Buy credits
  3. Buy video
- Checkout is available from the modal without exposing provider controls.
- The project/job id is passed through checkout so the user can return to the same saved production.
- Failed paid generations continue to use the existing automatic credit refund flow.

## Veo production errors fixed
The supplied PM2 logs showed two AiWebVideo-specific issues:
- Deprecated `generateVideos` top-level `prompt` / `video` arguments.
- Veo extension rejected a portrait input video: `Aspect ratio of the input video must be 16:9, but got: 9:16`.

Fixes:
- Both initial continuous generation and video continuation now use the new `source` argument.
- Any film longer than 8 seconds uses a 16:9 provider continuity source because the extension API requires it.
- Requested 9:16 and 1:1 deliveries are mastered from that continuity source afterward.
- For long portrait deliveries, the permanent video prompt explicitly keeps all essential people, products, logos, UI and actions inside the central 9:16-safe area so final mastering does not crop important content.
- Native 8-second portrait generation remains 9:16 when supported because no extension input is required.

## Duration persistence
- Browser workflow restoration now preserves the exact whole-second duration from 8–144 seconds instead of snapping restored values back to old 8-second boundaries.

## Verification performed in this environment
- Parsed all 161 TypeScript/TSX files using the TypeScript parser: 0 syntax errors.
- 14/14 targeted contract checks passed for landing preview state, auth gating, settings persistence, manual render pause, attachment persistence, paywall tabs, payment provider selection, source API use, long-video provider aspect, portrait crop-safe prompting, server workflow schema, and whole-second duration restoration.
- Full `pnpm install/typecheck/build` could not run here because the environment cannot reach the npm registry; the deployment server should run the normal full typecheck/build.
