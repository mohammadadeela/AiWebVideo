# Route report

| Existing route | Action | Final canonical route |
|---|---|---|
| `/` | Title/description/H1 rewritten brand-first; architecture and product-link links added | `/` |
| `/product-page-to-video` | Kept URL; content rewritten for the real Product Link workflow (review/select photos, nothing auto-generates, blocked-shop fallback); create button now opens Product Video | `/product-page-to-video` |
| `/ai-architectural-visualization` | Kept URL; repurposed as the Architecture overview with the concept-only disclosure; create button now opens Architecture mode | `/ai-architectural-visualization` |
| (new) `/architecture-site-placement` | Added: map link / address / tap-the-exact-place workflow | `/architecture-site-placement` |
| `/about` | Entity description, how it is used, stated limitations | `/about` |
| `/talking-video-generator`, `/ai-interior-design-generator`, `/room-redesign-ai`, `/guides/interior-design-from-photos-and-plans` | Titles shortened (they were 72-81 characters and would be truncated); URLs unchanged | unchanged |
| `/studio/idea`, `/studio/product`, `/studio/scenario`, `/studio/interior` | Unchanged: existing 308 redirects to the matching generator pages | the generator pages |
| `/dashboard`, `/profile`, `/admin`, `/studio` | Added to robots.txt `Disallow` (they were already `noindex` and sign-in protected) | not indexed |

No URL was removed, so no new redirects were needed. `http://`, `www.` and `http://www.` canonicalization is **not configured in this repository** (`nginx.conf.example` has no such rule): it must be set on the host/CDN. See `INDEXING_CHECKLIST.md`.
