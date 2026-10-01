# Cinematic AiWebVideo

Approved direction: deep space, purple/blue nebula light, moving stars and speed streaks, floating administrator-uploaded media, and a luminous creator surface. Preserve the existing mint/violet/pink accents and orbital logo from commit `22768b4`.

- Primary action: the creator. Its seven feature tabs stay inside the form; the public navbar has the logo, Pricing, and account actions.
- Shared treatment: `cinematic-theme.css` defines the backdrop, glass creator, typography treatment, orbital artwork and explicit `.cinematic-page` shells for account/admin/workspace/editor pages. Inputs and video result canvases retain opaque, readable surfaces.
- Layers: the fixed decorative backdrop sits at -1 inside the isolated site root. Do not impose position/z-index on all page children: it breaks sticky headers and overlays.
- Media: the first five published Homepage entries form the orbit. Admin can move an entry to the front before Save. Phones/tablets show two subdued corner images; laptops show four; wide desktops show five. No player controls, play icons or media-type icons on this decorative layer.
- Motion: uploaded file videos are muted, inline and loop while visible; background-tab videos pause. Reduced-motion mode freezes the space effects and decorative videos. Embedded YouTube/Vimeo links use a supplied poster instead of an iframe.
- Brand: maintainable orbital SVG mark in `public/logo.svg` and `public/favicon.svg`; Wordmark is used across public and account navigation.
- Mobile: Pricing retains an accessible name, Log in stays visible, and the redundant Start creating navbar action is hidden below 640px. The creator stays available in the page.
