# Linkreel growth plan

How the redesigned product earns money, what the interface already does to support that, and the pricing
decisions that are still yours to make. Figures come from the live price list (`artifacts/aiwebvideo/src/lib/pricing.ts`,
`artifacts/api-server/src/lib/growth-offers.ts`) as of November 2026.

## The funnel

| Step | What the visitor does | What the product does |
| --- | --- | --- |
| 1. Land | Arrives from search, an AI answer or a shared video | One box: "Paste a link. Get a video." No feature to choose first |
| 2. Try | Pastes a link without an account | Reads the site for free and shows what it found. Value before sign-up |
| 3. Sign up | Creates an account to continue | 25 free credits, no card. The request they started is kept and resumes |
| 4. First result | Generates | Exact credit cost is shown on the send button before anything is charged |
| 5. Run low | Balance drops below the price of one image set (20 credits) | Credit card in the sidebar and the header pill turn warm and say "Running low" |
| 6. Run out | Tries to generate without enough credits | The request is parked, not lost. A purchase window opens with the cheapest option that covers exactly this creation marked first |
| 7. Buy | Pays by card or PayPal inside the page | Credits arrive and the parked request starts by itself |
| 8. Return | Comes back | History in the sidebar, "make another version" on every result |

## What a credit buys today

| Creation | Credits |
| --- | --- |
| Set of 4 images (Graphic 1 or 2) | 20 |
| 8-second video, Cinema 1 | 40 |
| 8-second video, Cinema 2 (the default) | 80 |
| 8-second video, Cinema Pro | 160 |

| Product | Price | Credits | Price per credit |
| --- | --- | --- | --- |
| Starter pack | $4.99 | 70 | 7.1¢ |
| Creator pack | $14.99 | 265 | 5.7¢ |
| Studio pack | $24.99 | 460 | 5.4¢ |
| Creator plan, monthly | $39 | 750 | 5.2¢ |
| Pro plan, monthly | $99 | 2,000 | 5.0¢ |
| Agency plan, monthly | $249 | 5,000 | 5.0¢ |

## Three pricing gaps worth fixing

These are decisions about money, so nothing was changed in code. Each one is a small edit once you decide.

1. **The free credits cannot make a video.** New accounts get 25 credits; the cheapest video costs 40 and the
   default one costs 80. The headline promises a video, so the first session ends at a paywall before the visitor
   has seen one. Options: raise the starter grant to 40 (one watermarked Cinema 1 video), or keep 25 and make
   Cinema 1 the default model for accounts that have never paid. The server already refuses any welcome discount
   that would drop below twice the provider cost, so the first option's cost is bounded: 3 extra internal credits
   per sign-up.
2. **The $4.99 pack does not cover the default video.** It grants 70 credits and the default 8-second video costs
   80. A first-time buyer pays and still cannot generate. Raise the pack to 80 credits or price it at $5.99.
3. **The welcome discount lasts five minutes.** `WELCOME_OFFER_MS` is 5 minutes from first sign-in, which ends
   before most people finish their first creation. 24 hours, or "until your first purchase, for 48 hours", gives
   the countdown time to work at the moment it matters: when the free credits run out.

## Growth loops to add next

Ordered by expected return for the effort. None of these are built yet.

| Idea | Why it pays | Guard against abuse |
| --- | --- | --- |
| "Made with Linkreel" end card on free videos, removed on any paid plan | Every shared free video is an ad, and removing it is a reason to pay | Already half there: the server has a watermark setting |
| Give 40, get 40 referral link | Each paying user brings the next at the cost of one cheap video | Credit the referrer only after the friend's first purchase |
| Public share page for each result (`/v/abc`) with a "Make one from your link" button | Turns results into landing pages that rank and convert | Private by default, the owner chooses to publish |
| Email when a video finishes and at 3 days idle with credits left | Brings back the people who left during the wait | One-click unsubscribe |
| Annual plans at two months free | Cash up front, lower churn | Uses the existing subscription flow |

## Search and AI answers

What is in place after this release:

- Every public page is rendered on the server with its own title, description, one H1, body copy and FAQ, so
  search engines and AI crawlers read real text, not an empty app shell.
- Structured data on every page: WebSite, Organization, SoftwareApplication (with a free offer), FAQPage and
  breadcrumbs. The former name AiWebVideo is declared as an alternate name so existing searches still match.
- `robots.txt` names the crawlers behind search and AI answers (Google, Bing, ChatGPT search, Perplexity,
  Claude, Apple, DuckDuckGo). `llms.txt` and `ai.txt` give answer engines a short factual summary with prices
  and links.
- The footer links every feature and use-case page from every page.

What only you can do:

- **Pick the domain.** The interface says Linkreel but the site still lives at aiwebvideo.com. Check that the
  name and a matching domain are free before you announce it, then point the new domain at the server and
  redirect the old one page-for-page with 301s. Until then the old domain keeps working and keeps its ranking.
- Submit the sitemap in Google Search Console and Bing Webmaster Tools, and set `INDEXNOW_KEY` so new pages are
  pushed to Bing (the script is `pnpm run seo:indexnow`).
- Publish examples from Admin. The home page gallery and the Examples page are empty until you do, and real
  results are the strongest thing on the page.
- Earn links: list the product on Product Hunt, G2, Futurepedia and There's An AI For That, and post real
  before-and-after results. Rankings for competitive terms depend on other sites linking to you; no code change
  can substitute for that.

## Still named AiWebVideo on purpose

Renaming these would break something, so they wait until the domain and the PayPal account are renamed:

- PayPal product and plan names (they are how existing subscriptions are found).
- The watermark default and the page-reader's user agent.
- Browser storage keys and cookies (renaming them would sign everyone out and lose drafts).
- The support address `aiwebvideo0@gmail.com`.
