# AiWebVideo search visibility checklist

The application includes server-rendered metadata for every public route,
canonical URLs, crawl directives, `sitemap.xml`, `robots.txt`, WebSite,
Organization and SoftwareApplication structured data, descriptive public-page
content, and browser/mobile icons generated from the existing AiWebVideo logo.

Search engines still need the production domain and a crawl request before a
new or previously undiscoverable site can appear. Complete these deployment
steps after publishing:

1. Set both `NEXT_PUBLIC_APP_URL` and `ALLOWED_ORIGIN` to the final HTTPS domain
   (for example, `https://aiwebvideo.com`) before building and restarting.
2. Open `/robots.txt` and `/sitemap.xml` on the public domain and confirm they
   return HTTP 200 and contain the same final HTTPS domain.
3. Add the domain property in Google Search Console and complete DNS ownership
   verification.
4. Submit `https://YOUR-DOMAIN/sitemap.xml` in Search Console.
5. Use URL Inspection for the homepage, `/how-it-works`, `/studio`, and the two
   generation pages. Run the live test and request indexing for each important URL.
6. Keep one preferred host. This project treats the value in
   `NEXT_PUBLIC_APP_URL` as canonical and permanently redirects the exact `www`
   or non-`www` alternate hostname to it while preserving the request method.
7. In Search Console, monitor **Page indexing** for excluded/error URLs and
   **Performance** for brand queries (`AiWebVideo`, `AI Web Video`) and product
   queries (`AI website video generator`, `website to video generator`).
8. Keep building legitimate discovery signals: link to the product from the
   company's real social profiles, launch pages, partner sites, and useful
   articles or examples. Do not buy links or publish keyword-stuffed pages.

## About the larger result with links under it

The extra links shown under some Google results are called sitelinks. Google
generates them automatically. Clear navigation, unique page titles, descriptive
headings, internal links, and a clean sitemap make the site easier to understand,
but there is no setting that can force sitelinks or a first-place ranking.

Google decides crawl, indexing, search appearance, and ranking timing. A crawl
request can take days to weeks and still does not guarantee inclusion or a
particular position. These steps remove the main technical obstacles and make
the product topic explicit: website-to-video first, with AI video and AI photo
generation as secondary tools.
