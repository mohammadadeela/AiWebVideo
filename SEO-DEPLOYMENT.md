# AiWebVideo search and AI answer visibility

The public site covers Website Video, AI Video, Product Photos, Product Video,
Talking Video, Interior Design images and walkthroughs, and related property
workflows. The server renders the title, canonical, body text, internal links,
and structured data for every public page before client JavaScript starts.
The public feature directory is `/features`.

## After deploying the new build

1. Confirm `NEXT_PUBLIC_APP_URL=https://aiwebvideo.com` and the intended
   `ALLOWED_ORIGIN` in the deployment environment. Rebuild the frontend and
   backend, then restart the existing app process through the normal deploy
   procedure. Do not run database migrations just to publish SEO copy.
2. Check `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/features`,
   `/product-photo-generator`, `/product-video-generator`, and
   `/ai-interior-design-generator` over HTTPS. The sitemap should have 30
   public URLs. `/studio` and `/studio/project/:projectId` are private,
   non-indexed editor routes. The old `/studio/idea`, `/studio/product`,
   `/studio/scenario`, and `/studio/interior` mode URLs should redirect to
   their live feature pages rather than render client-side 404s.
3. Verify a **domain property** in Google Search Console. Submit the sitemap
   and inspect important URLs, especially the new feature and interior pages.
   Check *Page indexing*, *Performance*, *Video pages*, and *Core Web Vitals*.
   DNS ownership verification and historical data require the domain owner.
4. Verify the domain in Bing Webmaster Tools, submit the same sitemap, and
   inspect crawl/index status. IndexNow is optional for new or changed pages;
   configure its key and notifications only after verifying the property.
5. Review server/CDN logs for Googlebot, Bingbot, OAI-SearchBot, and
   PerplexityBot. The site's `robots.txt` permits public pages, but a firewall
   or CDN could still block a crawler. Private `/api/` paths remain excluded.
6. Publish real, permission-cleared example videos and product imagery through
   the marketing showcase with descriptive captions and stable poster URLs.
   Public examples are included in initial HTML on `/examples` when configured.
   Do not expose private customer projects as public examples. Individual
   public watch pages and accurate dates would be required for more complete
   video search markup; add those only when genuine media metadata exists.
7. Measure branded and non-branded impressions, indexed pages, citations,
   image/video visibility, and visits that lead to signup or purchase. Improve
   the pages that get impressions but few clicks with more real demonstrations,
   accurate comparisons, useful instructions, and earned independent mentions.

Google says ordinary search eligibility and helpful public content underpin its
AI Search features; `llms.txt` does not give a special Google ranking boost.
`llms.txt` and `ai.txt` are human-readable directories of the same public
features. Neither files, schema, nor sitemap submission can guarantee a rank,
an AI citation, or an indexing date.
