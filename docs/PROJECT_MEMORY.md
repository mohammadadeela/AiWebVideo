# Current redesign state — 2026-10-01

Read `docs/DESIGN.md`, `docs/REQUIREMENTS.md`, `docs/WORK_LOG.md` and `README-DEPLOY.md` when continuing this work.

- `main` already contained the requested cinematic rebrand in 22768b4, followed by unrelated purchase/auth fixes in 8ef2e80. This follow-up preserves both.
- Homepage media is maintained under Admin → Homepage. The first five entries form the hero orbit; Use in background moves an upload to the front, then Save persists the order through the existing marketing API. No second upload store or migration.
- `publishGallery` replaces the browser's shared gallery cache with the saved response and notifies mounted views; returning Home in the same tab reflects updates without a hard refresh.
- Keep backgrounds behind interactive content. Global child position/z-index rules caused a broken sticky navbar; mobile body overflow must remain `clip`, not `hidden`, to preserve viewport sticky positioning.
- Shared `.cinematic-page` styling extends the art direction to account/admin/Studio/editor screens; opaque inputs and media canvases remain readable.
- Existing business rules, checkout/auth fixes, generation settings, live progress and scroll behavior are preserved.
- GitHub main is the requested delivery target. Hostinger deployment is separate and follows the repository's existing deployment documentation.
