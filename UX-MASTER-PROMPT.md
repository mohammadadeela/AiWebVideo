# AiWebVideo UX Master Prompt

Use this brief for every future frontend UX change to AiWebVideo.

You are improving an existing production AI video product. The core promise is **website URL → AI video**, with additional creation modes for AI Video, Product Photos, Product Video, and Talking Scene.

## Hard constraints
- Do not change backend behavior, generation flow, API contracts, auth, payments, plans, credit prices, credit deduction, or production settings logic unless explicitly requested.
- Do not change the existing brand colors, visual identity, or overall dark gradient style.
- Do not use CSS/browser `zoom`, page-level `scale()`, or other tricks that make the site look artificially zoomed in or out.
- Keep all existing creation modes and functional controls available.

## UX hierarchy
1. The user must understand the primary action within 3 seconds.
2. On landing, put creation before explanation: **URL → direction → continue**.
3. Make required inputs visually unmistakable. Inputs must have stronger contrast than surrounding cards, visible labels, readable placeholders, clear hover/focus states, and comfortable text size.
4. Use progressive disclosure. Advanced choices (style, ideas, references, smart settings) stay compact until requested.
5. Only one optional panel may be open at a time. Opening Style closes Ideas and Smart Settings; opening Ideas closes Style and Smart Settings; opening Smart Settings closes the others.
6. Never repeat the same explanation in a hero, card, side panel, and footer. If the interface already demonstrates a step, do not explain it again nearby.
7. One primary CTA per creator state. Secondary controls must never visually compete with the CTA.
8. Avoid tiny desktop UI. Important labels and controls should normally be 11–16px; reserve 8–10px text for metadata only.
9. Preserve normal page scale. Use responsive max-width/layout changes instead of shrinking the whole interface.
10. Landing and Workspace must share the same mental model and visual language. A user who starts on landing should immediately recognize the same creator in Workspace.

## Landing page
- Keep the hero short.
- Show the creator in the first viewport on normal laptop/desktop sizes.
- Make the creator wide enough to feel like the main product, not a small demo card.
- Website URL and direction/prompt are the dominant visual elements.
- Keep creation modes visible as tabs.
- Keep examples after the creator.
- Remove duplicated feature sections when the same modes are already visible in the creator/navigation.
- Keep pricing concise and link to the full pricing page.

## Workspace
- A new Workspace session should open directly on the creator with no duplicate shortcut grid above it.
- Do not force a large minimum height on an empty/new chat.
- Use the streamlined initial creator UI while preserving exact credit pricing and production logic.
- Once a job begins, preserve the full conversation, live progress, captures, generation state, and result experience.

## Inputs
- URL field: high-contrast dark surface, mint-accent border, clear globe/source icon, readable placeholder.
- Prompt/direction field: high-contrast dark surface, violet-accent border, readable placeholder, minimum comfortable height.
- Focus must be obvious without changing brand colors.
- Pressing Enter in the URL field should move focus to the direction field, not accidentally submit an incomplete form.

## Responsive behavior
- Desktop: wide creator, normal visual scale, minimal wasted side space.
- Tablet/mobile: tabs and optional controls may scroll/wrap; required inputs remain full-width; CTA remains easy to tap.
- Avoid nested vertical scrolling for the initial creator unless advanced settings are intentionally open.

## Final check before shipping
- No duplicated primary messaging.
- No panel-opening bug.
- URL and prompt stand out immediately.
- No page zoom/scale hacks.
- Landing creator and Workspace creator feel consistent.
- Credits/plans/generation behavior unchanged.
- TypeScript/TSX syntax passes.
