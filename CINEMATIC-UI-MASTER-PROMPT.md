# AiWebVideo — Cinematic Space UI Master Prompt

You are redesigning the existing production website **AiWebVideo**. Do not rebuild the product from scratch and do not break working generation, auth, billing, credits, admin, project history, Firebase, APIs, SEO routes, or existing production logic. The goal is a **presentation/UI transformation only unless a UI requirement below explicitly needs wiring to existing data**.

## 1. North-star visual direction

Create a premium, cinematic, futuristic interface that feels like a product film rather than a normal SaaS landing page. The experience should feel as if the user is moving through space at high speed toward a creative AI command center.

Use:
- deep space black/navy/purple backgrounds;
- restrained nebula glows;
- star fields and perspective speed streaks;
- purple, magenta, electric blue, cyan and very selective warm orange;
- glass panels with crisp borders and subtle inner highlights;
- depth, parallax, soft bloom, orbital motion and layered lighting;
- large confident typography with gradient emphasis;
- smooth, premium micro-animation rather than noisy motion.

Do **not** make the site look like a gaming dashboard, crypto page, generic neon template, or overfilled sci-fi interface. The creator must stay usable and readable.

## 2. Landing hero

Rebuild the first viewport around this composition:

- Minimal navbar.
- Huge centered headline: **“Turn anything into a video.”**
- The second line may use the brand gradient.
- Short centered explanation underneath.
- The existing creator/chat/generation composer is the visual centerpiece.
- Feature modes belong **inside the creator**, not in the navbar.
- Keep all existing modes and logic:
  - Website Video
  - AI Video
  - Product Photos
  - Product Video
  - Talking Scene
  - Interior Design
  - Architecture
- Preserve existing model, duration, aspect ratio, quality, sound, attachment, ideas, product-link, architecture and validation logic.
- Make the creator look like a futuristic command deck: subtle gradient rim light, dark glass body, compact controls, strong hierarchy, no oversized settings.

## 3. Navbar

Remove the old center navigation row and all feature/navigation clutter from the navbar.

Keep:
- new AiWebVideo logo/wordmark on the left;
- a premium Pricing control with a clear pricing/money icon;
- signed-in credit balance;
- Admin shortcut only for admins;
- Workspace CTA;
- profile/user menu;
- signed-out Log in and Start creating actions.

The navbar should be transparent/glass over the hero and become slightly more solid on scroll.

## 4. Admin-controlled cinematic background media

The landing page already has admin-managed homepage media. Reuse that same data source; do not create a second CMS.

Requirements:
- Admin can upload multiple images and videos using the existing Homepage admin.
- Published admin media is reused as floating cinematic cards around the hero.
- These cards are background/decorative media and must never cover or block the creator.
- They should feel like they are floating in 3D space around the central creator.
- Images display directly.
- Uploaded MP4/WebM/etc. videos autoplay when visible, are muted, loop forever, use playsInline, have no controls, no fullscreen/PiP UI, and no play/video/image icon overlays.
- If autoplay is blocked, keep a poster/still frame; do not show a play button on these background cards.
- External embeds without a safe silent autoplay implementation should fall back to a poster rather than rendering controls.
- Keep the existing gallery/remix behavior elsewhere on the page.
- Optimize/lazy-load so background media does not make the page heavy.

## 5. Background motion

Build motion with CSS/DOM effects, not a giant baked image:
- layered star fields;
- perspective movement;
- speed trails converging toward the hero/horizon;
- subtle orbital glow;
- one or two soft planet/nebula forms;
- a luminous horizon near the bottom;
- slow floating media cards.

Respect `prefers-reduced-motion`: disable nonessential motion while keeping the composition attractive.

## 6. New logo

Replace the current mark with a more memorable premium AiWebVideo symbol:
- abstract orbital **A** / AI mark;
- no generic play button;
- should work at favicon size;
- brand gradient: cyan → violet → magenta → selective orange;
- dark-space core;
- crisp SVG;
- use the same symbol for the site logo and favicon.

Keep the “AiWebVideo” wordmark readable, with restrained gradient emphasis.

## 7. All public pages

Carry the same cinematic design language through Pricing, Features, How it works, About, FAQ, Examples, SEO landing pages and guides:
- shared space background;
- cinematic hero mesh;
- glass content surfaces;
- consistent border glow and depth;
- same typography and gradients;
- retain existing content, semantic hierarchy, links and SEO metadata;
- never make text harder to read for the sake of visuals.

Do not remove useful SEO copy. Presentation can change; meaning and routes remain.

## 8. Product/workspace/admin pages

Use the global cinematic visual foundation carefully, but prioritize utility:
- generation workspace stays readable and fast;
- admin stays dense and practical;
- profile/billing stays clear;
- editor remains functional;
- no decorative element can intercept clicks or overlap controls.

## 9. Responsive behavior

Desktop:
- hero can use multiple floating media cards around the central creator.

Tablet:
- reduce or hide cards that compete for space.

Phone:
- prioritize headline + creator;
- hide the orbital media wall if needed;
- no horizontal overflow;
- all controls remain touch friendly;
- no tiny text for primary interactions;
- no viewport jump during typing.

## 10. Performance and accessibility

- Lazy-load noncritical media.
- Only eagerly load the first one or two hero assets.
- Pause videos that leave the viewport.
- No video audio in background media.
- Use semantic labels for real controls.
- Decorative hero media is aria-hidden and pointer-events:none.
- Maintain visible focus states.
- Preserve keyboard usage.
- Never force motion when reduced-motion is enabled.

## 11. Scope lock

Do not change:
- generation provider logic;
- prompts/master generation instructions;
- credit prices or deduction;
- plans;
- payment behavior;
- authentication rules;
- Firebase flow;
- API routes;
- storage format;
- project history behavior;
- production progress logic.

Only reuse existing public/admin APIs required to display the cinematic media.

## 12. Definition of done

The implementation is done only when:
- the old navbar navigation clutter is gone;
- Pricing has a premium icon shortcut;
- feature selection lives in the creator;
- the landing hero visually matches the cinematic space direction;
- the creator is still fully functional;
- admin-uploaded images/videos appear in the hero orbit;
- uploaded background videos autoplay muted + loop without controls or play/media icons;
- the same admin media continues to power the existing gallery/examples;
- the new orbital logo + favicon are active;
- all public pages inherit the cinematic visual system;
- desktop, tablet and mobile layouts are clean;
- reduced-motion is respected;
- typecheck/build/tests pass;
- no backend production behavior changed.
