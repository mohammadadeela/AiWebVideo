import { GoogleGenAI } from '@google/genai';

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export interface StoryboardScene {
  sceneNumber: number;
  durationSeconds: number;
  sceneType: 'hook' | 'feature' | 'interaction' | 'social_proof' | 'cta';
  shotDescription: string;
  /**
   * 0-based indexes into the capture list supplied to the planner.
   * For exact-capture video modes these are cropped/panned directly by the
   * renderer. For 'demo' (generative cinematic) mode these are only used as
   * brand/product visual REFERENCES fed into image generation — the scene's
   * actual pixels are AI-generated, not cropped from these captures.
   */
  sourceIndices?: number[];
  /** Deterministic edit layout. Exact-capture modes never regenerate website pixels; 'demo' mode scenes are always 'single' (one generated frame). */
  composition?: 'single' | 'sequence' | 'split' | 'triple';
  /** Camera-like motion. For exact-capture modes this is a crop/scale/position transform only; for 'demo' mode it is the same Ken-Burns-style move applied over one generated frame. */
  motion?: 'push_in' | 'pull_out' | 'pan_left' | 'pan_right' | 'pan_up' | 'pan_down' | 'static';
  /** Normalized focal point used by the deterministic cropper. */
  focusX?: number;
  focusY?: number;
  /**
   * Kept empty for every exact-capture mode and for 'photos', so renderers
   * never invent or rewrite website/campaign text. 'demo' mode is the one
   * exception: a short, truthful, grounded caption baked into the generated
   * frame by the image model is allowed (see DEMO_CREATIVE_POLICY) — never a
   * fabricated feature/claim.
   */
  onScreenCopy: string;
  transition: string;
}

export interface Storyboard {
  concept: string;
  vibe: string;
  ideas: string[];
  scenes: StoryboardScene[];
  /** Narration is disabled by default; audio treatment is handled separately. */
  voiceoverScript: string | null;
  targetDurationSeconds?: number;
  creativeBrief?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  outputQuality?: '1080p' | '4k';
  frameRate?: 30 | 60;
  /** Server-generated seed so each regeneration produces a genuinely new edit. */
  variantSeed?: number;
}

const STORYBOARD_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    concept: { type: 'STRING' as const, description: 'One-sentence production concept grounded in the captured website assets and the selected mode.' },
    vibe: { type: 'STRING' as const, description: 'The pacing and editorial mood.' },
    ideas: {
      type: 'ARRAY' as const,
      items: { type: 'STRING' as const },
      description: '3-5 alternate production ideas that obey the selected mode rules and customer brief.',
    },
    scenes: {
      type: 'ARRAY' as const,
      items: {
        type: 'OBJECT' as const,
        properties: {
          sceneNumber: { type: 'INTEGER' as const },
          durationSeconds: { type: 'NUMBER' as const },
          sceneType: {
            type: 'STRING' as const,
            enum: ['hook', 'feature', 'interaction', 'social_proof', 'cta'],
            description: 'Narrative role of the scene.',
          },
          shotDescription: {
            type: 'STRING' as const,
            description: 'Shot or image art direction grounded in the captured website references and selected mode.',
          },
          sourceIndices: {
            type: 'ARRAY' as const,
            items: { type: 'INTEGER' as const },
            description: 'EXACT-CAPTURE VIDEO: 1-3 zero-based CAPTURE indexes that must be used for this scene. DEMO: 0-3 CAPTURE indexes to use as brand/product visual references when generating this scene (not directly cropped). PHOTOS: use an empty array.',
          },
          composition: {
            type: 'STRING' as const,
            enum: ['single', 'sequence', 'split', 'triple'],
            description: 'EXACT-CAPTURE VIDEO deterministic edit layout. For PHOTOS and DEMO use single (DEMO scenes are one generated frame, never a collage of separately generated images).',
          },
          motion: {
            type: 'STRING' as const,
            enum: ['push_in', 'pull_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'static'],
            description: 'EXACT-CAPTURE VIDEO and DEMO: crop/scale motion applied to the frame (Ken Burns style). For PHOTOS use static.',
          },
          focusX: {
            type: 'NUMBER' as const,
            description: 'VIDEO/DEMO focal X from 0 to 1. 0=left, 0.5=center, 1=right.',
          },
          focusY: {
            type: 'NUMBER' as const,
            description: 'VIDEO/DEMO focal Y from 0 to 1. 0=top, 0.5=center, 1=bottom.',
          },
          onScreenCopy: {
            type: 'STRING' as const,
            description: 'MUST be "" for every mode except DEMO. For DEMO, either "" or a short truthful caption (real brand name/tagline/nav text only, never an invented feature claim) to bake into the generated frame.',
          },
          transition: {
            type: 'STRING' as const,
            description: 'Professional transition direction for video/demo; empty string is fine for photo scenes and the last scene.',
          },
        },
        required: ['sceneNumber', 'durationSeconds', 'sceneType', 'shotDescription', 'sourceIndices', 'composition', 'motion', 'focusX', 'focusY', 'onScreenCopy', 'transition'],
      },
    },
    voiceoverScript: {
      type: 'STRING' as const,
      nullable: true,
      description: 'MUST be null. No narration is created by the storyboard model.',
    },
  },
  required: ['concept', 'vibe', 'ideas', 'scenes', 'voiceoverScript'],
};

export interface StoryboardInput {
  siteUrl: string;
  pageTitle: string;
  description: string | null;
  screenshotBase64: string | null;
  fullPageScreenshotBase64: string | null;
  referenceCaptures?: Array<{ label: string; base64: string }>;
  mode: string; // video | photos | both | demo | tutorial | buy | tour
  vibeBrief: string;
  targetDurationSeconds: number;
  featuresText?: string | null;
  creativeBrief?: string | null;
  aspectRatio: '16:9' | '9:16' | '1:1';
  outputQuality: '1080p' | '4k';
  frameRate: 30 | 60;
  variationKey?: string;
}

/** Modes that describe a website-first walkthrough using only real captures. Rendering is exact-capture for these. 'demo' is a generative cinematic mode and is intentionally excluded. */
export const SCREEN_STYLE_MODES = ['tutorial', 'buy', 'tour'];

/** Modes whose scenes are AI-generated frames (imagen) animated by the same renderer, instead of cropped real screenshots. */
export const GENERATIVE_VIDEO_MODES = ['demo'];
export function isGenerativeVideoMode(mode: string) {
  return GENERATIVE_VIDEO_MODES.includes(mode);
}

const EXACT_CAPTURE_LOCK = `
NON-NEGOTIABLE EXACT-CAPTURE LOCK:
- The browser screenshots are immutable source footage. Every visible website pixel in the generated video must come from those exact screenshots.
- The smooth-scroll browser recording is a separate user deliverable/preview only. NEVER use it as footage inside the generated marketing video.
- NEVER redraw, regenerate, recreate, inpaint, translate, restyle, relabel, retouch, or reinterpret any part of the website.
- NEVER invent a product, model, page, button, cursor, click, checkout state, modal, logo, background, icon, or UI element.
- NEVER generate stock footage, AI lifestyle footage, AI product footage, device mockups, fake browser frames, or decorative imagery.
- NEVER add captions, titles, subtitles, slogans, CTA cards, URLs, animated typography, labels, or any other new text.
- Preserve Arabic and English exactly as rasterized in the original capture. Do not correct spelling, change characters, replace fonts, or synthesize text.
- Preserve logos, faces, products, colors, proportions, prices, buttons, and interface layout exactly.
- Creativity must come ONLY from editing: selecting real screenshots, precise crop/reframe, slow pan, gentle push/pull, split-screen/multi-panel compositions made from real screenshots, fast detail cut-ins, pacing, match cuts, clean wipes/slides, and restrained dissolves.
- A crop may hide part of a screenshot, but it may not change the visible pixels inside the crop.
- If a step/page/state is not visible in the captured assets, omit it. Never fabricate it.
- onScreenCopy MUST be "" for every scene. voiceoverScript MUST be null.
`;

const PREMIUM_EDITING_SYSTEM = `
PROFESSIONAL EDITING SYSTEM — THIS MUST FEEL AGENCY-EDITED:
- NEVER plan an 8-second scene as one continuous pan. Every 8-second scene must contain 2-3 distinct editorial beats that the deterministic renderer can execute.
- Individual beats should feel roughly 1.8-3.4 seconds long. Use fast detail cut-ins and clean resets rather than slow browsing.
- The first 1.5 seconds must immediately show one of the strongest real website visuals. No dead air, black intro, loading state, or generic opening.
- Alternate visual scale intentionally: wide page context → medium category/product area → tight detail, then reset to a new page.
- Use composition=sequence for page-to-page momentum, split for comparison/variety, triple for one short high-energy montage beat, and single for important readable hero/product moments.
- Across the whole video, aim for roughly 45-60% clean single/sequence scenes, 20-30% split scenes, and no more than 15-25% triple scenes. Do not make every scene a collage.
- Do not create a top-to-bottom full-page scroll. Full-page captures are reservoirs for targeted section crops only. Choose focusY to land directly on a useful visible section.
- Avoid using the same capture in adjacent scenes unless the second use is a clearly different focal region or scale.
- Match cuts should connect similar visual geometry (hero → hero, circular category → circular category, product grid → product grid) when possible.
- Use directional slides/wipes only when the visual flow supports them. Prefer fast fade/match cuts for product detail changes.
- In portrait output, prefer real mobile captures when they clearly contain useful content. Never select a blank, placeholder, loading, or low-information capture merely because it is mobile.
- Keep important Arabic/English text on screen long enough to remain readable, but never regenerate or overlay it.
- The closing 2-3 seconds must resolve on an existing strong branded or product-rich screenshot, not a fabricated CTA.
`;

const PHOTO_CREATIVE_POLICY = `
PHOTO MODE — CAPTURE-BASED CREATIVE EDITING:
- The captured website screenshots are visual REFERENCES and the source of truth for the real brand and products; unlike video mode, the final marketing photos MAY be creatively transformed.
- Follow the customer's written photo request closely. The user may ask for an ad, campaign visual, product hero, new background, studio setup, lifestyle treatment, seasonal scene, social creative, crop, lighting change, or other marketing edit.
- Preserve recognizable brand/product identity unless the customer explicitly asks to change a specific property.
- You may isolate products from the captured website and place them into newly created marketing environments when that matches the request.
- Do NOT invent unrelated products, logos, prices, product names, or brand claims.
- Do NOT generate random typography. onScreenCopy MUST be "" for every scene.
- If a website screenshot/UI is itself visible in the final marketing image, its existing Arabic/English text must stay faithful to the source; never translate, correct, replace, or redraw that UI text.
- Prefer a strong visual ad with no added text unless the user explicitly asks for marketing copy in their written instructions.
- The four photo scenes should be meaningfully different creative executions, not four near-identical crops.
- voiceoverScript MUST be null.
`;

const BOTH_MODE_POLICY = `
VIDEO + PHOTOS — TWO DIFFERENT PRESERVATION RULES:
- VIDEO OUTPUT is exact-capture only: screenshots are immutable source footage. The separate smooth-scroll recording is NOT used in the generated video. Never regenerate, redraw, translate, relabel, or change the visible website UI or text. Video creativity comes only from editing real screenshots.
- PHOTO OUTPUT may be creatively edited for marketing from the captured screenshots: new backgrounds, studio/lifestyle environments, product-hero compositions, campaign lighting, social-ad styling, and similar transformations are allowed when they follow the customer brief.
- In photos, preserve recognizable brand/product identity unless the customer explicitly asks to change a specific property.
- Never invent unrelated products, logos, prices, claims, or random typography.
- If real website UI remains visible in a photo, preserve its existing Arabic/English text faithfully rather than redrawing it.
- onScreenCopy MUST be "" for every scene. voiceoverScript MUST be null.
`;

const DEMO_CREATIVE_POLICY = `
DEMO MODE — GENERATIVE CINEMATIC BRAND FILM:
- Unlike every other video mode, DEMO scenes are NOT cropped from real screenshots. Each scene is ONE fully AI-generated cinematic frame (premium 3D device mockups, glassmorphism UI cards, soft studio/lifestyle backdrops, floating product shots), later given a single gentle camera move and cut together with the other scenes.
- The captured website screenshots are visual REFERENCES ONLY: the real logo, product photography, brand colors, and UI content shown inside a generated device mockup must be drawn from them. Never invent a different logo, product, or brand.
- Do NOT invent product names, prices, discount claims, review counts, user counts, or specific feature/capability claims (e.g. "AI Insights", "Global Payments") unless that exact wording is visibly present in the captured website's own text/navigation. If unsure whether a claim is real, leave it out.
- EVERY scene must share one consistent visual style, color grade, lighting direction, and set of props/materials (state this shared "style bible" explicitly in each shotDescription) so the scenes cut together as one coherent film instead of looking like unrelated stock images.
- onScreenCopy may be "" (preferred for most scenes) or one short, truthful, on-brand caption baked directly into the generated frame by the image model — only the real brand/site name, its real tagline/description text, or a real section/nav label taken verbatim from the capture. Never a fabricated slogan or feature name.
- Open with immediate visual impact (no black intro, no loading state) and close on a polished branded card: the real logo/name plus, if one exists in the capture, the real tagline — on the same shared studio backdrop as the rest of the film.
- No fake cursors, fake clicks, or simulated data changing — this is a brand film, not a captured product recording.
- voiceoverScript MUST be null.
`;

const CINEMATIC_SINGLE_SHOT_SYSTEM = `
GENERATIVE CINEMATIC SYSTEM — ONE FRAME, ONE MOVE PER SCENE:
- Each 8-second scene is exactly one generated frame animated with exactly one graceful camera move (push_in, pull_out, or a slow pan). Do not plan multiple editorial beats inside a scene — that technique is for exact-capture modes only.
- composition MUST be "single" for every scene.
- Vary shot scale and camera move across the film so it doesn't feel repetitive: e.g. wide environment reveal → device-mockup hero → UI/feature close-up → responsive multi-device shot → closing brand card.
- Keep the subject comfortably inside frame with headroom for the push/pull so nothing important is cropped off during the move.
- Describe lighting, materials, and mockup framing with enough precision that the same "world" (surface, light source, palette) is recognizable in every scene.
`;

const MODE_MASTER_DIRECTIONS: Record<string, string> = {
  video: `PROMO VIDEO — premium editorial website commercial.
Build a high-energy but elegant ad from the strongest real screenshots. Open with an immediate premium website reveal; then move through distinct real pages/sections with wide → medium → detail reframes. Create rhythm with 2-3 purposeful visual beats inside each scene: fast detail cut-ins, screenshot-to-screenshot sequences, tasteful two- or three-panel splits, then clean full-frame resets. Never use the smooth-scroll recording as footage. Avoid repeating the same page unless the second use reveals a clearly different crop/detail. End on an existing clean branded website view — never a generated end card. The result should feel like a luxury agency edit, not a slideshow and not a screen recording.`,

  tutorial: `HOW TO USE — clear first-time-user walkthrough using only captured states.
Teach the real website by sequencing the available screenshots/pages from orientation to useful outcomes. Use slower, readable framing, controlled pans, and screenshot-to-screenshot edits. Never use the smooth-scroll recording as generated-video footage. Never add a fake cursor, click animation, pointer ring, numbered step text, or fabricated interaction. If the capture does not show a state after an interaction, do not pretend it happened. Let the existing UI text carry the explanation. Keep each cut purposeful and easy to follow.`,

  buy: `HOW TO BUY — conversion-focused shopping journey using only real captured pages.
Use the captured storefront, category, product, cart, or checkout pages that actually exist. Sequence them in the closest real purchase order visible in the capture. Use clean match cuts between product/category/detail states and gentle push-ins on existing controls or prices without adding highlights or labels. Never invent size choices, add-to-cart clicks, cart states, checkout screens, payment confirmations, or order-success pages. If a stage was not captured, skip it rather than fabricating it.`,

  tour: `FEATURE TOUR — feature-by-feature tour of the real captured website.
Each scene should spotlight one actually visible feature, section, category, tool, or navigation area. Use wide context first, then precise crops/details. When two features benefit from comparison, use a clean split-screen made only from captured pages. Never add feature-name captions; the website's own text remains the only text. Follow owner-specified features when provided; otherwise detect the strongest visible features from the captures.`,

  demo: `SAAS/BRAND DEMO — generative cinematic product film (Apple/Stripe/Linear/Framer quality).
This is the one mode that does NOT stay inside the real screenshots. Build a premium, fully AI-generated brand film: 3D floating device mockups (tablet/phone) showing the real site's real UI content, glassmorphism feature cards, a soft lifestyle/studio backdrop (marble, soft daylight, gentle shadows), and light kinetic captions — all grounded in the real logo, products, brand colors, and real feature/nav text captured from the site. Every scene shares one consistent visual world (lighting, palette, materials) so the film feels directed, not like a stock-image slideshow. Never invent features, claims, prices, or a different brand than the one actually captured. End on a polished branded closing card.`,

  photos: `PHOTOS — premium marketing image creation from the real captured website.
Use the customer's description as the primary art direction. Plan four distinct campaign images grounded in the real products/brand visible in the captures. Explore useful marketing variations such as product-hero imagery, premium studio/background changes, editorial/lifestyle treatment, social-ad compositions, seasonal campaign treatment, or clean brand visuals — but only when consistent with what the user asked for. Do not add random text. If the user wants the website UI itself shown, keep that UI text faithful to the source instead of recreating it.`,

  both: `VIDEO + PHOTOS — exact website video plus creative marketing stills.
Plan the video as a premium exact-capture website commercial using only the real screenshots and no rewritten UI text. Keep the separate smooth-scroll recording out of the generated video. At the same time, make the photo direction suitable for creative campaign image generation from the captured products/brand: new marketing backgrounds, product-hero scenes, lifestyle/editorial treatment, or social creatives are allowed according to the user brief. Never invent unrelated products or random typography.`,
};

export function stableVariantSeed(value: string | undefined) {
  const text = value || `${Date.now()}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 9973;
}

function brandNameFrom(input: StoryboardInput) {
  return input.pageTitle.split(/[|\-–—:]/)[0]?.trim() || new URL(input.siteUrl).hostname;
}

export function buildFallbackStoryboard(input: StoryboardInput): Storyboard {
  const isPhotos = input.mode === 'photos';
  const isDemo = input.mode === 'demo';
  const sceneCount = isPhotos ? 4 : Math.max(1, Math.round(input.targetDurationSeconds / 8));
  const brandName = brandNameFrom(input);
  const variantSeed = stableVariantSeed(input.variationKey);
  const captureCount = Math.max(1, input.referenceCaptures?.length || Number(Boolean(input.screenshotBase64)) + Number(Boolean(input.fullPageScreenshotBase64)) || 1);
  const featureNames = input.featuresText
    ?.split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

  const fallbackDirections: Record<string, string[]> = {
    video: [
      'Open on the strongest real homepage capture with a polished full-frame reveal.',
      'Cut to a different captured page or section and use a controlled detail reframe.',
      'Use a fast screenshot sequence or a clean split-screen made from two captured pages.',
      'Finish on an existing clean branded website view with no added end card.',
    ],
    tutorial: [
      'Orient the viewer on the real homepage using a stable readable frame.',
      'Show the next available captured page or section in a logical first-time-user sequence.',
      'Use a clean screenshot-to-screenshot sequence to connect visible steps without inventing interaction.',
      'Finish on the clearest real outcome/state available in the capture.',
    ],
    buy: [
      'Open on the real storefront or category capture.',
      'Show a real product/category page available in the capture.',
      'Move to the next real purchase-related page that was actually captured.',
      'Finish on the furthest genuine shopping state available; do not invent checkout success.',
    ],
    tour: [
      'Reveal the homepage and the first strongest visible feature.',
      'Spotlight a second real feature or category with a closer crop.',
      'Use a split-screen of two genuine captures when it helps compare features.',
      'Finish on the strongest existing branded interface view.',
    ],
    demo: [
      'Open with a wide reveal of the real logo/brand mark floating in a soft studio environment (marble surface, warm daylight, gentle shadows).',
      'Show a 3D tablet mockup displaying the real captured homepage UI, framed with a glassmorphism accent card naming a real feature/section from the site.',
      'Show a second real UI area (product/category) inside a mockup, with a different camera move, same lighting world as the previous scene.',
      'Finish on a polished branded closing card: the real logo/name and, if present in the capture, the real tagline, on the same studio backdrop.',
    ],
    both: [
      'Open on the strongest real homepage capture.',
      'Move through a different real page or section with a detail crop.',
      'Use a fast screenshot sequence or split-screen for editorial rhythm.',
      'Finish on an existing branded website view.',
    ],
    photos: [
      'Create a premium hero marketing image based on the strongest real product or brand element in the captured website and the customer request.',
      'Create a second campaign variation with a meaningfully different composition, background, lighting, or product emphasis while preserving product identity.',
      'Create a social/editorial marketing variation derived from the real captured products or brand and the customer request; avoid random text.',
      'Create a polished fourth campaign image with a distinct art direction that still clearly belongs to the same real brand and request.',
    ],
  };
  const directions = fallbackDirections[input.mode] ?? fallbackDirections.video;

  const scenes = Array.from({ length: sceneCount }, (_, index): StoryboardScene => {
    const isFirst = index === 0;
    const isLast = index === sceneCount - 1;
    const feature = featureNames[index - 1];
    return {
      sceneNumber: index + 1,
      durationSeconds: isPhotos ? 0 : 8,
      sceneType: isFirst ? 'hook' : isLast ? 'cta' : 'feature',
      shotDescription: feature
        ? (isPhotos
          ? `Use the captured website area that visibly represents “${feature}” as the source reference for a premium marketing image. Follow the customer's photo request and preserve recognizable brand/product identity.`
          : isDemo
            ? `Generate one cinematic frame (device mockup or feature card, same lighting world as the rest of the film) built from the captured area that visibly represents “${feature}”. Use only real brand/product/text elements from that capture — never invent the claim.`
            : `Spotlight the captured website area that visibly represents “${feature}”. Use only the exact pixels from that capture with a readable crop/pan and no overlays.`)
        : directions[Math.min(index, directions.length - 1)],
      sourceIndices: isPhotos ? [] : [((index + variantSeed) % captureCount)],
      composition: (isPhotos || isDemo) ? 'single' : ((index + variantSeed) % 5 === 2 ? 'split' : (index + variantSeed) % 3 === 1 ? 'sequence' : 'single'),
      motion: isPhotos ? 'static' : (['push_in', 'pan_right', 'pan_left', 'pan_down', 'pull_out'] as const)[(index + variantSeed) % 5],
      focusX: isPhotos ? 0.5 : 0.32 + ((variantSeed + index * 17) % 37) / 100,
      focusY: isPhotos ? 0.5 : isFirst ? 0.22 + (variantSeed % 10) / 100 : isLast ? 0.18 + (variantSeed % 14) / 100 : 0.34 + ((variantSeed + index * 11) % 34) / 100,
      onScreenCopy: '',
      transition: isLast ? '' : isDemo ? 'Clean cinematic dissolve into the next generated frame.' : 'Clean editorial handoff using only exact captured frames.',
    };
  });

  return {
    concept: isPhotos
      ? `${brandName} turned into a premium marketing photo set using its real captured website as the brand/product reference.`
      : isDemo
        ? `${brandName} presented as a generative cinematic brand film — AI-composited device mockups and feature cards grounded in its real logo, products, and captured brand content.`
        : `${brandName} presented as a premium edit made entirely from its real captured website pixels.`,
    vibe: input.vibeBrief,
    ideas: isPhotos
      ? [
          'Premium product-hero campaign based on the real captured product imagery',
          'Editorial/social marketing variation with a new art-directed environment',
          'Clean commercial campaign set with distinct compositions and no random typography',
        ]
      : isDemo
        ? [
            'Device-mockup-led brand film with glassmorphism feature cards',
            'Lifestyle/studio product-hero film ending on a branded closing card',
            'Responsive-design showcase moving from desktop to tablet to phone mockups',
          ]
        : [
          'Editorial page-to-page reveal with restrained split screens',
          'Fast detail-led website montage using real captured sections',
          'Fast screenshot sequence and match-cut journey through the real interface',
        ],
    scenes,
    voiceoverScript: null,
    targetDurationSeconds: isPhotos ? 0 : sceneCount * 8,
    creativeBrief: input.creativeBrief?.trim() || undefined,
    aspectRatio: input.aspectRatio,
    outputQuality: input.outputQuality,
    frameRate: input.frameRate,
    variantSeed,
  };
}

export function storyboardModelName() {
  return process.env.GEMINI_STORYBOARD_MODEL ?? 'gemini-3.6-flash';
}

type PlannerPart = { inlineData: { mimeType: string; data: string } } | { text: string };

export interface PlannerPrompt {
  prompt: string;
  captureParts: PlannerPart[];
  captureCount: number;
  sceneCount: number;
  variantSeed: number;
  isPhotos: boolean;
  isDemo: boolean;
}

/**
 * Deterministic prompt assembly for the storyboard planner. Exported so the
 * automated tests can prove each feature/mode actually delivers its own master
 * direction plus the correct capture-preservation policy to the model.
 */
export function buildStoryboardPrompt(input: StoryboardInput): PlannerPrompt {
  const {
    siteUrl, pageTitle, description,
    screenshotBase64, fullPageScreenshotBase64, referenceCaptures,
    mode, vibeBrief, targetDurationSeconds, featuresText,
    creativeBrief, aspectRatio, outputQuality, frameRate, variationKey,
  } = input;

  const captureParts: PlannerPart[] = [];
  const labeledCaptures = (referenceCaptures ?? []).filter((capture) => capture.base64).slice(0, 10);
  if (labeledCaptures.length > 0) {
    labeledCaptures.forEach((capture, index) => {
      captureParts.push({ text: `CAPTURE ${index}: ${capture.label}` });
      captureParts.push({ inlineData: { mimeType: 'image/jpeg', data: capture.base64 } });
    });
  } else {
    if (screenshotBase64) {
      captureParts.push({ text: 'CAPTURE 0: Homepage viewport screenshot' });
      captureParts.push({ inlineData: { mimeType: 'image/jpeg', data: screenshotBase64 } });
    }
    if (fullPageScreenshotBase64) {
      captureParts.push({ text: `CAPTURE ${screenshotBase64 ? 1 : 0}: Homepage full-page screenshot` });
      captureParts.push({ inlineData: { mimeType: 'image/jpeg', data: fullPageScreenshotBase64 } });
    }
  }
  const captureCount = labeledCaptures.length || Number(Boolean(screenshotBase64)) + Number(Boolean(fullPageScreenshotBase64));

  const isPhotos = mode === 'photos';
  const isDemo = mode === 'demo';
  const sceneCount = isPhotos ? 4 : Math.max(1, Math.round(targetDurationSeconds / 8));
  const brandName = brandNameFrom(input);
  const modeDirection = MODE_MASTER_DIRECTIONS[mode] ?? MODE_MASTER_DIRECTIONS.video;
  const variantSeed = stableVariantSeed(variationKey);

  const featuresBlock = featuresText?.trim()
    ? `OWNER-REQUESTED FEATURES: ${featuresText.trim()}\nUse them only when they are visibly present in the captured website. Never fabricate a missing feature.`
    : mode === 'tour'
      ? 'No features were specified. Detect the strongest features that are actually visible in the screenshots.'
      : '';

  const structureBlock = isPhotos
    ? `Create exactly 4 marketing-photo scenes. Each scene should be a distinct image-generation/editing direction grounded in the captured website references and the customer's request.`
    : isDemo
      ? `Create exactly ${sceneCount} scenes of 8 seconds each (about ${sceneCount * 8}s total). Each scene is ONE generated cinematic frame with ONE camera move (see the generative cinematic system below) — do not plan multi-beat edit sequences. Vary shot type scene to scene (environment reveal, device-mockup hero, feature-card close-up, responsive multi-device shot) while keeping one consistent visual world across all scenes. Close on a polished branded card.`
      : `Create exactly ${sceneCount} scenes of 8 seconds each (about ${sceneCount * 8}s total). Each 8-second scene is an EDIT SEQUENCE, not one long shot: plan 2-3 purposeful visual beats using sourceIndices/composition/motion. Favor sequence, split, and triple compositions where they improve rhythm, while keeping enough single frames for readability. Use a clear hook, distinct middle beats, and a clean final website frame. The final video frame must already exist in the captured website; never request a generated CTA card.`;

  const capturePolicy = mode === 'photos'
    ? PHOTO_CREATIVE_POLICY
    : mode === 'both'
      ? BOTH_MODE_POLICY
      : isDemo
        ? DEMO_CREATIVE_POLICY
        : EXACT_CAPTURE_LOCK;

  const prompt = `You are an elite commercial director and storyboard planner. Ground every decision in the real browser captures and obey the selected mode's preservation rules.

PROJECT
SITE: ${siteUrl}
BRAND: ${brandName}
PAGE TITLE: ${pageTitle}
DESCRIPTION: ${description ?? 'not available'}
MODE: ${mode}
REQUESTED MOOD: ${vibeBrief}
CUSTOM USER NOTES: ${creativeBrief?.trim() || 'No extra notes — use the strongest professional direction for this mode.'}
DELIVERY: ${aspectRatio}, ${outputQuality === '4k' ? '4K' : '1080p'}, ${frameRate} FPS
CREATIVE VARIATION ID: ${variantSeed}
This is a fresh generation attempt. Use the variation ID to deliberately choose a different shot order, crop rhythm, source mix, composition pattern, and transitions than a generic/default edit while still obeying every exact-capture rule.
${featuresBlock ? `\n${featuresBlock}\n` : ''}

MODE-SPECIFIC MASTER DIRECTION
${modeDirection}

${capturePolicy}

${isPhotos ? '' : isDemo ? CINEMATIC_SINGLE_SHOT_SYSTEM : PREMIUM_EDITING_SYSTEM}

CAPTURE CONTEXT
${captureCount > 0
  ? `Attached are ${captureCount} labeled real website screenshots. CAPTURE indexes are zero-based and sourceIndices MUST refer only to those indexes. Study every attached capture and deliberately choose the strongest page/section for each scene. The separate smooth-scroll recording is a user preview/download only and is NOT available to the generated-video editor. Photo mode and Demo mode may use the screenshots as references for the generated marketing imagery.`
  : 'No screenshot is attached to planning. Stay conservative, follow the customer brief, and do not invent brand/product facts.'}

STRUCTURE
${structureBlock}

OUTPUT REQUIREMENTS
- concept: one sharp sentence describing the production concept for this selected mode.
- ideas: 3-5 alternate approaches that obey the selected mode policy and customer request.
- scenes: for EXACT-CAPTURE VIDEO modes, every shotDescription should specify exact-capture editing actions only (real page/section, wide/medium/detail framing, crop/pan, screenshot sequence, split/multi-panel use, pacing, transition intent). For PHOTOS, each shotDescription should be a strong, distinct marketing-image art direction grounded in the captures and customer request. For DEMO, each shotDescription should be a precise, self-contained cinematic-frame art direction (device mockup / feature card / lifestyle shot) that explicitly restates the shared style bible (lighting, palette, materials) so every generated frame belongs to the same film.
- sourceIndices: EXACT-CAPTURE VIDEO must contain 1-3 valid CAPTURE indexes. Use one for single, 2-3 for sequence, exactly 2 for split, exactly 3 for triple when enough captures exist. PHOTOS uses []. DEMO uses 0-3 valid CAPTURE indexes as generation references (brand/product/UI content to depict), never for direct cropping.
- composition: EXACT-CAPTURE VIDEO chooses single, sequence, split, or triple. PHOTOS and DEMO always use single.
- motion: EXACT-CAPTURE VIDEO and DEMO choose crop/scale motion (push_in, pull_out, pan_left, pan_right, pan_up, pan_down, static). PHOTOS uses static.
- focusX/focusY: EXACT-CAPTURE VIDEO and DEMO use values from 0 to 1 that place the important content inside the crop. Do not center blindly. PHOTOS use 0.5/0.5.
- onScreenCopy: "" for every scene in every mode except DEMO, where a short truthful on-brand caption (real name/tagline/nav text only) is optionally allowed. Never invent website or campaign typography.
- voiceoverScript: ALWAYS null.
- video/demo transitions: premium and restrained — clean dissolve, smooth directional slide, wipe, match cut, or split-screen handoff. No glitch, spin, 3D cube, particle, or generated graphic transition.

For exact-capture video, never synthesize, animate, correct, or rewrite website text. For photos and demo, creative visual generation is allowed by their respective policies, but inventing unrelated products, prices, or feature claims is not.`;

  return { prompt, captureParts, captureCount, sceneCount, variantSeed, isPhotos, isDemo };
}

export interface StoryboardResult {
  storyboard: Storyboard;
  /**
   * The exact reason the Gemini planner could not be used, when a fallback
   * plan had to be substituted. Null when Gemini produced the plan itself.
   * Callers are expected to surface this to the user verbatim (it is our own
   * caught Error#message, never a raw stack trace or secret).
   */
  aiError: string | null;
}

function describeStoryboardError(err: unknown, model: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Normalize the most common Gemini failure shapes into something short and
  // exact, without inventing detail we don't actually have.
  return `Gemini storyboard model "${model}" failed: ${raw}`;
}

export async function generateStoryboard(input: StoryboardInput): Promise<StoryboardResult> {
  const { mode, creativeBrief, aspectRatio, outputQuality, frameRate } = input;
  const { prompt, captureParts, captureCount, sceneCount, variantSeed, isPhotos, isDemo } = buildStoryboardPrompt(input);
  const model = storyboardModelName();
  console.info(`[storyboard] model=${model} mode=${mode} variation=${variantSeed} captures=${captureCount} scenes=${sceneCount}`);

  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [...captureParts, { text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: STORYBOARD_SCHEMA as Parameters<typeof client.models.generateContent>[0]['config'] extends { responseSchema?: infer T } ? T : never,
        temperature: 0.72,
      },
    });

    const text = response.text ?? '';
    const parsed = JSON.parse(text) as Storyboard;
    parsed.targetDurationSeconds = isPhotos ? 0 : sceneCount * 8;
    parsed.creativeBrief = creativeBrief?.trim() || undefined;
    parsed.aspectRatio = aspectRatio;
    parsed.outputQuality = outputQuality;
    parsed.frameRate = frameRate;
    parsed.variantSeed = variantSeed;
    parsed.voiceoverScript = null;
    parsed.scenes = (parsed.scenes ?? []).slice(0, sceneCount).map((scene, index) => ({
      ...scene,
      sceneNumber: index + 1,
      durationSeconds: isPhotos ? 0 : 8,
      sourceIndices: isPhotos
        ? []
        : (scene.sourceIndices ?? [index % Math.max(1, captureCount)]).filter((value) => Number.isInteger(value) && value >= 0 && value < Math.max(1, captureCount)).slice(0, 3),
      composition: (isPhotos || isDemo) ? 'single' : (scene.composition ?? 'single'),
      motion: isPhotos ? 'static' : (scene.motion ?? 'push_in'),
      focusX: Math.max(0, Math.min(1, Number(scene.focusX ?? 0.5))),
      focusY: Math.max(0, Math.min(1, Number(scene.focusY ?? 0.5))),
      // Every mode keeps onScreenCopy empty except DEMO, whose policy allows
      // one short, truthful, brand-grounded caption baked into the generated
      // frame itself. Hard-capped so a runaway caption can't happen.
      onScreenCopy: isDemo && typeof scene.onScreenCopy === 'string' ? scene.onScreenCopy.trim().slice(0, 60) : '',
      transition: index === sceneCount - 1 ? '' : scene.transition,
    }));
    if (!isPhotos) {
      parsed.scenes = parsed.scenes.map((scene, index) => ({
        ...scene,
        sourceIndices: scene.sourceIndices?.length ? scene.sourceIndices : [index % Math.max(1, captureCount)],
      }));
    }
    if (parsed.scenes.length !== sceneCount) {
      const aiError = `Gemini storyboard model "${model}" returned ${parsed.scenes.length}/${sceneCount} scenes (an incomplete plan), so the built-in backup plan was used instead.`;
      console.warn(`[storyboard] ${aiError}`);
      return { storyboard: buildFallbackStoryboard(input), aiError };
    }
    return { storyboard: parsed, aiError: null };
  } catch (err) {
    const aiError = describeStoryboardError(err, model);
    console.error(`[storyboard] ${aiError}`);
    return { storyboard: buildFallbackStoryboard(input), aiError };
  }
}
