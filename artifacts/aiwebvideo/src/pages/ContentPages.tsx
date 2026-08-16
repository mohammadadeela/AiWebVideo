import { Link } from 'wouter';
import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/app-button';
import { useSeo } from '@/lib/useSeo';

function Shell({ eyebrow, title, intro, description, path, children }: { eyebrow: string; title: string; intro: string; description: string; path: string; children: React.ReactNode }) {
  useSeo({ title, description, path });
  return <><Nav /><main><section className="border-b border-border"><div className="mx-auto max-w-4xl px-5 py-20 text-center"><p className="font-utility text-xs uppercase tracking-[.2em] text-violet">{eyebrow}</p><h1 className="mt-4 font-display text-4xl font-bold text-text-primary sm:text-5xl">{title}</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-text-muted">{intro}</p></div></section>{children}<CTA /></main><Footer /></>;
}

function CTA() {
  return <section className="border-t border-border"><div className="mx-auto max-w-4xl px-5 py-16 text-center"><h2 className="font-display text-2xl font-bold text-text-primary">Turn your website into a campaign</h2><p className="mt-2 text-sm text-text-muted">Start with a real multi-page preview, then choose the production that fits.</p><Link href="/#generate"><Button className="mt-6">Build a website preview</Button></Link></div></section>;
}

const features = [
  ['Multi-page website capture', 'Captures key pages after they finish loading, plus a smooth-scroll recording, brand colors, and the website icon or logo.'],
  ['Complete production modes', 'Create promos, tutorials, purchase walkthroughs, feature tours, SaaS demos, photos, combined campaigns, or four new website-icon concepts.'],
  ['Intelligent media planning', 'Select or focus specific captured photos/pages, receive a suitable duration recommendation, choose 8 seconds to 4 minutes, and see the exact credit requirement before generation.'],
  ['Website-first storyboards', 'Every scene is planned around the captured interface, page content, calls to action, and brand identity.'],
  ['Professional delivery', 'Landscape, portrait, 1080p, and premium 4K 60 delivery options with downloadable files.'],
  ['Saved account workspace', 'Return to projects, watch live progress, review creative plans, and download completed assets.'],
];

export function FeaturesPage() {
  return <Shell eyebrow="Product" title="A complete website content studio" intro="From capture to final delivery, every step is designed for marketers, founders, agencies, and online stores that need polished content without a traditional production workflow." description="Explore AiWebVideo's features: multi-page website capture, AI video and image production, website-icon concepts, flexible audio, and 1080p/4K mastered delivery." path="/features"><section><div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-2 lg:grid-cols-3">{features.map(([title, body], index) => <article key={title} className="rounded-3xl border border-border bg-panel p-6"><span className="font-utility text-xs text-violet">0{index + 1}</span><h2 className="mt-5 font-display text-lg font-semibold text-text-primary">{title}</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p></article>)}</div></section></Shell>;
}

const steps = [
  ['Paste a public website URL', 'The secure capture studies the real pages, screenshots, scrolling behavior, brand colors, visible features, and website icon.'],
  ['Choose the production', 'Pick a promo, tutorial, purchase guide, feature tour, SaaS demo, photo set, complete bundle, or website-icon concept set.'],
  ['Direct the creative', 'Set duration, format, and audio, then explain the audience, scenes, mood, products, messages, and anything to avoid.'],
  ['Review and produce', 'Approve the storyboard, follow real progress and estimated time, then download the completed files.'],
];

export function HowItWorksPage() {
  return <Shell eyebrow="Workflow" title="From URL to finished creative" intro="The studio turns a website into an organized production while keeping you in control of the brief and output." description="See how AiWebVideo works: paste a website URL, choose a production type, direct the creative in chat, then review and download real AI-generated video." path="/how-it-works"><section><div className="mx-auto max-w-4xl px-5 py-16"><div className="space-y-4">{steps.map(([title, body], index) => <article key={title} className="grid gap-4 rounded-3xl border border-border bg-panel p-6 sm:grid-cols-[64px_1fr]"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signature font-utility font-bold text-white">{index + 1}</div><div><h2 className="font-display text-xl font-semibold text-text-primary">{title}</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p></div></article>)}</div><div className="mt-8 rounded-3xl border border-mint/20 bg-mint/5 p-6"><h2 className="font-display text-lg font-semibold text-text-primary">Built for reliable progress</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">Long-running projects stay in account history, report their current phase, percentage and estimated time, and restore reserved production credits when a paid render fails.</p></div></div></section></Shell>;
}

export function AboutPage() {
  return <Shell eyebrow="Company" title="Professional website content, without the production maze" intro="AiWebVideo exists to help a business explain and market its real website through visual content that feels specific, intentional, and ready to publish." description="Learn about AiWebVideo's approach: website-first, customer-directed AI video and photo production with a clear, transparent workflow." path="/about"><section><div className="mx-auto grid max-w-5xl gap-5 px-5 py-16 md:grid-cols-3">{[['Website first', 'The real site—not a generic template—is the foundation of every project.'], ['Customer directed', 'The owner controls the format, message, style, audience, and final production choice.'], ['Clear workflow', 'Saved history, visible progress, estimated time, and credit protection make production easier to manage.']].map(([title, body]) => <article key={title} className="rounded-3xl border border-border bg-panel p-6"><h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p></article>)}</div></section></Shell>;
}

const faqs = [
  ['What can I create?', 'Promo videos, website tutorials, purchase walkthroughs, feature tours, SaaS demos, marketing photos, combined campaigns, and four creative website-icon concepts.'],
  ['Does it use my real website?', 'Yes. The workflow captures public pages, waits for content to load, records scrolling, and preserves visible brand details and the website icon. Video productions use that real icon and website name in a polished closing card.'],
  ['Can I write my own brief?', 'Yes. You can describe the exact audience, scenes, camera feeling, colors, products, messages, sound, call to action, and details to avoid.'],
  ['Can I make a video without talking?', 'Yes. Choose Voice + music, Music only · no talking, or Silent master before production. English is the default speaking language when voice is selected, and you can change it.'],
  ['What if I have many photos or pages?', 'The studio counts the usable references and recommends one complete 8-second scene per selected item. You can select all, focus specific photos for a shorter video, or choose a custom length up to four minutes. It shows the exact credits and any shortfall before generation.'],
  ['How long does generation take?', 'Capture and planning usually take a few minutes. Final video production varies by duration and format; the workspace shows the current percentage and an updated estimated time.'],
  ['What happens if production fails?', 'A failed paid render restores the production credits reserved for the unfinished work. The project remains available in history so you can review it or try again.'],
  ['Are my website and account private?', 'Only public website pages are captured. Account history and downloadable outputs require your authenticated session.'],
];

export function FaqPage() {
  return <Shell eyebrow="Help" title="Frequently asked questions" intro="Straight answers about the production workflow, credits, timing, and your saved projects." description="Answers to common questions about AiWebVideo: what you can create, how long generation takes, credit refunds, and account privacy." path="/faq"><section><div className="mx-auto max-w-3xl space-y-3 px-5 py-16">{faqs.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-border bg-panel p-5"><summary className="cursor-pointer list-none font-display text-base font-semibold text-text-primary">{question}<span className="float-right text-violet group-open:rotate-45">＋</span></summary><p className="mt-3 pr-6 text-sm leading-relaxed text-text-muted">{answer}</p></details>)}</div></section></Shell>;
}

function LegalPage({ title, intro, description, path, sections }: { title: string; intro: string; description: string; path: string; sections: Array<[string, string]> }) {
  return <Shell eyebrow="Legal · Updated August 5, 2026" title={title} intro={intro} description={description} path={path}><section><div className="mx-auto max-w-3xl space-y-8 px-5 py-16">{sections.map(([heading, body]) => <article key={heading}><h2 className="font-display text-xl font-semibold text-text-primary">{heading}</h2><p className="mt-3 text-sm leading-7 text-text-muted">{body}</p></article>)}</div></section></Shell>;
}

export function PrivacyPage() {
  return <LegalPage title="Privacy notice" intro="This notice explains the main information handled when you use AiWebVideo." description="AiWebVideo's privacy notice: what account, website, and billing information is processed, how it's used, and your choices." path="/privacy" sections={[
    ['Information you provide', 'We process account details, website URLs, creative instructions, and billing identifiers needed to provide the service. Payment card details are handled by the payment provider and are not stored directly by this application.'],
    ['Website capture and generated files', 'When you submit a URL, the service accesses publicly available pages and creates screenshots, recordings, plans, and output files for your project. Do not submit private pages or content you are not authorized to use.'],
    ['How information is used', 'Information is used to authenticate accounts, run productions, save project history, deliver files, prevent misuse, support billing, and improve reliability.'],
    ['Retention and security', 'Project records and files may be retained so they remain available in your account. Reasonable technical safeguards are used, but no online service can guarantee absolute security.'],
    ['Your choices', 'You can stop using the service, sign out of shared devices, and request help regarding account or project information through the support channel provided with your account.'],
  ]} />;
}

export function TermsPage() {
  return <LegalPage title="Terms of service" intro="These terms describe the basic rules for using AiWebVideo and its production features." description="AiWebVideo's terms of service: account responsibilities, content rights, credits and billing, acceptable use, and service availability." path="/terms" sections={[
    ['Your account', 'Provide accurate account information, protect your login, and use the service only for lawful business or creative purposes. You are responsible for activity performed through your account.'],
    ['Rights to submitted content', 'Only submit websites, trademarks, images, instructions, and other materials you own or are authorized to use. You remain responsible for reviewing generated files before publishing them.'],
    ['Credits and billing', 'Plans and production options use the prices and credits shown at checkout. Failed paid renders restore credits reserved for unfinished work. Fees already consumed by completed work are not automatically refundable.'],
    ['Acceptable use', 'Do not use the service to violate rights, impersonate others, distribute unlawful material, attack systems, or attempt to bypass security and billing controls.'],
    ['Service availability', 'Production time and output can vary with website complexity and system demand. Features may change as reliability and quality improve. The service is provided without a guarantee that every submitted website can be captured or rendered.'],
  ]} />;
}
