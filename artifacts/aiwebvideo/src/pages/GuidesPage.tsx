import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/app-button";
import { useSeo } from "@/lib/useSeo";

type Guide = {
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  createHref: string;
  sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }>;
  related: Array<[string, string]>;
};

const guides: Record<string, Guide> = {
  website: {
    path: "/guides/turn-website-into-video",
    title: "How to turn a website into a video with AI",
    seoTitle: "How to Turn a Website Into a Video With AI",
    description: "A practical guide to turning a website into a useful AI marketing video: choose the goal, source pages, story, format, prompt and review criteria.",
    intro: "A good website-to-video workflow is not about showing every page. It is about deciding what the viewer should understand, using the site as evidence, and building one clear campaign around that goal.",
    createHref: "/?create=website#generate",
    sections: [
      { heading: "1. Start with one campaign goal", paragraphs: ["Before generating anything, decide what the video should achieve. A homepage overview, product launch, seasonal offer and feature announcement are different stories even when they use the same website."], bullets: ["Name the audience.", "Choose the single offer or product focus.", "Decide the call to action.", "Choose where the video will be published."] },
      { heading: "2. Use the website as source context, not a script", paragraphs: ["Web copy is written for scanning and navigation. Video needs sequence and pacing. The useful move is to let the website provide facts, visuals, positioning and brand cues while the campaign plan decides what appears first and what can be omitted."], bullets: ["Homepage for positioning", "Feature or product pages for proof", "Pricing or offer pages when price is part of the campaign", "Contact or CTA context for the ending"] },
      { heading: "3. Write direction that makes a decision", paragraphs: ["Prompts work better when they specify the outcome rather than asking for something generically professional. Tell the creator what should be emphasized and what the viewer should do after watching."], bullets: ["Promote the new feature to small SaaS teams.", "Lead with the time-saving benefit.", "Use a fast launch tone for a 9:16 social video.", "End with a direct invitation to try the product."] },
      { heading: "4. Match format to distribution", paragraphs: ["A landscape homepage film and a vertical social campaign serve different viewing contexts. Choose the format before production when the destination is known; otherwise a smart default is usually enough for the first draft."], bullets: ["16:9 for websites, YouTube and presentations", "9:16 for Reels, Shorts and TikTok-style placements", "1:1 for compact social placements"] },
      { heading: "5. Review the story before obsessing over polish", paragraphs: ["The most important review question is whether the video communicates the right sequence: hook, value, evidence and call to action. A visually impressive render with the wrong story is still the wrong campaign."], bullets: ["Can a new viewer understand the product quickly?", "Is one benefit clearly prioritized?", "Does each scene earn its place?", "Is the CTA obvious?"] },
    ],
    related: [["Try URL to Video", "/url-to-video"], ["See how AiWebVideo works", "/how-it-works"], ["Website video generator", "/website-video-generator"]],
  },
  saas: {
    path: "/guides/saas-product-demo-video",
    title: "How to make a stronger SaaS product video",
    seoTitle: "How to Create a SaaS Product Demo Video With AI",
    description: "Plan a stronger SaaS product video by choosing one audience, one product angle, the right website context, a clear narrative and a distribution format.",
    intro: "The biggest SaaS video mistake is trying to explain the entire product. A stronger campaign chooses one audience and one job, then uses the product website to support that story.",
    createHref: "/?create=website#generate",
    sections: [
      { heading: "1. Pick the viewer before the feature", paragraphs: ["A founder, marketer, operations manager and developer notice different benefits. Define the viewer first so the video can decide which part of the product deserves attention."], bullets: ["Who is watching?", "What problem already feels urgent to them?", "What outcome would make them care?"] },
      { heading: "2. Choose one product angle", paragraphs: ["Do not force every feature into a short video. A launch film can focus on a new capability; an outbound video can focus on a painful workflow; a homepage overview can explain the product category and value."], bullets: ["Feature launch", "Pain-point solution", "Before/after workflow", "Category introduction", "Proof or differentiation"] },
      { heading: "3. Use website context to keep claims grounded", paragraphs: ["Feature pages, homepage positioning, pricing language and public interface visuals are useful production inputs because they already represent how the product is being sold. Use them as context, then keep the final story selective."], bullets: ["Do not invent capabilities the site does not support.", "Keep terminology consistent with the product.", "Prioritize the strongest visible proof points."] },
      { heading: "4. Build a short narrative", paragraphs: ["A simple product campaign often works as: problem → product shift → one or two proof points → CTA. The order matters more than the number of features included."], bullets: ["Hook the problem", "Introduce the product", "Show the key outcome", "Support with one proof point", "End with the action"] },
      { heading: "5. Make variants instead of one overloaded master", paragraphs: ["If several audiences or features matter, make separate variants. One website can support a feature-launch version, a sales-outreach version and a vertical social version without forcing all three purposes into one film."] },
    ],
    related: [["SaaS demo generator", "/saas-demo-video-generator"], ["URL to video", "/url-to-video"], ["Examples", "/examples"]],
  },
  product: {
    path: "/guides/product-page-video-ads",
    title: "How to turn a product page into a video campaign",
    seoTitle: "How to Turn a Product Page Into a Video Ad With AI",
    description: "A practical guide to converting ecommerce product-page context into a focused AI video campaign for launches, offers and social promotion.",
    intro: "Product pages are designed to answer buying questions. Video campaigns need a hook and a sequence. The best workflow uses the page for product truth while the campaign brief chooses the angle.",
    createHref: "/?create=website#generate",
    sections: [
      { heading: "1. Decide the buying reason", paragraphs: ["Choose the main reason this audience should care now. That might be a product benefit, new launch, seasonal use, limited offer or problem the product solves."], bullets: ["One audience", "One product", "One leading benefit", "One CTA"] },
      { heading: "2. Separate product truth from creative angle", paragraphs: ["Use the product page for grounded information such as features, materials, visible merchandising and brand language. Use the prompt to decide how those facts become a campaign."], bullets: ["Do not add unsupported product claims.", "Keep product naming consistent.", "Use supplied real references when exact product appearance is essential."] },
      { heading: "3. Lead with the strongest visual idea", paragraphs: ["A product video usually needs the product or its outcome early. Avoid spending the first half of a short campaign on generic setup that could belong to any brand."], bullets: ["Product first", "Benefit first", "Use-case first", "Offer first"] },
      { heading: "4. Choose the channel before the final render", paragraphs: ["Vertical creative gives the product different composition constraints than landscape. Choose 9:16 for vertical-first social placements, 1:1 for compact feeds, and 16:9 for broader web or presentation use."] },
      { heading: "5. Create variants around one source", paragraphs: ["One product page can support multiple legitimate campaigns. Change the audience, benefit, hook or destination rather than trying to put every angle into one video."], bullets: ["Launch version", "Benefit version", "Offer version", "Lifestyle/use-case version"] },
    ],
    related: [["Product page to video", "/product-page-to-video"], ["URL to video", "/url-to-video"]],
  },
  promptVideo: {
    path: "/guides/create-ai-video-from-prompt",
    title: "How to create an AI video from a prompt or dialogue",
    seoTitle: "How to Create an AI Video From a Prompt or Dialogue",
    description: "Plan an original AI video or talking scene: define the subject, action, camera, references, audio, format, and review criteria before generating.",
    intro: "An original film begins with an action and visual direction. A talking scene also needs characters, dialogue, and performance instructions. Choose the mode based on what viewers should see and hear.",
    createHref: "/?create=video#generate",
    sections: [
      { heading: "1. Choose original video or talking scene", paragraphs: ["Use AI Video when the subject, setting and visual action lead the film. Use Talking Video when the key result is a conversation, scripted line, explanation or scenario."], bullets: ["AI Video: visual concept and optional reference images", "Talking Video: people, setting, dialogue and audio direction"] },
      { heading: "2. Describe visible action", paragraphs: ["Name the subject, location, movement and mood. Give the model something observable to stage instead of asking only for a vague aesthetic. Mention what must remain visible from any supplied references."] },
      { heading: "3. Direct camera, format and audio", paragraphs: ["Decide whether the final video belongs on a website, in a presentation or in a vertical social feed. Then set landscape, square or portrait format, duration and audio. For a talking scene, provide language and exact lines when the message matters."] },
      { heading: "4. Add references selectively", paragraphs: ["Image references help anchor appearance, identity or product details. Only attach material you can use, and be specific about what the video should take from each image. A reference guides generation; check the output rather than assuming exact reproduction."] },
      { heading: "5. Review before publishing", paragraphs: ["Watch for continuity, distorted text, unsupported claims, dialogue mistakes and mismatched audio. Create a new direction if the story or subject is wrong; choose the other mode if the request is fundamentally a product, website or interior workflow."] },
    ],
    related: [["AI Video Generator", "/ai-video-generator"], ["Talking Video Generator", "/talking-video-generator"], ["All creation modes", "/features"]],
  },
  productReferences: {
    path: "/guides/product-photos-and-videos-from-images",
    title: "How to make product photos and videos from real images",
    seoTitle: "How to Make AI Product Photos and Videos From Images",
    description: "Use real product photos as references for AI ecommerce imagery and product commercials, with practical guidance for lighting, motion, fidelity, and review.",
    intro: "A public product page and an uploaded photograph are different starting points. Use reference photos when the actual item, packaging or label needs to guide the output, then choose a still image or a moving film.",
    createHref: "/?create=photo#generate",
    sections: [
      { heading: "1. Photograph the real product clearly", paragraphs: ["Use sharp, well-lit images that show the item from useful angles. Include the label, shape, materials, color and packaging details that customers must recognize. Upload only media you are allowed to use."] },
      { heading: "2. Choose Product Photos or Product Video", paragraphs: ["Product Photos generates still studio, lifestyle or campaign concepts. Product Video adds movement and camera direction. Product Page to Video starts from a public ecommerce URL and its visible page context instead of uploaded product photographs."] },
      { heading: "3. Describe one campaign direction", paragraphs: ["State the audience, setting, background, lighting and desired use. For a product video, also describe camera movement, a reveal or close-up, pacing and aspect ratio. Say which product details should remain unchanged."] },
      { heading: "4. Pick a format for the destination", paragraphs: ["A vertical social ad, a square feed image and a wide website banner need different framing. Decide the intended placement before production rather than cropping away essential product details afterward."] },
      { heading: "5. Compare output to the real item", paragraphs: ["AI output can change small text, logos, colors or packaging. Check the generated image or video against the product you actually sell and correct misleading details before publishing commercial claims."] },
    ],
    related: [["Product Photo Generator", "/product-photo-generator"], ["Product Video Generator", "/product-video-generator"], ["Product Page to Video", "/product-page-to-video"]],
  },
  interiors: {
    path: "/guides/interior-design-from-photos-and-plans",
    title: "How to make interior design images and walkthroughs from real spaces",
    seoTitle: "How to Create AI Interior Design From Photos and Floor Plans",
    description: "Prepare room photos, scaled plans, measurements, preserved elements, and a design brief for AI interior images or a presentation walkthrough.",
    intro: "A useful redesign starts with the actual room or property. Supply references for the existing geometry, specify what should change, and decide whether the output is a still design concept or a walkthrough presentation.",
    createHref: "/?create=interior#generate",
    sections: [
      { heading: "1. Capture the space", paragraphs: ["Upload clear photos showing walls, windows, doors, columns, ceiling, curves and built-in elements. For multiroom work, identify which photo belongs to which room. Plans, elevations or sketches can add context that a single perspective cannot show."] },
      { heading: "2. Supply dimensions when they matter", paragraphs: ["Write down measured width, length and height, or use a scaled plan. A normal photo alone cannot guarantee exact dimensions or a true 3D model. Mark fixed elements that the concept must preserve."] },
      { heading: "3. Specify design decisions", paragraphs: ["Describe intended use, materials, furniture, ceiling treatment, lighting, color and atmosphere. For a shop or property presentation, state the audience and key features to highlight. If a structural change is allowed, say so explicitly."] },
      { heading: "4. Select images or walkthrough video", paragraphs: ["Use design images to compare still options for a room. Choose a walkthrough for a presentation tour; describe room order, camera path and areas to linger on. A walkthrough is a visual concept, not CAD or BIM geometry."] },
      { heading: "5. Verify before construction or listing", paragraphs: ["Check openings, proportions, roof and ceiling details, lighting placement and material claims against the real property. Have qualified professionals verify any dimensions, safety requirements and construction decisions before using the concept as a build specification."] },
    ],
    related: [["AI Interior Design Generator", "/ai-interior-design-generator"], ["Interior Design Walkthrough", "/interior-design-walkthrough-video"], ["Floor Plan to 3D-style Concept", "/floor-plan-to-3d"]],
  },
};

function GuidePage({ guide }: { guide: Guide }) {
  useSeo({ title: guide.seoTitle, description: guide.description, path: guide.path });
  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-4xl px-5 py-16 text-center sm:py-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet/20 bg-violet/[.06] px-3 py-2 font-utility text-[9px] uppercase tracking-[.18em] text-violet"><BookOpen size={12} /> Practical guide</div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-[-.045em] text-white sm:text-6xl">{guide.title}</h1>
            <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-text-muted sm:text-base sm:leading-8">{guide.intro}</p>
          </div>
        </section>
        <article className="mx-auto max-w-4xl px-5 py-14 sm:py-18">
          <div className="space-y-12">
            {guide.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-2xl font-bold tracking-[-.025em] text-white sm:text-3xl">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-text-muted sm:text-base sm:leading-8">{paragraph}</p>)}
                {section.bullets && <ul className="mt-5 grid gap-2">{section.bullets.map((item) => <li key={item} className="flex gap-2 rounded-xl border border-white/[.07] bg-white/[.02] px-4 py-3 text-sm leading-6 text-text-muted"><CheckCircle2 size={15} className="mt-1 shrink-0 text-mint" />{item}</li>)}</ul>}
              </section>
            ))}
          </div>
          <div className="mt-14 rounded-[28px] border border-violet/25 bg-violet/[.06] p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-white">Put the guide into practice</h2>
            <p className="mt-2 text-sm leading-7 text-text-muted">Bring the source described above and give the creator a clear goal. Review the selected mode and credit estimate before generating.</p>
            <Button className="mt-5" asChild><Link href={guide.createHref}>Start creating <ArrowRight size={14} /></Link></Button>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {guide.related.map(([label, href]) => <Link key={href} href={href} className="rounded-2xl border border-white/[.08] bg-white/[.02] p-4 text-sm font-semibold text-white transition hover:border-violet/30">{label}<ArrowRight size={12} className="ml-1 inline" /></Link>)}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

export function WebsiteToVideoGuidePage() { return <GuidePage guide={guides.website} />; }
export function SaasProductVideoGuidePage() { return <GuidePage guide={guides.saas} />; }
export function ProductPageVideoGuidePage() { return <GuidePage guide={guides.product} />; }
export function PromptVideoGuidePage() { return <GuidePage guide={guides.promptVideo} />; }
export function ProductReferencesGuidePage() { return <GuidePage guide={guides.productReferences} />; }
export function InteriorDesignGuidePage() { return <GuidePage guide={guides.interiors} />; }
