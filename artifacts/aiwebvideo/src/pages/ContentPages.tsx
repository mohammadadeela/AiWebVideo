import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  Download,
  Film,
  Globe2,
  House,
  Image as ImageIcon,
  Layers3,
  MessageCircleMore,
  MonitorPlay,
  PackageOpen,
  Paperclip,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/app-button";
import { useSeo } from "@/lib/useSeo";

function Shell({
  eyebrow,
  title,
  seoTitle,
  intro,
  description,
  path,
  children,
}: {
  eyebrow: string;
  title: string;
  seoTitle?: string;
  intro: string;
  description: string;
  path: string;
  children: React.ReactNode;
}) {
  useSeo({ title: seoTitle ?? title, description, path });
  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-5 sm:py-16 text-center sm:py-20">
            <p className="font-utility text-[10px] uppercase tracking-[.22em] text-mint">
              {eyebrow}
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-[-.045em] text-white sm:text-6xl">
              {title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
              {intro}
            </p>
          </div>
        </section>
        {children}
        <CTA />
      </main>
      <Footer />
    </>
  );
}

function CTA() {
  return (
    <section className="border-t border-white/[.06] px-4 py-12 sm:px-5 sm:py-16">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-panel px-6 py-14 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.22),transparent_52%)]" />
        <h2 className="relative font-display text-3xl font-bold tracking-[-.035em] text-white">
          Start creating in one chat
        </h2>
        <p className="relative mt-3 text-sm text-text-muted">
          Website video, AI video, product media, talking scenes, or interior design.
        </p>
        <Button className="relative mt-6 px-4 text-xs" asChild><Link href="/#generate">Start creating</Link></Button>
      </div>
    </section>
  );
}

const features = [
  [
    "Website intelligence",
    "Reads useful pages, products, calls to action, colors, and brand identity.",
  ],
  [
    "AI creative direction",
    "Builds the hook, story beats, pacing, audio, and ending around your goal.",
  ],
  [
    "One continuous AI film",
    "Generates one coherent AI video for the requested duration instead of stitching independent clips.",
  ],
  [
    "Smart production controls",
    "Keeps smart defaults while exposing format, quality, duration, and audio when needed.",
  ],
  [
    "Visible generation progress",
    "Shows the live production stage, progress, and estimate inside the conversation.",
  ],
  [
    "Professional delivery",
    "Keeps history, final media, downloads, and applicable failed-render credit restoration together.",
  ],
];

const featureModes = [
  { title: "Website Video", input: "Public website or product-page URL, campaign goal and audience", output: "An AI-directed marketing video grounded in visible website context", href: "/website-video-generator", create: "/?create=website#generate" },
  { title: "AI Video", input: "Original prompt and optional image references", output: "A generated video with a directed story, style and format", href: "/ai-video-generator", create: "/?create=video#generate" },
  { title: "Product Photos", input: "Photos of the real product and an image brief", output: "Still ecommerce, studio or lifestyle campaign images", href: "/product-photo-generator", create: "/?create=photo#generate" },
  { title: "Product Video", input: "Photos of the real product and a motion brief", output: "A product-focused video with camera and environment direction", href: "/product-video-generator", create: "/?create=product-video#generate" },
  { title: "Talking Video", input: "Characters, dialogue, setting and performance direction", output: "A talking or scenario-driven AI video", href: "/talking-video-generator", create: "/?create=scenario#generate" },
  { title: "Interior Design", input: "Room or property photos, plans or sketches; measurements when needed", output: "Design concept images or a presentation walkthrough video", href: "/ai-interior-design-generator", create: "/?create=interior#generate" },
] as const;

const interiorWorkflows = [
  ["Interior design walkthrough", "/interior-design-walkthrough-video"],
  ["Real estate walkthrough", "/real-estate-walkthrough-video"],
  ["3D-style house walkthrough", "/3d-house-walkthrough"],
  ["Architectural visualization", "/ai-architectural-visualization"],
  ["Floor plan to 3D-style concepts", "/floor-plan-to-3d"],
  ["Room redesign from a photo", "/room-redesign-ai"],
] as const;

export function FeaturesPage() {
  return (
    <Shell
      eyebrow="Choose a creation mode"
      title="What can I create with AiWebVideo?"
      seoTitle="AI Video, Product Media & Interior Design Features"
      intro="Choose the source you already have and the result you need. Every mode runs in the same creator, with its own references, settings, and credit estimate."
      description="Compare AiWebVideo creation modes: website video, original AI video, product photos and video, talking scenes, and interior design images or walkthroughs."
      path="/features"
    >
      <section className="border-b border-white/[.06] bg-black/10" aria-labelledby="mode-directory">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16">
          <h2 id="mode-directory" className="font-display text-2xl font-bold text-white sm:text-3xl">Find the right mode for your source</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">Website URLs supply public page context; real product photos ground product media; room photos and plans ground interior concepts. Describe the result you want before generation.</p>
          <div id="product-media" className="mt-8 grid scroll-mt-24 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featureModes.map((mode) => (
              <article key={mode.href} className="flex flex-col rounded-[24px] border border-white/[.08] bg-panel p-6">
                <h3 className="font-display text-xl font-semibold text-white"><Link href={mode.href} className="hover:text-mint">{mode.title}</Link></h3>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.12em] text-mint">You provide</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{mode.input}</p>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.12em] text-violet">You receive</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{mode.output}</p>
                <div className="mt-auto flex flex-wrap gap-4 pt-6 text-xs font-semibold">
                  <Link href={mode.href} className="text-mint hover:text-white">Learn more <ArrowRight size={12} className="inline" /></Link>
                  <Link href={mode.create} className="text-violet hover:text-white">Start creating <ArrowRight size={12} className="inline" /></Link>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-[24px] border border-violet/25 bg-violet/[.05] p-6">
            <h3 className="font-display text-lg font-semibold text-white">Interior design and property workflows</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">Select the page closest to your goal. A single photo cannot guarantee exact dimensions; include a scaled plan or explicit measurements when proportions matter.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {interiorWorkflows.map(([label, href]) => <Link key={href} href={href} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white hover:border-violet/50">{label}</Link>)}
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-5 sm:py-16 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body], index) => (
            <article
              key={title}
              className="rounded-[28px] border border-white/[.08] bg-panel p-6 transition hover:-translate-y-1 hover:border-violet/35"
            >
              <span className="font-utility text-[10px] text-violet">
                0{index + 1}
              </span>
              <h2 className="mt-6 font-display text-lg font-semibold text-white">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">{body}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mb-16 max-w-7xl rounded-[30px] border border-violet/30 bg-signature-soft p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="font-utility text-[10px] uppercase tracking-[.16em] text-violet">
              One creator, multiple capabilities
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">
              Website video, AI video, product media, talking scenes and interior design
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-muted">
              Switch modes without leaving the conversation. References, prompts, and results stay together. Review the credit estimate before paid generation.
            </p>
          </div>
          <Button className="mt-4 sm:mt-0" asChild><Link href="/?create=video#generate">Explore AI Studio</Link></Button>
        </div>
      </section>
      <section className="border-t border-white/[.06] px-4 py-12 sm:px-5" aria-label="Choosing a creation mode">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-semibold text-white">Questions about choosing a mode</h2>
          <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
            {[
              ["Which mode makes AI product images?", "Product Photos takes uploaded images of the real item and creates still ecommerce or campaign visuals. Product Video creates moving product footage from those references."],
              ["Can I make an interior design tour from room photos?", "Yes. Choose Interior Design, add authorized photos or plans, describe the style and materials, and choose a walkthrough video. Supply measurements when proportions matter."],
              ["Do I need a website to create an AI video?", "No. AI Video starts from an original idea and optional image references. Website Video starts from a public website URL."],
            ].map(([question, answer]) => <details key={question} className="py-5"><summary className="cursor-pointer text-sm font-semibold text-white">{question}</summary><p className="mt-3 text-sm leading-7 text-text-muted">{answer}</p></details>)}
          </div>
        </div>
      </section>
    </Shell>
  );
}

const sharedWorkflow = [
  ["Choose what you are creating", "Start with Website Video, AI Video, Product Photos, Product Video, Talking Scene, or Interior Design."],
  ["Give AI the source", "Paste a public website, write the creative direction, or attach product, room, or plan references depending on the mode."],
  ["Keep defaults or adjust settings", "Smart settings handle the common choices. Open them only when you want to change duration, format, quality, or audio."],
  ["Credits are verified before paid AI starts", "Website screenshots can be captured for free. Before AI planning, video, image, or voice providers are used, the server verifies and reserves the exact production credits."],
  ["Generate in the same conversation", "After the credit gate passes, the project continues in Workspace, where the source, prompt, references, settings, and generation state stay together."],
  ["Follow progress and get the result", "Live production status stays visible until the final media is ready to review, download, or continue from."],
] as const;

const creationFlows = [
  {
    id: "website",
    icon: Globe2,
    eyebrow: "Website URL → Video",
    title: "Website Video",
    accent: "text-mint",
    border: "border-mint/25",
    glow: "bg-mint/[.06]",
    input: "Paste a public website URL and tell AI what you want the video to highlight.",
    process: "AiWebVideo first captures useful public pages, the favicon, and visual source as a free preview. When you continue to production, credits are verified before paid AI planning begins; then the captured brand, products, interface, and calls to action guide the video.",
    result: "A brand-aware campaign video built from the website context and your direction, with no paid AI/provider step started before the credit gate passes.",
    href: "/?create=website#generate",
  },
  {
    id: "video",
    icon: Film,
    eyebrow: "Idea → Video",
    title: "AI Video",
    accent: "text-violet",
    border: "border-violet/25",
    glow: "bg-violet/[.06]",
    input: "Describe the film you want. Add reference images only when they help define the subject or look.",
    process: "AI turns the prompt and references into the creative direction, then generates the video using your selected delivery settings.",
    result: "An original AI-generated video for ads, launches, social content, or brand storytelling.",
    href: "/?create=video#generate",
  },
  {
    id: "photo",
    icon: ImageIcon,
    eyebrow: "Product → Photos",
    title: "Product Photos",
    accent: "text-pink",
    border: "border-pink/25",
    glow: "bg-pink/[.06]",
    input: "Attach the real product image and describe the campaign or studio style you want.",
    process: "AI keeps the product as the main reference while creating new campaign-ready visual treatments around it.",
    result: "Polished product marketing images ready for ecommerce, campaigns, and social media.",
    href: "/?create=photo#generate",
  },
  {
    id: "product-video",
    icon: PackageOpen,
    eyebrow: "Product → Video",
    title: "Product Video",
    accent: "text-gold",
    border: "border-gold/25",
    glow: "bg-gold/[.06]",
    input: "Attach product references and describe the motion, camera feel, and type of product reveal you want.",
    process: "AI uses the product references as visual grounding and creates motion around the requested campaign direction.",
    result: "A product-focused promotional video with the product kept at the center of the story.",
    href: "/?create=product-video#generate",
  },
  {
    id: "scenario",
    icon: MessageCircleMore,
    eyebrow: "Prompt → Talking Scene",
    title: "Talking Scene",
    accent: "text-mint",
    border: "border-mint/25",
    glow: "bg-mint/[.06]",
    input: "Describe who is speaking, what happens, the dialogue or message, and the scene you want.",
    process: "AI uses the scene direction to plan the speaker, action, framing, and delivery. References can be added when useful.",
    result: "A generated talking or scenario-based video for explainers, testimonials, founders, or conversational scenes.",
    href: "/?create=scenario#generate",
  },
  {
    id: "interior",
    icon: House,
    eyebrow: "Space → Images or Walkthrough",
    title: "Interior Design",
    accent: "text-violet",
    border: "border-violet/25",
    glow: "bg-violet/[.06]",
    input: "Attach room or property photos, plans, or sketches. Describe the design and supply explicit measurements when geometry matters.",
    process: "The space references guide materials, lighting, furniture, and the requested changes. Choose still concept images or a presentation walkthrough.",
    result: "AI interior design concept images or a walkthrough video based on the supplied space; generated concepts are not construction documents.",
    href: "/?create=interior#generate",
  },
] as const;

const websiteStyles = [
  ["Promo", "A direct brand or offer campaign with a strong hook and CTA."],
  ["Cinematic", "A more film-like brand treatment focused on mood, pacing, and visual impact."],
  ["Tutorial", "Explains a workflow or process in a clear step-by-step sequence."],
  ["Feature tour", "Focuses the video on important product or service features."],
  ["How to buy", "Builds the story around the purchase or conversion journey."],
  ["LinkedIn", "Uses a more professional social style for business-facing communication."],
] as const;

const smartControls = [
  { icon: SlidersHorizontal, title: "Duration", body: "Choose a preset duration or use Custom for exact 1-second control from 8 to 60 seconds. The credit quote updates before generation." },
  { icon: MonitorPlay, title: "Format", body: "Choose portrait 9:16, landscape 16:9, or square 1:1 depending on where the result will be used." },
  { icon: Layers3, title: "Quality", body: "Choose 1080p or 4K delivery while keeping the same creation flow." },
  { icon: Volume2, title: "Audio", body: "For video modes, choose scene audio, narration, music only, or silent delivery. Narration also supports language selection." },
  { icon: Paperclip, title: "References", body: "Attach images when the product, subject, or visual direction needs stronger grounding." },
] as const;

export function HowItWorksPage() {
  return (
    <Shell
      eyebrow="How it works"
      title="One creator. Six ways to start."
      seoTitle="How AI Video, Product Images & Interior Design Work"
      intro="Start with a website, an idea, a product, dialogue, or a real space. AiWebVideo keeps the source, direction, settings, generation progress, and final result together in one workflow."
      description="See the input, AI workflow, and output for website video, original AI video, product images and video, talking scenes, and interior design tours."
      path="/how-it-works"
    >
      <section className="border-b border-white/[.06]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">The shared workflow</p>
              <h2 className="mt-4 max-w-xl font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-4xl">The same simple path, whichever feature you choose.</h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-text-muted">You do not need to learn a different editor for every feature. Only the source changes; the project still continues in the same creator and Workspace.</p>
            </div>
            <div className="relative">
              <div className="absolute bottom-8 left-5 top-8 hidden w-px bg-gradient-to-b from-mint via-violet to-pink opacity-50 sm:block" aria-hidden="true" />
              {sharedWorkflow.map(([title, body], index) => (
                <article key={title} className="relative grid gap-3 border-b border-white/[.07] py-6 first:pt-0 last:border-0 sm:grid-cols-[56px_1fr]">
                  <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-violet/30 bg-bg font-utility text-[10px] font-bold text-violet">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-text-muted">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[.06] bg-black/10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="max-w-3xl">
            <p className="font-utility text-[10px] uppercase tracking-[.2em] text-violet">Every creation mode</p>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-4xl">What you give AI, what it does, and what you get.</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {creationFlows.map(({ id, icon: Icon, eyebrow, title, accent, border, glow, input, process, result, href }, index) => (
              <article key={id} className={`group relative overflow-hidden rounded-[28px] border ${border} bg-panel p-5 sm:p-6 ${index === 0 ? "lg:col-span-2" : ""}`}>
                <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full ${glow} blur-3xl`} />
                <div className="relative flex items-start gap-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[.09] bg-black/20 ${accent}`}><Icon size={19} /></span>
                  <div className="min-w-0">
                    <p className={`font-utility text-[9px] uppercase tracking-[.16em] ${accent}`}>{eyebrow}</p>
                    <h3 className="mt-1 font-display text-xl font-semibold text-white">{title}</h3>
                  </div>
                </div>
                <div className={`relative mt-5 grid gap-3 ${index === 0 ? "md:grid-cols-3" : ""}`}>
                  {[["You provide", input], ["AiWebVideo does", process], ["You receive", result]].map(([label, body]) => (
                    <div key={label} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
                      <p className="font-utility text-[9px] uppercase tracking-[.14em] text-text-dim">{label}</p>
                      <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" className="relative mt-4 h-10 px-3 text-xs" asChild>
                  <Link href={href}>Try {title} <ArrowRight size={13} /></Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[.06]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
            <div>
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">Website Video styles</p>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-4xl">Choose the video style that matches the goal of the website campaign.</h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-text-muted">The style control changes the creative direction; it does not send you into a different tool.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {websiteStyles.map(([title, body], index) => (
                <article key={title} className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet/25 bg-violet/[.08] font-utility text-[9px] text-violet">0{index + 1}</span>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[.06] bg-black/10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="max-w-3xl">
            <p className="font-utility text-[10px] uppercase tracking-[.2em] text-gold">Smart settings</p>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-4xl">Defaults first. Controls only when you need them.</h2>
            <p className="mt-4 text-sm leading-7 text-text-muted">The main form stays simple. Open Smart settings when the delivery format matters.</p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {smartControls.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-[22px] border border-white/[.08] bg-panel p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.08] bg-black/20 text-gold"><Icon size={16} /></span>
                <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-text-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[.06]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[30px] border border-white/[.1] bg-[#0c0917] p-5 sm:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,.18),transparent_42%)]" />
              <div className="relative rounded-[22px] border border-white/[.08] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-mint" /><span className="text-xs font-semibold text-white">Generation in progress</span></div>
                  <span className="font-utility text-[9px] text-mint">68%</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {["Source", "Direction", "Generate", "Result"].map((stage, index) => <div key={stage}><div className={`h-1.5 rounded-full ${index < 2 ? "bg-mint" : index === 2 ? "bg-violet" : "bg-white/[.08]"}`} /><p className="mt-2 text-[9px] text-text-dim">{stage}</p></div>)}
                </div>
                <div className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 text-xs leading-6 text-text-muted">The conversation keeps the original source, your prompt, references, chosen settings, progress, and completed media together.</div>
              </div>
            </div>
            <div>
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-pink">Workspace</p>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-4xl">You can leave the page without losing the project.</h2>
              <div className="mt-6 space-y-3">
                {[
                  [Activity, "Live progress", "See which production stage is currently running."],
                  [Sparkles, "Project context", "Prompts, source material, references, and prior results stay with the conversation."],
                  [Download, "Final delivery", "When generation finishes, review and download the result or continue creating from the same project."],
                ].map(([Icon, title, body]) => {
                  const ItemIcon = Icon as typeof Activity;
                  return <div key={String(title)} className="flex gap-3 rounded-2xl border border-white/[.07] bg-white/[.02] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-mint/20 bg-mint/[.07] text-mint"><ItemIcon size={15} /></span><div><h3 className="text-sm font-semibold text-white">{String(title)}</h3><p className="mt-1 text-xs leading-5 text-text-muted">{String(body)}</p></div></div>;
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}

export function AboutPage() {
  return (
    <Shell
      eyebrow="Company"
      title="Create from the sources you already have"
      seoTitle="About AiWebVideo — AI Video, Product Media & Interior Design"
      intro="AiWebVideo turns public websites, original ideas, real product images, and space references into directed video, images, and interior concepts."
      description="Learn about AiWebVideo's approach to website video, AI video, product photos and video, talking scenes, and interior design."
      path="/about"
    >
      <section>
        <div className="mx-auto grid max-w-5xl gap-5 px-4 py-12 sm:px-5 sm:py-16 md:grid-cols-3">
          {[
            [
              "Website grounded",
              "The real site—not a generic template—is the source of truth for the brand and campaign.",
            ],
            [
              "Intent directed",
              "The customer expresses the goal; AI handles the detailed creative and production decisions.",
            ],
            [
              "Progress visible",
              "The work stays understandable from website reading and direction through generation and delivery.",
            ],
          ].map(([title, body]) => (
            <article
              key={title}
              className="rounded-[28px] border border-white/[.08] bg-panel p-6"
            >
              <h2 className="font-display text-lg font-semibold text-white">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}

const faqGroups = [
  {
    title: "Getting started",
    items: [
      [
        "What is the main product?",
        "AiWebVideo makes website videos, original AI videos, product photos and videos, talking scenes, and interior design images or walkthroughs. Choose the mode that matches your source and desired output.",
      ],
      [
        "Do I need to choose every setting?",
        "No. The creator starts with safe defaults. You can choose a preset or exact custom duration, plus ratio, quality, audio and language when you want more control.",
      ],
    ],
  },
  {
    title: "Website videos",
    items: [
      [
        "Does it use my real website?",
        "Yes. The workflow studies public pages and uses the visible brand identity as creative grounding for the production.",
      ],
      [
        "How does it choose the duration?",
        "You choose the duration before generation. Pick a preset or use Custom for any whole second from 8 to 60, with the credit quote shown before paid generation starts.",
      ],
    ],
  },
  {
    title: "Generation",
    items: [
      [
        "Are the final videos fully AI-generated?",
        "Final video scenes are generated with AI for the campaign. Website captures are creative references and are not presented as a stock-template slideshow.",
      ],
      [
        "Can I make a video without talking?",
        "Yes. Choose Voice + music, Music only · no talking, or Silent master before production. English is the default speaking language when voice is selected, and you can change it.",
      ],
      [
        "How long does generation take?",
        "Capture, planning and final production timing vary by project. The workspace shows the current production stage and progress while the job is active.",
      ],
    ],
  },
  {
    title: "Product content",
    items: [
      [
        "Can I generate normal videos or product images?",
        "Yes. The unified creator supports original AI video, product campaign photos, product video and talking/scenario video alongside website-to-video.",
      ],
      [
        "Can I attach real product references?",
        "Yes. Product photo and product video modes accept reference images so the production can be grounded in the supplied product media.",
      ],
    ],
  },
  {
    title: "Interior design",
    items: [
      ["Can I create interior design images or a video tour?", "Yes. Interior Design accepts room and property photos, floor plans, and sketches. Choose still design concepts or a presentation walkthrough."],
      ["Does a room photo provide exact measurements?", "No. Include explicit dimensions or a scaled plan when proportions matter. Generated concepts are not a substitute for verified construction documents."],
    ],
  },
  {
    title: "Credits & billing",
    items: [
      [
        "What happens if production fails?",
        "The existing paid-render flow restores production credits reserved for unfinished work when its refund path applies. The project remains available in history so you can review it or try again.",
      ],
      [
        "Can I see the required balance before generation?",
        "The creator calculates the production estimate from the current duration, quality, mode and audio choices before the paid generation step.",
      ],
    ],
  },
  {
    title: "Accounts & files",
    items: [
      [
        "What happens to my project after I sign in?",
        "Signed-in productions stay connected to the account workspace so you can return to active or completed work from project history.",
      ],
      [
        "What website content is captured?",
        "The website workflow works with public website pages. Account history and downloadable outputs are loaded through the authenticated experience.",
      ],
      [
        "How do I contact support?",
        "Email aiwebvideo0@gmail.com for help with your account, billing, or a production.",
      ],
    ],
  },
] as const;

export function FaqPage() {
  return (
    <Shell
      eyebrow="Help"
      title="Frequently asked questions"
      seoTitle="AI Video, Product Media & Interior Design FAQ"
      intro="Straight answers about website and AI video, product references, interior design, credits, and saved projects."
      description="Answers to common questions about AiWebVideo's website video, product images and videos, interior design, generation, credits, billing, and accounts."
      path="/faq"
    >
      <section>
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-5 sm:py-16">
          <div className="grid gap-10 md:grid-cols-[220px_1fr]">
            <nav aria-label="FAQ categories" className="md:sticky md:top-24 md:self-start">
              <p className="mb-3 font-utility text-[9px] uppercase tracking-[.18em] text-text-dim">Categories</p>
              <div className="flex gap-1 overflow-x-auto md:flex-col">
                {faqGroups.map((group) => (
                  <a
                    key={group.title}
                    href={`#faq-${group.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted transition hover:bg-white/5 hover:text-text-primary"
                  >
                    {group.title}
                  </a>
                ))}
              </div>
            </nav>
            <div className="space-y-10">
              {faqGroups.map((group) => {
                const id = `faq-${group.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
                return (
                  <section key={group.title} id={id} className="scroll-mt-28">
                    <h2 className="font-display text-xl font-semibold text-text-primary">{group.title}</h2>
                    <div className="mt-3 divide-y divide-border border-y border-border">
                      {group.items.map(([question, answer]) => (
                        <details key={question} className="group py-5">
                          <summary className="list-none pr-8 font-display text-sm font-semibold text-text-primary sm:text-base">
                            {question}
                            <span className="float-right text-violet transition group-open:rotate-45" aria-hidden="true">+</span>
                          </summary>
                          <p className="mt-3 max-w-2xl pr-6 text-sm leading-6 text-text-muted">{answer}</p>
                        </details>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function LegalPage({
  title,
  seoTitle,
  intro,
  description,
  path,
  sections,
}: {
  title: string;
  seoTitle: string;
  intro: string;
  description: string;
  path: string;
  sections: Array<[string, string]>;
}) {
  return (
    <Shell
      eyebrow="Legal · Updated August 5, 2026"
      title={title}
      seoTitle={seoTitle}
      intro={intro}
      description={description}
      path={path}
    >
      <section>
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-5 sm:py-16">
          {sections.map(([heading, body]) => (
            <article key={heading}>
              <h2 className="font-display text-xl font-semibold text-text-primary">
                {heading}
              </h2>
              <p className="mt-3 text-sm leading-7 text-text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      seoTitle="Privacy Notice"
      intro="This notice explains the main information handled when you use AiWebVideo."
      description="AiWebVideo's privacy notice: what account, website, and billing information is processed, how it's used, and your choices."
      path="/privacy"
      sections={[
        [
          "Information you provide",
          "We process account details, website URLs, creative instructions, and billing identifiers needed to provide the service. Payment card details are handled by the payment provider and are not stored directly by this application.",
        ],
        [
          "Website capture and generated files",
          "When you submit a URL, the service accesses publicly available pages and creates screenshots, recordings, plans, and output files for your project. Do not submit private pages or content you are not authorized to use.",
        ],
        [
          "How information is used",
          "Information is used to authenticate accounts, run productions, save project history, deliver files, prevent misuse, support billing, and improve reliability.",
        ],
        [
          "Retention and security",
          "Project records and files may be retained so they remain available in your account. Reasonable technical safeguards are used, but no online service can guarantee absolute security.",
        ],
        [
          "Your choices",
          "You can stop using the service, sign out of shared devices, and request help regarding account or project information through the support channel provided with your account.",
        ],
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      seoTitle="Terms of Service"
      intro="These terms describe the basic rules for using AiWebVideo and its production features."
      description="AiWebVideo's terms of service: account responsibilities, content rights, credits and billing, acceptable use, and service availability."
      path="/terms"
      sections={[
        [
          "Your account",
          "Provide accurate account information, protect your login, and use the service only for lawful business or creative purposes. You are responsible for activity performed through your account.",
        ],
        [
          "Rights to submitted content",
          "Only submit websites, trademarks, images, instructions, and other materials you own or are authorized to use. You remain responsible for reviewing generated files before publishing them.",
        ],
        [
          "Credits and billing",
          "Plans and production options use the prices and credits shown at checkout. Failed paid renders restore credits reserved for unfinished work. Fees already consumed by completed work are not automatically refundable.",
        ],
        [
          "Acceptable use",
          "Do not use the service to violate rights, impersonate others, distribute unlawful material, attack systems, or attempt to bypass security and billing controls.",
        ],
        [
          "Service availability",
          "Production time and output can vary with website complexity and system demand. Features may change as reliability and quality improve. The service is provided without a guarantee that every submitted website can be captured or rendered.",
        ],
      ]}
    />
  );
}
