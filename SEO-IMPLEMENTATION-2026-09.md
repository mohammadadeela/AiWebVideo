# AiWebVideo SEO implementation — September 2026

This build focuses AiWebVideo on the website-to-video search category while keeping Workspace, generation, billing, admin, and database behavior unchanged.

## Added public search pages
- `/url-to-video` — primary URL-to-video search page
- `/website-video-generator` — whole-website marketing video intent
- `/saas-demo-video-generator` — SaaS/product-launch intent
- `/product-page-to-video` — ecommerce/product campaign intent
- `/examples` — campaign examples and use cases
- `/guides/turn-website-into-video`
- `/guides/saas-product-demo-video`
- `/guides/product-page-video-ads`

## Technical SEO changes
- Route-specific server-rendered title, description, robots, canonical, Open Graph, and Twitter metadata.
- Crawlable initial HTML copy for public routes before React executes.
- Route-specific JSON-LD with WebSite, Organization, SoftwareApplication, WebPage, BreadcrumbList, and FAQPage where applicable.
- Client-side metadata and JSON-LD updates during SPA navigation.
- Updated sitemap and `llms.txt`.
- Expanded internal links from homepage, navigation, footer, landing pages, and guides.
- Private Workspace/Profile/Admin pages remain `noindex` and are excluded from the sitemap.
- Removed hard-coded pricing AggregateOffer schema to avoid stale or unsupported price claims.

## After deployment — manual Google steps
1. Open Google Search Console for `https://aiwebvideo.com/`.
2. Re-submit `https://aiwebvideo.com/sitemap.xml`.
3. URL Inspect and request indexing for the homepage and the four new commercial pages first.
4. Check rendered HTML/indexability for each new page.
5. Monitor Performance → Queries for impressions and average position, especially URL-to-video and website-video terms.
6. Earn real relevant links/reviews; technical SEO alone cannot guarantee a top ranking.

Do not create dozens of near-duplicate keyword pages. Expand these pages only when there is real new content, examples, comparisons, or use-case evidence to add.
