# AiWebVideo search indexing checklist

The application now includes canonical metadata, crawl directives, a dynamic
`sitemap.xml`, `robots.txt`, software structured data, descriptive public-page
metadata, and browser/mobile icons generated from the existing AiWebVideo logo.

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
5. Use URL Inspection for the homepage, run the live test, and request indexing.
6. Keep one preferred host (`www` or non-`www`) and redirect the other to it.

Google decides crawl and ranking timing, so deployment cannot promise immediate
placement. These steps make the site technically discoverable and give Google
the correct canonical URL and sitemap.
