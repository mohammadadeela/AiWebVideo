import { ArrowRight, CheckCircle2, Film, Globe2, Layers3, Link2, Megaphone, PackageOpen, ScanSearch, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { Button } from "@/components/ui/app-button";
import { useSeo } from "@/lib/useSeo";

type SeoLanding = {
  path: string;
  eyebrow: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  primaryLabel: string;
  highlights: string[];
  problemTitle: string;
  problemBody: string;
  workflow: Array<[string, string]>;
  benefits: Array<[string, string]>;
  useCases: Array<[string, string]>;
  faq: Array<[string, string]>;
  related: Array<[string, string, string]>;
};

const pages: Record<string, SeoLanding> = {
  urlToVideo: {
    path: "/url-to-video",
    eyebrow: "URL to video AI",
    title: "Turn any website URL into an AI video",
    seoTitle: "URL to Video AI Generator — Turn a Website Into Video",
    description:
      "Paste a public website URL and turn it into a brand-aware AI marketing video. AiWebVideo reads the page, plans the story, generates the film, and keeps production in one workspace.",
    intro:
      "Paste a public URL, describe what you want to promote, and let AiWebVideo use the real page as creative context for a finished campaign video.",
    primaryLabel: "Turn a URL into video",
    highlights: ["Public URL as source", "Brand-aware creative direction", "AI-generated final film", "Landscape, portrait and square"],
    problemTitle: "A link already contains the raw material for a campaign",
    problemBody:
      "Product pages, SaaS homepages, launch pages and business websites already contain positioning, visuals, calls to action and brand cues. AiWebVideo turns that source into a production brief instead of making you rebuild it manually in a timeline editor.",
    workflow: [
      ["Paste the URL", "Use a public website, landing page, product page or homepage as the source."],
      ["Add the campaign goal", "Tell the AI what to promote, who the audience is, and what action the video should drive."],
      ["AI studies the page", "The workflow captures useful pages and visible brand context so the production is grounded in the real business."],
      ["AI directs the video", "Story, shots, pacing, duration, audio direction and format are planned around the campaign goal."],
      ["Generate and deliver", "Follow the production in the same chat, then review and download the finished media."],
    ],
    benefits: [
      ["Less manual setup", "Start from the page you already have instead of copying every headline and image into a video editor."],
      ["Closer to the brand", "The website becomes creative grounding for colors, products, interface, messaging and calls to action."],
      ["Built for campaigns", "Use the result for launches, social posts, product promotion, sales outreach and website marketing."],
      ["One production workspace", "Keep the brief, captures, plan, live progress and final media together rather than jumping between tools."],
    ],
    useCases: [
      ["SaaS landing pages", "Turn product positioning and interface context into a concise launch or demo-style campaign."],
      ["E-commerce product pages", "Use product benefits, merchandising and brand cues to direct a product-focused film."],
      ["Business websites", "Create a short promotional story for services, offers, locations and calls to action."],
      ["Launch pages", "Convert a new feature or campaign page into video content for social and paid distribution."],
    ],
    faq: [
      ["What is a URL to video generator?", "It is a workflow that uses a webpage link as source context for creating a video. AiWebVideo reads the public website, combines it with your goal, plans the campaign and generates the video."],
      ["What URLs work best?", "Public pages with clear products, services, features, visuals and calls to action work best. Private pages or pages that require login should not be submitted."],
      ["Is the result only a slideshow of screenshots?", "No. Website captures are used as creative grounding. The paid generation flow creates AI-generated video scenes for the campaign rather than presenting a simple screenshot slideshow as the final film."],
      ["Can I choose vertical or square video?", "Yes. The creator supports common landscape, portrait and square formats, with smart defaults available when you do not want to configure every setting."],
    ],
    related: [
      ["Website Video Generator", "/website-video-generator", "Build a campaign from a broader website story."],
      ["SaaS Demo Video", "/saas-demo-video-generator", "Create product and launch stories for software."],
      ["Product Page to Video", "/product-page-to-video", "Turn ecommerce and product pages into campaign video."],
    ],
  },
  websiteVideoGenerator: {
    path: "/website-video-generator",
    eyebrow: "Website video generator",
    title: "Create a marketing video from your website",
    seoTitle: "AI Website Video Generator — Website to Marketing Video",
    description:
      "Create an AI marketing video from your website. AiWebVideo studies useful pages and brand context, builds the campaign direction, and generates the final film in one workspace.",
    intro:
      "Use the website as the source of truth for the business—not just a single block of copied text—and turn it into campaign-ready video.",
    primaryLabel: "Create from my website",
    highlights: ["Website-first workflow", "Multi-page brand context", "Campaign planning", "Saved production history"],
    problemTitle: "Your website explains the business better than a blank prompt",
    problemBody:
      "A homepage rarely tells the whole story. Features, products, pricing, use cases and calls to action often live across multiple pages. The website workflow is designed to use the useful public context before the creative plan is produced.",
    workflow: [
      ["Start with the website", "Paste the public site you want AiWebVideo to understand."],
      ["Capture useful context", "The workflow gathers relevant visible pages and avoids treating every page as equally important."],
      ["Choose the campaign direction", "Describe the offer, launch, product or business story you want the video to communicate."],
      ["Generate a coherent plan", "AI builds the story beats, visual direction, duration and audio choices around that goal."],
      ["Produce the final master", "Generation progress stays visible in the project until the result is ready to review and download."],
    ],
    benefits: [
      ["More context than a prompt", "The website can ground the production in real products, interface, brand language and positioning."],
      ["Fewer production decisions", "Smart defaults keep duration, format and creative decisions from becoming a long setup form."],
      ["Useful for repeat campaigns", "Return to the workspace and create another angle from the same business context."],
      ["Clear project history", "Active and completed productions stay attached to the signed-in workspace."],
    ],
    useCases: [
      ["Launch campaign", "Turn a new website or product launch into a short branded film."],
      ["Feature promotion", "Focus the story on one feature or benefit even when the source website contains many."],
      ["Brand introduction", "Create an overview film that communicates what the business does and why it matters."],
      ["Social campaign", "Generate a format suited to channels where vertical or square video is more useful."],
    ],
    faq: [
      ["How is this different from URL to video?", "URL to video is the broad input pattern. The website-video workflow is designed specifically for turning a business website and its useful public pages into a campaign story."],
      ["Does AiWebVideo need access to private pages?", "No. Use public pages only. Do not submit private dashboards, customer data, or pages you are not authorized to use."],
      ["Can I tell it what part of the website matters?", "Yes. Your prompt can focus the production on a product, offer, feature, audience or call to action."],
      ["Can I return while generation is running?", "Yes. Signed-in project history is designed to keep active production state available when you leave and return to the workspace."],
    ],
    related: [
      ["URL to Video", "/url-to-video", "Use any public webpage as video source context."],
      ["Examples", "/examples", "See the types of campaign starts supported by the creator."],
      ["How it works", "/how-it-works", "Walk through the production flow step by step."],
    ],
  },
  saasDemo: {
    path: "/saas-demo-video-generator",
    eyebrow: "SaaS video generator",
    title: "Turn your SaaS website into a product story",
    seoTitle: "SaaS Demo Video Generator — Create Product Videos With AI",
    description:
      "Create AI SaaS demo and launch videos from your product website. Ground the story in real product positioning and interface context, then generate the campaign in one workspace.",
    intro:
      "Use your SaaS homepage, feature pages and launch messaging as context for a product-focused video without starting from a blank script.",
    primaryLabel: "Create a SaaS video",
    highlights: ["Product positioning", "Feature-page context", "Launch storytelling", "Social-ready formats"],
    problemTitle: "Software needs a story, not a screen-recording dump",
    problemBody:
      "A useful SaaS campaign has to decide what the viewer should understand first, which feature matters, and what action should follow. AiWebVideo lets the website provide product context while the prompt defines the campaign angle.",
    workflow: [
      ["Paste the SaaS website", "Start with the public product website or launch page."],
      ["Choose the audience", "Describe who the video is for: prospects, existing users, teams, founders or a specific industry."],
      ["Choose the product angle", "Focus on a launch, workflow, feature, pain point, differentiator or call to action."],
      ["AI builds the narrative", "The plan turns product context into a concise sequence rather than showing every feature at once."],
      ["Generate campaign media", "Create the final video and keep the result in the same project conversation."],
    ],
    benefits: [
      ["Launch faster", "Create a campaign direction from the site you already prepared for the release."],
      ["Keep messaging aligned", "Ground the video in the same product positioning customers see on the website."],
      ["Create multiple angles", "Use different prompts for feature launches, paid campaigns, announcements and sales outreach."],
      ["Avoid editing timelines", "Direct the result with intent and language instead of managing a traditional track-based editor."],
    ],
    useCases: [
      ["Feature launch", "Create a focused story around one new product capability."],
      ["Homepage overview", "Introduce the problem, product value and CTA in a concise campaign."],
      ["Sales outreach", "Produce a short product story that can support outbound or follow-up communication."],
      ["Social announcement", "Create a portrait or square launch asset from the same product context."],
    ],
    faq: [
      ["Is this a screen recorder?", "No. The website can provide visual and product context, but the video workflow is built around AI creative direction and generated campaign media rather than simply recording a cursor moving through the site."],
      ["Can I focus on one SaaS feature?", "Yes. Tell the creator which feature, audience, pain point or launch message matters most."],
      ["Can I use screenshots of the interface?", "The website workflow captures useful public pages as references. You can also use the creator modes that accept image references where appropriate."],
      ["Can I make another version later?", "Yes. Project history and the unified creator are designed for continued generation and new campaign directions."],
    ],
    related: [
      ["Website Video Generator", "/website-video-generator", "Use the broader website as campaign context."],
      ["URL to Video", "/url-to-video", "Turn a public link into an AI-directed video."],
      ["SaaS guide", "/guides/saas-product-demo-video", "Plan a stronger SaaS product video before generating."],
    ],
  },
  productPage: {
    path: "/product-page-to-video",
    eyebrow: "Product page to video",
    title: "Turn a product page into campaign video",
    seoTitle: "Product Page to Video AI — Ecommerce Video Generator",
    description:
      "Turn a public ecommerce product page into an AI campaign video. Use product benefits, merchandising and brand context to direct social, launch and promotional video.",
    intro:
      "Start from the product page customers already see, then direct a product-focused film around the offer, audience and campaign goal.",
    primaryLabel: "Create a product video",
    highlights: ["Product-page context", "Benefit-led story", "Product reference modes", "Campaign formats"],
    problemTitle: "Product pages contain the facts; campaigns need the angle",
    problemBody:
      "A product page may contain specifications, images, price, benefits and brand language, but a useful video still needs a hook and sequence. AiWebVideo uses the page as context and the campaign prompt to decide what should lead the story.",
    workflow: [
      ["Paste the product page", "Use a public product or collection page as the starting context."],
      ["Describe the campaign", "Choose the offer, product benefit, audience and channel you want the result to serve."],
      ["AI studies product context", "The workflow uses visible product and brand information as grounding for creative direction."],
      ["Choose the strongest sequence", "The plan prioritizes the hook, product value, proof points and final call to action."],
      ["Generate the film", "Follow production and download the finished result from the same project."],
    ],
    benefits: [
      ["Faster product campaigns", "Start from existing merchandising instead of rewriting the entire product brief."],
      ["Multiple creative angles", "Create separate versions around benefits, launches, offers, audiences or seasonal campaigns."],
      ["Reference-based product tools", "Product photo and product-video modes can use supplied real product images when you need direct reference grounding."],
      ["Channel-ready formats", "Choose landscape, portrait or square depending on where the campaign will run."],
    ],
    useCases: [
      ["New product launch", "Turn launch merchandising into a concise campaign story."],
      ["Social product ad", "Create a short benefit-led video for vertical or square distribution."],
      ["Seasonal offer", "Focus on the offer while keeping product and brand context visible to the production."],
      ["Collection promotion", "Use a collection or storefront page to direct a broader merchandising campaign."],
    ],
    faq: [
      ["Can I use a Shopify or other ecommerce page?", "You can submit a public product page that the website capture workflow can access. Results depend on the page being publicly reachable and renderable."],
      ["Does AiWebVideo preserve my exact product automatically?", "Website context helps ground the campaign, while product-reference modes are the better choice when exact supplied product imagery needs to remain central to the generation."],
      ["Can I make product photos too?", "Yes. The unified creator includes product-photo generation from supplied reference images in addition to website and product-video workflows."],
      ["Can I create several ads from one product?", "Yes. Use different prompts and formats to create new campaign angles from the same product context."],
    ],
    related: [
      ["URL to Video", "/url-to-video", "Use any public product or landing-page URL."],
      ["Product campaign guide", "/guides/product-page-video-ads", "Plan better product-page video campaigns."],
      ["AI Product Studio", "/studio/product", "Generate product photos and videos from references."],
    ],
  },
};

function SearchLandingPage({ page }: { page: SeoLanding }) {
  useSeo({ title: page.seoTitle, description: page.description, path: page.path, faq: page.faq });

  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-violet/[.12] blur-[150px]" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/[.06] px-3 py-2 font-utility text-[9px] uppercase tracking-[.18em] text-mint">
                <Sparkles size={12} /> {page.eyebrow}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.02] tracking-[-.05em] text-white sm:text-6xl lg:text-7xl">
                {page.title}
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-text-muted sm:text-lg sm:leading-8">
                {page.intro}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild><Link href="/?create=website#generate">{page.primaryLabel} <ArrowRight size={14} /></Link></Button>
                <Button variant="secondary" asChild><Link href="/examples">See examples</Link></Button>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {page.highlights.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-2 text-[10px] font-medium text-text-muted">
                    <CheckCircle2 size={12} className="text-mint" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <p className="font-utility text-[9px] uppercase tracking-[.18em] text-violet">Why it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-4xl">{page.problemTitle}</h2>
              <p className="mt-5 text-sm leading-7 text-text-muted sm:text-base">{page.problemBody}</p>
            </div>
            <div className="rounded-[30px] border border-white/[.08] bg-panel/80 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                {page.benefits.map(([title, body], index) => (
                  <article key={title} className="rounded-2xl border border-white/[.07] bg-black/15 p-4">
                    <span className="font-utility text-[9px] text-violet">0{index + 1}</span>
                    <h3 className="mt-3 font-display text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-5xl px-5 py-16 lg:py-20">
            <div className="text-center">
              <p className="font-utility text-[9px] uppercase tracking-[.18em] text-mint">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-4xl">From source to finished campaign</h2>
            </div>
            <div className="mt-10 space-y-3">
              {page.workflow.map(([title, body], index) => (
                <article key={title} className="grid gap-4 rounded-[24px] border border-white/[.08] bg-white/[.02] p-5 sm:grid-cols-[54px_1fr] sm:p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet/25 bg-violet/[.08] font-utility text-xs font-semibold text-violet">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {page.useCases.map(([title, body], index) => {
                const Icon = [Globe2, Film, Megaphone, Layers3][index % 4];
                return (
                  <article key={title} className="rounded-[24px] border border-white/[.08] bg-panel p-5">
                    <Icon size={18} className="text-mint" />
                    <h3 className="mt-5 font-display text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-4xl px-5 py-16 lg:py-20">
            <p className="font-utility text-[9px] uppercase tracking-[.18em] text-violet">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-white">Questions people ask before generating</h2>
            <div className="mt-8 divide-y divide-white/[.08] border-y border-white/[.08]">
              {page.faq.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none pr-8 font-display text-sm font-semibold text-white sm:text-base">{question}<span className="float-right text-violet transition group-open:rotate-45">+</span></summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-3 md:grid-cols-3">
              {page.related.map(([title, href, body]) => (
                <Link key={href} href={href} className="group rounded-[22px] border border-white/[.08] bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-violet/30">
                  <h3 className="font-display text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet">Explore <ArrowRight size={12} className="transition group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-panel px-6 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.22),transparent_52%)]" />
            <Link2 size={20} className="relative mx-auto text-mint" />
            <h2 className="relative mt-4 font-display text-3xl font-bold tracking-[-.035em] text-white">Your next video can start with one link</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-6 text-text-muted">Paste the public source, describe the campaign, and keep the production in one creative workspace.</p>
            <Button className="relative mt-6" asChild><Link href="/?create=website#generate">Start with a website <ArrowRight size={14} /></Link></Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function UrlToVideoPage() {
  return <SearchLandingPage page={pages.urlToVideo} />;
}

export function WebsiteVideoGeneratorPage() {
  return <SearchLandingPage page={pages.websiteVideoGenerator} />;
}

export function SaasDemoVideoGeneratorPage() {
  return <SearchLandingPage page={pages.saasDemo} />;
}

export function ProductPageToVideoPage() {
  return <SearchLandingPage page={pages.productPage} />;
}

const exampleCards = [
  ["SaaS launch", "Use the product website to ground a concise feature or launch story.", ScanSearch],
  ["Product campaign", "Use an ecommerce page or real product references to direct product-focused media.", PackageOpen],
  ["Business promotion", "Turn service positioning, offers and calls to action into a short campaign.", Megaphone],
  ["Original AI film", "Start from an idea when there is no website source to use.", Film],
] as const;

export function ExamplesPage() {
  useSeo({
    title: "AI Website Video Examples and Use Cases",
    description: "Explore AiWebVideo campaign examples and practical use cases for website-to-video, SaaS launches, ecommerce products, local businesses and original AI video.",
    path: "/examples",
  });

  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
            <p className="font-utility text-[10px] uppercase tracking-[.22em] text-mint">Examples & use cases</p>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-[-.045em] text-white sm:text-6xl">See what a website can become</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">Campaign films configured by the site owner load below. The use-case cards explain strong starting points without pretending that a generated example belongs to a customer unless it actually does.</p>
          </div>
        </section>
        <VideoShowcase />
        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-2 lg:grid-cols-4">
            {exampleCards.map(([title, body, Icon]) => (
              <article key={title} className="rounded-[24px] border border-white/[.08] bg-panel p-5">
                <Icon size={18} className="text-violet" />
                <h2 className="mt-5 font-display text-base font-semibold text-white">{title}</h2>
                <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="px-5 py-16">
          <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
            <Link href="/url-to-video" className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-display text-base font-semibold text-white">URL to video</h2><p className="mt-2 text-xs leading-6 text-text-muted">Turn a public webpage into campaign video.</p></Link>
            <Link href="/saas-demo-video-generator" className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-display text-base font-semibold text-white">SaaS product video</h2><p className="mt-2 text-xs leading-6 text-text-muted">Create launch and feature stories from a SaaS website.</p></Link>
            <Link href="/product-page-to-video" className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-display text-base font-semibold text-white">Product page to video</h2><p className="mt-2 text-xs leading-6 text-text-muted">Create product campaigns from ecommerce context.</p></Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
