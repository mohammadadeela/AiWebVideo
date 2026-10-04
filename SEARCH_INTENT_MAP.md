# AiWebVideo search intent map

One authoritative page per search intent. Source of truth for titles, descriptions and copy: `artifacts/api-server/src/lib/seo.ts` (`PUBLIC_PAGES`); the React pages mirror it and a test (`seo-search-architecture.test.ts`) fails if they drift.

**Keyword basis:** the target queries below come from the master prompt's own lists and from the existing pages. No live keyword-volume or SERP research was run (no search tooling was available when this was written), so these clusters are *hypotheses to validate in Search Console*, not measured demand.

| Target URL (canonical) | Search intent | Primary query | Secondary queries | CTA (create mode) |
|---|---|---|---|---|
| `/` | Brand + category | AiWebVideo | AI creative platform, AI video platform, website to video AI | `/?create=website#generate` |
| `/website-video-generator` | Turn a business website into a marketing video | website video generator | turn website into video, website promo video, website to video AI | `?create=website` |
| `/url-to-video` | Same, phrased by input pattern | URL to video | website URL to video, link to video | `?create=website` |
| `/saas-demo-video-generator` | SaaS launch / demo video | SaaS demo video generator | SaaS website video, product launch video | `?create=website` |
| `/product-page-to-video` | **Product Link**: product URL to product photos or video | product link to video | product URL to video, product page to ad, ecommerce URL to video | `?create=product-video` |
| `/ai-video-generator` | Original AI video from a prompt | AI video generator | text to video AI, prompt to video | `?create=video` |
| `/product-photo-generator` | Product photos from real product photos | AI product photo generator | AI product photography, ecommerce product images | `?create=photo` |
| `/product-video-generator` | Product video from real product photos | AI product video generator | product image to video, product ad generator | `?create=product-video` |
| `/talking-video-generator` | Dialogue / scenario video | AI talking video generator | talking scene generator, AI dialogue video | `?create=scenario` |
| `/ai-interior-design-generator` | Interior design images or tour | AI interior design generator | AI room design, interior redesign AI | `?create=interior` |
| `/room-redesign-ai` | Redesign one room from a photo | AI room redesign | room makeover AI | `?create=interior` |
| `/interior-design-walkthrough-video` | Interior walkthrough video | AI interior walkthrough video | | `?create=interior` |
| `/real-estate-walkthrough-video` | Property presentation video | real estate walkthrough video AI | | `?create=interior` |
| `/3d-house-walkthrough` | House walkthrough concept | 3D house walkthrough AI | | `?create=interior` |
| `/floor-plan-to-3d` | Floor plan to 3D-style concepts | floor plan to 3D AI | | `?create=interior` |
| `/ai-architectural-visualization` | **Architecture** overview (concept visuals) | AI architecture generator | AI architectural visualization, facade redesign, villa design AI | `?create=architecture` |
| `/architecture-site-placement` | **Building on a real site** (map link / address / tap the exact place) | visualize building on a site | building on land visualization, house on lot AI, map link architecture | `?create=architecture` |
| `/guides/*` (6) | Informational, link back to the matching generator | how to ... | | per guide |
| `/examples`, `/features`, `/how-it-works`, `/pricing`, `/about`, `/faq` | Browse / trust / conversion | | | |

## Cannibalization decisions
- **Product Link:** no second `/product-link-to-...` URL was created. The existing `/product-page-to-video` already owned "product page to video"; it was rewritten for the real Product Link workflow so one page owns the cluster.
- **`/url-to-video` vs `/website-video-generator`:** these overlap. They were kept (existing URLs, different framing: input pattern vs business website) to protect existing equity. **Monitor in Search Console**; if both rank for the same queries, consolidate the weaker with a 301.
- **`/ai-interior-design-generator` vs `/room-redesign-ai`:** distinct enough (whole interior workflow vs one room from a photo); monitor.
- **Architecture sub-intents** (facade redesign, villa, commercial building) are sections inside `/ai-architectural-visualization`, not separate pages: there is not yet enough unique content or real examples to justify more URLs.

## Not created on purpose
Use-case pages (ecommerce, SaaS, architects, retail) and programmatic industry pages: they need real examples and original content first. See `SEO_AUTHORITY_PLAN.md`.
