# AiWebVideo v6 verification — downloads, landing videos, credits, favicon

## Video downloads
- Result download icon and **Export video** no longer fetch the full video into a JavaScript Blob before starting the download.
- The browser receives a direct signed same-origin asset URL with `download=1`.
- The API responds with `Content-Disposition: attachment` through Express `res.download`, so downloads stream immediately and large videos do not need to sit in browser memory first.
- Normal video playback remains range-friendly and uses the same asset route without attachment mode.

## Admin landing videos
- Landing settings preserve every saved configured video instead of forcing the list back to three entries.
- The admin can upload multiple videos in one selection; uploads are published together after they finish.
- Individual URL slots and individual file replacement are still supported.
- The first valid video is featured and all remaining valid videos are returned to the homepage gallery.
- A practical safety limit of 30 landing videos prevents accidental unbounded homepage configuration while still supporting a large gallery.
- Supporting homepage videos use lazy/none preload behavior so a large gallery does not download every video on page load.

## Customer credit accounting
Customer generation pricing is now one stable contract shared by the frontend quote and server charge:
- 1080p video: **4 credits per requested whole second**
- 4K video: **5 credits per requested whole second**
- Narration: **+6 credits once per production**
- Four-photo set: **8 credits**
- Video + photos: video price + 8 photo credits (+6 only when narration is selected)

Supported video durations remain 8–144 whole seconds. The admin cost matrix shows every duration, not only old 8-second steps.

### Purchase grants
Checkout uses one server-side credit product catalog, preventing client-controlled prices or credit values. `grantCreditsOnce` remains idempotent and updates the user's balance only once per successful provider event/order/invoice.

PayPal subscription payment handling also recovers the subscription directly from PayPal if the paid-event webhook arrives before the activation webhook, so a valid paid cycle is not silently marked processed before credits can be granted.

### Generation charges/refunds
- Render charge is atomic with the user's balance update.
- Each render credit transaction stores its `job_id`.
- Successful jobs keep their net `credits_spent` instead of resetting it to zero at completion.
- Partial refunds reduce both the user balance and the job's net spent amount.
- Failed/cancelled refundable productions return the appropriate credits.
- The workspace updates its displayed balance immediately from the render response and refreshes it after success/failure/cancellation.
- After checkout success, the workspace rechecks the account several times so provider-webhook delay does not leave a stale visible balance.

## Admin credit visibility
The Production page now shows for every production:
- net credits charged,
- current calculated quote,
- requested duration,
- quality,
- narration indicator.

Historical productions whose old job row was accidentally stored with `credits_spent=0` can still recover their net charged amount from the credit transaction ledger/reason history.

The Users page also distinguishes current balance, total credits granted/purchased, and credits used.

## Website favicon / tab logo
Website identity now comes only from the browser-tab icon declared in `<head>` (`icon`, `shortcut icon`, then Apple touch icon, then `/favicon.ico`). Header/body logos are not searched or substituted.

The favicon is rasterized into the local website icon reference when it loads successfully. If a valid favicon cannot be loaded, AiWebVideo leaves the brand mark empty and uses its neutral website UI icon instead of inventing a monogram or taking a different logo from the page.

## Verification performed in this package
- 172 TypeScript/TSX source and test files parsed successfully with TypeScript transpilation.
- Runtime credit contract checks passed for representative 8s, 32s, 64s, 144s, 4K, narration, video+photos, and photo-only cases.
- Static requested-feature checks passed for direct streamed downloads, attachment response, landing multi-upload/all gallery, job-linked credit ledger, admin credit UI, the server payment catalog, and strict browser-tab favicon behavior.

A full dependency-aware `pnpm run typecheck` should still run on the deployment server as part of the normal deploy script, because this sandbox does not have the project's installed workspace dependencies.
