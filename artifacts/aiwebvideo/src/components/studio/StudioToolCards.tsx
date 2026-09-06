import { Link } from 'wouter';
import {
  ArrowRight,
  Check,
  ImagePlus,
  MessageCircleMore,
  MousePointerClick,
  Play,
  Film,
  type LucideIcon,
} from 'lucide-react';
import { STUDIO_CONFIGS, STUDIO_ORDER, type StudioKind } from '@/lib/studioConfig';

interface StudioCardMeta {
  icon: LucideIcon;
  kicker: string;
  bestFor: string;
  description: string;
  outputs: [string, string];
  cta: string;
  accent: string;
  glow: string;
  iconStyle: string;
  pillStyle: string;
  borderHover: string;
}

const STUDIO_CARD_META: Record<StudioKind, StudioCardMeta> = {
  product: {
    icon: ImagePlus,
    kicker: 'Product studio',
    bestFor: 'Products, shops & campaigns',
    description: 'Upload real product photos and turn them into polished campaign images, ads, and video.',
    outputs: ['Marketing photo set', 'Product promo video'],
    cta: 'Create product content',
    accent: 'from-amber-400 via-orange-500 to-pink-500',
    glow: 'bg-orange-500/20',
    iconStyle: 'border-orange-300/25 bg-orange-400/10 text-orange-200',
    pillStyle: 'border-orange-300/20 bg-orange-400/10 text-orange-100',
    borderHover: 'hover:border-orange-300/45 hover:shadow-[0_24px_60px_-32px_rgba(249,115,22,.85)]',
  },
  idea: {
    icon: Film,
    kicker: 'Text to video',
    bestFor: 'Any original idea',
    description: 'Write what you imagine and AI will plan the shots and generate the complete video for you.',
    outputs: ['Your written idea', 'Complete AI video'],
    cta: 'Turn my idea into video',
    accent: 'from-violet via-fuchsia-500 to-pink',
    glow: 'bg-violet/25',
    iconStyle: 'border-violet/30 bg-violet/15 text-violet-200',
    pillStyle: 'border-violet/25 bg-violet/10 text-violet-100',
    borderHover: 'hover:border-violet/60 hover:shadow-[0_24px_60px_-32px_rgba(139,92,246,.95)]',
  },
  scenario: {
    icon: MessageCircleMore,
    kicker: 'People & dialogue',
    bestFor: 'Talking scenes & stories',
    description: 'Describe the people, conversation, and setting to create a cinematic scene with natural audio.',
    outputs: ['Scripted conversation', 'Voices + scene video'],
    cta: 'Create a talking scene',
    accent: 'from-cyan-400 via-violet to-pink-500',
    glow: 'bg-cyan-400/20',
    iconStyle: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
    pillStyle: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50',
    borderHover: 'hover:border-cyan-300/45 hover:shadow-[0_24px_60px_-32px_rgba(34,211,238,.75)]',
  },
};

export function StudioToolCards({ className = '', detailed = false }: { className?: string; detailed?: boolean }) {
  return (
    <div className={`grid gap-3 sm:gap-4 md:grid-cols-3 ${className}`}>
      {STUDIO_ORDER.map((kind, index) => {
        const config = STUDIO_CONFIGS[kind];
        const meta = STUDIO_CARD_META[kind];
        const Icon = meta.icon;

        return (
          <Link
            key={kind}
            href={config.path}
            aria-label={`${meta.cta}. ${meta.description}`}
            onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })}
            className={`group relative flex min-h-[300px] cursor-pointer flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#151027]/90 p-5 text-left shadow-[0_20px_55px_-38px_rgba(0,0,0,.95)] transition-all duration-300 hover:-translate-y-1.5 hover:bg-[#1b1432] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${meta.borderHover}`}
          >
            <span className={`pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100 ${meta.glow}`} aria-hidden="true" />
            <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`} aria-hidden="true" />

            <span className="relative flex items-start justify-between gap-3">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-inner ${meta.iconStyle}`}>
                <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-text-muted transition-colors group-hover:text-white">
                <MousePointerClick size={11} aria-hidden="true" />
                Click to open
              </span>
            </span>

            <span className="relative mt-5">
              <span className="font-utility text-[10px] font-bold uppercase tracking-[.16em] text-mint">0{index + 1} · {meta.kicker}</span>
              <span className="mt-2 block font-display text-xl font-bold leading-tight text-white">{config.navLabel}</span>
              <span className="mt-2 block text-[11px] font-semibold text-violet-200">Best for: {meta.bestFor}</span>
              <span className="mt-2.5 block text-[12px] leading-relaxed text-text-muted">{detailed ? config.subheading : meta.description}</span>
            </span>

            <span className="relative mt-4 grid grid-cols-1 gap-2">
              {meta.outputs.map((output) => (
                <span key={output} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-medium ${meta.pillStyle}`}>
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                  {output}
                </span>
              ))}
            </span>

            {detailed && <span className="relative mt-3 block text-[10px] font-semibold text-mint">{config.startingCreditsNote}</span>}

            <span className={`premium-button relative mt-auto flex w-full items-center justify-between rounded-xl bg-gradient-to-r px-3 py-3 text-xs sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm font-bold text-white shadow-lg transition-all group-hover:brightness-110 ${meta.accent}`}>
              <span>{meta.cta}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function StudioChoiceHint() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] font-semibold text-text-muted">
      <Play size={12} className="fill-current text-mint" aria-hidden="true" />
      Choose one card to start
    </span>
  );
}
