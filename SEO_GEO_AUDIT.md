# SEO / GEO audit

Method: every line says how it was established. There are **no numeric scores**: a "100/100" would need Lighthouse, Search Console and a live crawl, none of which were available. Statuses: **Verified** (automated test or build in this repo), **By code review**, **Not measured**.

| Area | Status | Evidence | Open gaps |
|---|---|---|---|
| Crawlability | Verified | `robots.txt` generated and tested: Googlebot, Bingbot, OAI-SearchBot allowed; private areas disallowed; sitemap referenced | Live WAF/CDN behaviour for crawlers is not testable from the repo |
| Indexability | Verified | 31 public pages `index, follow`; private pages `noindex` and out of the sitemap (tests) | Index status is only knowable in Search Console |
| Technical SEO | Verified | One H1, one canonical, unique title and description on every page (test, fails on duplicates or bad lengths). The test found and fixed 4 titles of 72-81 characters and a duplicated description | www / http to https canonical redirects are not in the repo (host/CDN) |
| Metadata | Verified | Open Graph and Twitter titles/descriptions set per page | Pages other than `/examples` share the square logo as `og:image`; no per-page social images |
| Structured data | Verified parseable; By code review for correctness | `WebSite`, `Organization`, `SoftwareApplication`, `BreadcrumbList`, `FAQPage`; no fake ratings, reviews, prices or `sameAs`; FAQ answers match visible text (test) | Google's Rich Results Test not run; no `VideoObject` (few real public videos); no Article schema on guides |
| Internal links | Verified | Crawl test: every sitemap page reachable from `/` through plain `<a href>` | Footer lists are curated; no hub page for guides |
| Content | By code review | New and rewritten pages state workflow, inputs, outputs, limits and FAQ; architecture pages carry the concept-only notice; Product Link states that some shops block reading | **Thin spots:** no architecture guide, no use-case pages, no real examples or original data yet. **Keyword research and competitor analysis were not performed** |
| Brand / entity | Verified | Homepage title starts with "AiWebVideo"; one spelling enforced (test); `WebSite`/`Organization` entity; `/about` states what the product is and its limits | No verified `sameAs` profiles yet; no independent mentions (see authority plan) |
| GEO (AI search) | By code review | Answer-first intros, explicit definitions, step-by-step sections, limitations, `llms.txt` and `ai.txt` updated; OAI-SearchBot allowed | Whether any AI system cites the site is only measurable in Bing AI Performance and referrals |
| Performance | **Not measured** | Not run | Core Web Vitals (LCP/INP/CLS) need PageSpeed/CrUX on the live site |
| Mobile | **Not measured** here | The site is responsive by design | Needs a device check of the new pages |
| Security / privacy | By code review | Private routes still sign-in protected and `noindex`; IndexNow key comes from env, validated, and only that exact filename is served; no secrets in HTML, sitemap or robots | robots.txt is not a privacy control (said so in the file's comment) |

## Product accuracy of the new copy
- Product Link text matches the implemented behaviour: reads accessible photos and details, you select, nothing generates until you confirm, blocked shops fall back to upload. No claim that every shop works.
- Street-level imagery is described as "where offered and available": it is currently **switched off on the production server** (needs `GOOGLE_MAPS_API_KEY` and `ARCHITECTURE_MAPS_IMAGERY=1`), so the pages do not promise it.
- Architecture is described as concept visualization only; Google marks are acknowledged as Google's.

## Not done from the master prompt
Live keyword research; competitor gap analysis; use-case pages; a guides hub; example pages with real public generations; `VideoObject`; per-page social images; analytics changes; Core Web Vitals work. They need real data, real content or live access, and are listed here rather than faked.
