# Indexing checklist

## Completed in code (verified by tests and a production build)
- [x] `robots.txt`: Googlebot, Bingbot and **OAI-SearchBot** (ChatGPT search) explicitly allowed on public pages; `/api/`, `/dashboard`, `/profile`, `/admin`, `/studio` disallowed; sitemap referenced. `GPTBot` (model training) is deliberately **not** mentioned, so that business decision is unchanged. robots.txt is not a privacy control: private pages are also sign-in protected and `noindex`.
- [x] `sitemap.xml`: all 31 canonical public pages (generated from the same registry as the pages). No `lastmod`: the pages have no per-page modified dates, and fake dates are worse than none.
- [x] Per-page unique title, description, canonical, Open Graph and Twitter tags, JSON-LD (`WebSite`, `Organization`, `SoftwareApplication`, `BreadcrumbList`, `FAQPage`); real HTML content is in the first response (not only after JavaScript).
- [x] No orphan pages: a test crawls from `/` through plain links and fails if any sitemap page is unreachable.
- [x] IndexNow: key file served at `/<INDEXNOW_KEY>.txt`; `pnpm seo:indexnow <urls>` notifies the changed URLs.
- [x] `Organization` has no invented `sameAs`, ratings, reviews or prices.

## Needs the owner (account or server access; not done)
1. **Server env:** set `INDEXNOW_KEY` (8-128 letters/digits/dashes), restart, confirm `https://aiwebvideo.com/<key>.txt` returns the key, then after each deploy run `INDEXNOW_KEY=<key> pnpm seo:indexnow <changed urls>` (only changed pages).
2. **Redirects (host/CDN):** make `http://aiwebvideo.com`, `http://www.aiwebvideo.com` and `https://www.aiwebvideo.com` 301 to `https://aiwebvideo.com/`. Not in this repo.
3. **Crawler access:** in Cloudflare/WAF/rate limiting, confirm verified Googlebot, Bingbot and OAI-SearchBot get HTTP 200 HTML (no 403, CAPTCHA or JS challenge) on public pages. Test with a real fetch from Search Console URL Inspection and Bing's URL inspection.
4. **Google Search Console:** verify `aiwebvideo.com` (a real verification token is needed; none was invented); submit `sitemap.xml`; URL-inspect `/`, `/product-page-to-video`, `/ai-architectural-visualization`, `/architecture-site-placement` and each feature page, then request indexing; review canonical selection, Page indexing and Core Web Vitals; watch the query `AiWebVideo`.
5. **Bing Webmaster Tools:** add and verify the site, submit the sitemap, enable IndexNow, and use the AI Performance / citation reports to see whether Copilot cites AiWebVideo (cited pages, grounding queries, citation share) next to normal impressions.
6. **Core Web Vitals:** not measured here. Run PageSpeed Insights / CrUX on `/` and each feature page on mobile (targets: LCP ≤ 2.5 s, INP < 200 ms, CLS < 0.1).
7. **Rich Results Test:** run it on `/` and one feature page to confirm zero structured-data errors (parseability is tested, Google's validator was not run).
8. **Analytics:** confirm organic landing page, CTA click, signup and first-generation events exist (not changed here).
