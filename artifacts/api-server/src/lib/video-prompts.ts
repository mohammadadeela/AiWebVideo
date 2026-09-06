import type { StoryboardScene } from './gemini.js';

export const VIDEO_MASTER_PROMPTS: Record<string, string> = {

  "ai-video": `AI VIDEO — ORIGINAL PROMPT-DRIVEN FILM
Create one coherent original AI-generated film directly from the customer's written idea. Do not introduce website, ecommerce, dashboard, browser, or product-ad language unless the customer actually asked for it. Optional reference images are identity/style anchors only. Preserve any referenced person, product, place or object consistently for the entire film. Follow the requested narrative, mood, action, camera and audio direction with a complete beginning-to-ending arc.`,

  "product-video": `PRODUCT VIDEO — REFERENCE-FAITHFUL COMMERCIAL FILM
Create one premium continuous product film grounded in the customer's real product images. Preserve exact product shape, proportions, materials, colors, logos, stitching, hardware, packaging and small details. Never redesign or substitute the product. Build an elegant commercial arc around the real item using believable motion, macro details, hero angles, lighting and environments that support the customer's brief. Do not invent prices, claims, labels or readable packaging text.`,

  "talking-scene": `TALKING SCENE — PERFORMANCE-FIRST CONTINUOUS VIDEO
Create one coherent dialogue/performance video from the customer's scenario. Preserve speaker identity, wardrobe, setting and eyelines throughout. Make speech, mouth movement, gestures, reactions, pauses and turn-taking feel natural. If exact dialogue is supplied, keep the spoken wording faithful and do not add unrelated lines. Optional reference images are identity/style anchors, not separate scenes. Use professional camera blocking and audio continuity from beginning to end.`,
  video: `PROMO VIDEO — AI-GENERATED WEBSITE COMMERCIAL
Create a real AI-generated commercial, not a slideshow and not a screen recording. Study the supplied website captures and identify what the website actually sells or does. Lead with cinematic product, service, customer, environment, and benefit imagery grounded in the real site; use recognizable website UI selectively as proof, not as the whole film. Preserve the real brand, products, colors, navigation, and visible facts. Animate UI only when a real visible control and real result support the action. Build a strong advertising arc: immediate hook, distinct real benefits/products, satisfying action, and a clean visual resolution. Never create a fake logo/title card and never repeat the same page or movement to fill time.`,

  tutorial: `HOW TO USE — AI-GENERATED GUIDED WALKTHROUGH
Create a clear, believable AI-generated walkthrough of this exact website. Infer the useful first-time-user journey from the captures. Show the cursor or touch indicator moving naturally to real visible controls, clicking them, and then arriving at the next real captured state. Use readable pacing around important UI, but keep the video alive and polished. Never invent a feature, button result, page, menu, form state, or success state that is not grounded by the supplied captures.`,

  buy: `HOW TO BUY / CONVERT — AI-GENERATED TRANSACTION JOURNEY
First determine the website type from the captures. If it is ecommerce, create the real purchase journey that the available states support: browse/category → real product → real option/size/color when visible → add to cart → cart → checkout when captured. If it is a service/SaaS/booking website, adapt the same conversion logic to the real flow that is visible (for example plan selection, booking, signup, or checkout) instead of forcing an ecommerce cart. Show believable cursor/touch movement and complete each important action before cutting. Never fabricate a checkout, payment, confirmation, cart result, price, field value, or button that is not supported by a capture.`,

  tour: `FEATURE TOUR — AI-GENERATED FEATURE SHOWCASE
Inspect all captures and discover the strongest real features, tools, pages, sections, categories, search/filter controls, chat/AI assistant, dashboards, product areas, or navigation patterns that actually exist. Give each timeline section one distinct feature purpose while keeping one continuous film. Show the feature working when real before/after states support it; otherwise animate the existing interface cinematically without inventing a result. Long tours must keep changing subject, scale, interaction, and page so they never become repetitive.`,

  demo: `CINEMATIC BRAND FILM — FULLY AI-GENERATED
Create a premium AI-generated brand/product film grounded in the real website references. The surrounding world may be cinematic (studio, device, elegant environment, dimensional camera movement), but any website UI shown on a screen must remain faithful to the supplied captures. Preserve the real logo, product identity, colors, prices, and visible interface wording. Do not invent features, claims, statistics, discounts, review counts, or a different brand. Make every moment feel part of one consistent directed film, with no unrelated AI-shot resets.`,

  both: `VIDEO + PHOTOS — AI-GENERATED WEBSITE COMMERCIAL
For the VIDEO portion, follow the PROMO VIDEO rules: generate one continuous AI film grounded in the real website references, never a set of disconnected clips and never screenshot pans/zooms/transitions. Build a varied commercial arc grounded in the real site. The separate photo pipeline may create marketing stills from the same brand references.`,

  mockup: `DIGITAL PRODUCT MOCKUP — AI-GENERATED MOTION GRAPHIC REVEAL
Create the fast, scroll-stopping style used to advertise digital products (templates, planners, guides, PDFs) or physical products on TikTok, Instagram Reels, and Pinterest. Each reference is a real page/panel/photo of the product — treat it as ground truth, never redraw or retranslate its real text or layout. Generate energetic AI motion around and between real pages: cards sliding, flipping, or stacking into view, a natural swipe, gentle parallax, a soft zoom settling on a real detail. A light social-feed frame (subtle like/comment icon accents, soft neutral background) is welcome but must never cover or distort the real product content. Build hook → quick flip through the strongest real pages → satisfying closing reveal. Snappy, current, premium — never a static slideshow, never corporate.`,

  linkedin: `LINKEDIN VIDEO — PROFESSIONAL AI-GENERATED FEED STORY
Create a polished, credible video for the LinkedIn feed using the real website as evidence. Open with a concise visual problem/result hook, demonstrate the strongest real workflow, feature or product proof, and resolve on a clean professional product/service state. Use restrained professional motion, readable pacing and business-appropriate sound design. Keep the composition safe for desktop and mobile LinkedIn feeds. Never invent metrics, customers, testimonials, prices, claims, endorsements, capabilities, logos, titles or URLs that are not supported by the supplied captures.`,

  custom: `CUSTOM IDEA — THE CUSTOMER'S OWN VIDEO, NOT A WEBSITE COMMERCIAL
The customer's own written brief is the actual creative direction for this complete film — a personal or creative production (a product idea, a lifestyle scene, a narrative moment, a conversation, a testimonial, or anything else they imagined), not a fixed template and not an ecommerce/website promo. Follow it closely and specifically. Reference images are optional: with none, generate directly from the written idea. If a supplied image shows something real, keep it recognizable and never fabricate text/prices/logos that would misrepresent it. The whole film is true AI-generated video, never code-driven motion or stitched unrelated scenes. If the brief describes people talking or a conversation, direct real dialogue and performance. Where the brief leaves a creative choice open, make a strong, exciting, professional choice rather than defaulting to something bland or website-like.`,
};

export const GLOBAL_AI_VIDEO_RULES = `
NON-NEGOTIABLE WEBSITE FIDELITY RULES
- The supplied screenshots are the visual source of truth. Use them as starting/end/reference frames for AI video generation.
- Treat text already inside a supplied capture as protected source pixels. Never ask the model to redraw, retype, translate, correct, relabel, respell, replace, or hallucinate it. If the source text cannot remain pixel-faithful during motion, keep the screen wider and stable or avoid making that text readable rather than generating broken lettering.
- Never invent a product, page, modal, control, cart state, checkout state, payment state, confirmation, feature, claim, review, statistic, discount, field value, or navigation item that is not supported by the supplied captures.
- You MAY generate natural motion, cursor movement, taps/clicks, scrolling-like movement, dimensional camera movement, UI transitions, reflections, depth, lighting, or cinematic surroundings, but the action must remain grounded in real controls/states from the references.
- For an interaction, the action and its result must both be supported. If a "before" capture exists but no "after" state exists, show the action only if the result is not displayed; otherwise omit the action rather than inventing what happens.
- Never create random captions, subtitles, fake CTA cards, fake browser text, or generated marketing copy. Do not generate readable typography by default. If the customer's brief explicitly requires added on-screen copy, interpret the requested meaning but render it as short, natural, correctly spelled ENGLISH only, outside the website UI. Brand names and proper names stay unchanged.
- Never synthesize Arabic, Korean, Cyrillic, Chinese, or any other non-English script in generated video frames. On a non-English website, preserve the real captured screen only as stable source imagery and never make its lettering the readable focal point; use a wider device view or product/benefit footage. Do not create pseudo-language lettering.
- Avoid morphing or warping text, logos, faces, products, or UI geometry. Keep interface planes stable and readable while motion occurs.
- Do not turn the website into a generic stock video. The website and its real content must stay central.

AI VIDEO, NOT CODE-GENERATED MOTION
- The final deliverable must be one continuous video generated by the selected AI video provider. Timeline beats are directing notes only; they must not become independently generated clips that are concatenated afterward.
- Do not describe Ken Burns pans, deterministic crop animations, code-drawn cursors, slideshow transitions, screenshot-only editing, or stitched-shot construction as the film itself.
- The application may normalize resolution, trim to the exact requested duration, crop a delivery format, or mix/strip audio, but it must not manufacture the visual action in place of AI video generation.

PACING AND COMPLETENESS
- The opening must have useful visual information immediately; no black intro, loading screen, or dead air.
- Never cut in the middle of a meaningful click, selection, add-to-cart action, page transition, checkout step, or other important interaction. Complete the beat and leave a readable moment after the result.
- Short videos must tell a complete micro-story: hook → one or two meaningful actions/benefits → clean resolution. Fewer complete beats are better than many unfinished beats.
- Long videos must continuously introduce genuinely different pages, products, features, interactions, shot scales, or environments. Do not stretch duration by repeating the same screenshot, movement, or feature.
- Keep important text readable long enough to understand without freezing the whole scene.

AUDIO
- When sound is enabled, generate scene-appropriate audio as part of the AI video whenever the provider supports native audio: tasteful music/ambience plus subtle UI clicks/taps/transition sounds when appropriate.
- Avoid loud or distracting effects. Do not generate random spoken dialogue. If a separate narration track is requested/provided, leave enough space in the mix for it.
- For tutorial/buy flows, prioritize clean UI click/tap feedback and a light supporting bed. For promo/demo, use more cinematic rhythmic sound design. For feature tours, use polished modern tech/product sound design.
- When sound is disabled, visual timing must still work perfectly without relying on audio cues.
`;

const RUNTIME_AI_VIDEO_RULES = `
EXECUTION RULES
- Generate a REAL moving AI-video clip from the supplied website references; never simulate the scene with a moving still/slideshow.
- The captures are truth. Keep captured text as protected source pixels; never redraw it. Never synthesize non-English lettering. Any explicitly requested new visible copy must be correctly spelled English only.
- For promo/demo/LinkedIn films, prioritize cinematic product/service/benefit footage and use text-heavy UI sparingly. For tutorial/buy/tour/mockup films, keep referenced screens stable and wider whenever motion could corrupt their text.
- A cursor/touch may act only on a real visible control. Show an outcome only when a supplied reference proves that outcome. For before/after references, move naturally from the first real state to the last and finish the action before the clip ends.
- Keep UI geometry stable; avoid morphing, warped letters, duplicate controls, fake captions, fake logos or random marketing text.
- Short films need a complete beat, not an unfinished click. Long films must vary pages/features/actions and never repeat filler.
- If sound is enabled, use tasteful mode-appropriate music/ambience and subtle UI effects; no random dialogue.
`;

// Custom mode is the customer's own personal/creative video, not a website
// commercial — it must not inherit the website/ecommerce-specific execution
// rules above (UI text, buttons, layout, "no random dialogue"). It keeps the
// same non-negotiable *mechanism* guardrail (real AI video, not a slideshow)
// but is otherwise free to follow whatever the customer's idea describes,
// including real spoken dialogue when the idea calls for people talking.
const RUNTIME_CUSTOM_VIDEO_RULES = `
EXECUTION RULES
- Generate a REAL moving AI-video clip directly from the written idea. Reference images are optional visual anchors, never a requirement and never a website dependency.
- If a reference image is supplied and shows something real the customer uploaded (a real person, product, or place), keep it recognizable and consistent; never fabricate text/prices/logos that would misrepresent it.
- Do not generate visible typography unless the customer explicitly requests it. When requested, translate the intended meaning into concise, correctly spelled ENGLISH only; never synthesize non-English lettering. Brand/proper names may remain unchanged.
- Keep any on-screen subject stable and readable; avoid morphing, warped faces/text, fake logos, or duplicate elements.
- Short films need a complete beat, not an unfinished moment. Long films must keep introducing something genuinely new rather than repeating filler.
- If the idea describes people talking, a conversation, or narration, direct real dialogue: natural expressions, mouth movement, gestures and timing that match spoken lines.
- If sound is enabled and no dialogue was described, use tasteful mood-appropriate music/ambience.
`;

function modePrompt(mode: string) {
  return VIDEO_MASTER_PROMPTS[mode] ?? VIDEO_MASTER_PROMPTS.video;
}

function compactText(value: string | undefined | null, max: number) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Customer prompts are accepted up to 8,000 characters by the API. They are
 * deliberately kept verbatim here: truncating the tail used to silently drop
 * camera, product, dialogue, and ending requirements before Veo saw them.
 */
function customerBriefText(value: string | undefined | null) {
  return (value ?? '').trim();
}

export interface VideoScenePromptInput {
  mode: string;
  siteTitle: string;
  concept: string;
  vibe: string;
  scene: StoryboardScene;
  sceneIndex: number;
  totalScenes: number;
  targetDurationSeconds: number;
  creativeBrief?: string;
  nativeAudio: boolean;
  musicOnly?: boolean;
  separateNarration?: boolean;
  referenceLabels?: string[];
  variantSeed?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  previousSceneSummary?: string;
  nextSceneSummary?: string;
}

export function buildAiVideoScenePrompt(input: VideoScenePromptInput) {
  const {
    mode, siteTitle, concept, vibe, scene, sceneIndex, totalScenes,
    targetDurationSeconds, creativeBrief, nativeAudio, musicOnly, separateNarration,
    referenceLabels, variantSeed, aspectRatio, previousSceneSummary, nextSceneSummary,
  } = input;
  const isCustom = mode === 'custom';
  const position = sceneIndex === 0 ? 'opening' : sceneIndex === totalScenes - 1 ? 'closing' : `middle ${sceneIndex + 1}`;
  const refs = (referenceLabels ?? []).filter(Boolean).slice(0, 3).map((value) => compactText(value, 90));

  // Keep the customer's complete brief. The request validator already applies
  // the product's 8,000-character input limit; applying another smaller limit
  // here caused valid details at the end of a prompt to disappear.
  const safeBrief = customerBriefText(creativeBrief);
  const safeScene = compactText(scene.shotDescription, 1100);
  const safeConcept = compactText(concept, 260);
  const safeVibe = compactText(vibe, 140);
  const safePrevious = compactText(previousSceneSummary, 180);
  const safeNext = compactText(nextSceneSummary, 180);
  const modeSummary = compactText(modePrompt(mode), 420);

  const referenceRule = isCustom
    ? refs.length
      ? `Use the ${refs.length} supplied image reference${refs.length === 1 ? '' : 's'} as ASSET references for identity, product/place details, palette and style. Do not copy their exact framing unless this scene calls for it. Create a new composition for this scene.`
      : 'No image reference is supplied. Generate this shot directly from the written direction.'
    : refs.length
      ? `The supplied website capture${refs.length === 1 ? '' : 's'} are ground truth. Preserve UI geometry, logo, prices, controls and product identity; treat visible wording as protected source pixels and never redraw it. Do not invent interface states.`
      : 'Keep all visible brand/UI facts conservative and do not invent unsupported details.';

  const interactionRule = scene.sceneType === 'interaction' && !isCustom
    ? 'For the interaction, perform the real supported action on the real visible control, show only the grounded outcome, then hold the resolved state long enough to understand it before the cut.'
    : 'Give this 8-second clip one clear visual beat that fully resolves before the cut.';

  const formatRule = aspectRatio === '1:1'
    ? 'Square delivery is center-cropped from a wider provider frame: keep faces, products, devices, logos, and essential action inside the central square-safe area for the entire shot.'
    : '';

  const audioRule = !nativeAudio
    ? 'Visuals must work silently.'
    : musicOnly
      ? 'MUSIC ONLY: instrumental music + natural ambience only. Absolutely no talking, narration, dialogue, vocals, or lip-synced speech.'
      : isCustom && !separateNarration
        ? 'Audio: generate natural scene sound. If the customer explicitly requested dialogue, generate only the requested natural dialogue with believable lip movement, timing, and room acoustics.'
        : 'Audio: generate native cinematic ambience/music and subtle scene effects appropriate to this shot; no unrelated dialogue, and leave space for separate narration.';

  return `Create ONE premium, photorealistic, commercial-grade Veo shot. This is scene ${sceneIndex + 1}/${totalScenes} (${position}) of an approximately ${targetDurationSeconds}s film, exactly ${scene.durationSeconds || 8}s.

PRIMARY SCENE DIRECTION
${safeScene}

CUSTOMER BRIEF
${safeBrief || 'Use the strongest professional interpretation of the storyboard direction.'}

FILM IDENTITY
Subject/project: ${compactText(siteTitle, 100)}
Concept: ${safeConcept}
Mood / grade: ${safeVibe}
Format: ${aspectRatio ?? '16:9'}, native cinematic 24fps motion
Mode intent: ${modeSummary}
Variation: ${variantSeed ?? 0}

REFERENCE HANDLING
${referenceRule}
${refs.length ? `Reference labels: ${refs.join(' | ')}` : ''}

DIRECTING & QUALITY
- Realistic professional commercial footage, coherent physics, natural human motion, accurate anatomy, stable faces/hands/objects, crisp fine detail, controlled highlights, intentional lighting and depth.
- Specify the composition visually through the scene direction: subject, action, setting, camera position/movement, lens/focus, lighting and final resolved moment.
- Prefer one continuous, unbroken shot with no internal scene cuts unless the storyboard explicitly requests a cut; this improves subject and environment coherence inside each 8-second clip.
- Do NOT create posters, storyboards, collages, split screens, infographics, generated subtitles, random text, watermarks or fake logos. Do not generate visible typography by default. If the customer's scene explicitly requires added readable on-screen copy, translate its intended meaning into short, correctly spelled ENGLISH only; preserve real brand/proper names unchanged and never redraw text already present in a reference image.
- If a phone/tablet/laptop appears in a custom commercial, prefer clean abstract interface shapes unless a real UI reference is supplied. Do not invent readable UI copy.
- Make this shot materially different from neighboring shots in framing, action and composition while preserving the same people/products/world when continuity requires it.
${formatRule ? `- ${formatRule}\n` : ''}- Avoid generic stock-video staging, excessive slow motion, plastic skin, oversharpening, flicker, jitter, morphing and repeated background extras.
${interactionRule}

CONTINUITY
Previous: ${safePrevious || 'opening of the film'}
Next: ${safeNext || 'final resolution'}
Create a clean editorial handoff; never stop mid-gesture or mid-action.

${audioRule}`;
}

/**
 * Server-only quality direction applied to every video generation. It is not
 * exposed as editable customer copy: the customer's brief remains the creative
 * intent, while this directive supplies the permanent production-quality,
 * continuity, fidelity, typography, audio and finishing rules that should never
 * depend on how detailed the customer prompt happens to be.
 */
export const INTERNAL_MASTER_VIDEO_QUALITY_DIRECTIVE = `
MASTER PRODUCTION STANDARD — ALWAYS APPLY
- Produce one coherent finished film for the full requested duration. Do not make independent clips that are later treated as unrelated scenes. The film must feel as if it was directed and generated as one continuous production with consistent subjects, products, locations, lighting, grade, camera language and story progression.
- The customer's complete prompt is the highest-priority creative brief and controls WHAT the film communicates. Account for every compatible detail, including subject, product, action, order, setting, style, camera, lighting, colors, dialogue, exclusions, timing, format and ending. Never silently replace a specific request with a generic ad template.
- Start with useful visual information immediately. No black frames, loading cards, placeholder screens, dead air, test patterns, countdowns or generic AI intros.
- Preserve identity rigorously. The same person must keep the same face, age range, hair, clothing and proportions. The same product must keep shape, materials, colors, logos and small details. The same website/brand must keep its real logo, palette and recognizable UI.
- Typography is a quality-critical area. Do not generate any readable text by default. Newly added on-screen copy, only when explicitly required, must be concise, natural, correctly spelled ENGLISH only even when the request was written in another language. Brand names/proper names remain unchanged. Treat real reference text as protected source pixels; never redraw it. Never synthesize non-English glyphs or pseudo-language text. Do not make non-English source text the readable focal point; use wider framing, keep the display stable, or remove readable typography from the composition.
- Never misspell, translate, rewrite or hallucinate a real logo or brand name. Never invent a closing logo, wordmark, app icon, slogan, URL or title card. If a verified real mark cannot be preserved, finish with a strong text-free visual resolution. Avoid warped letters, morphing interface geometry, duplicate controls, duplicated products, duplicate people, flicker, jitter, temporal tearing and unstable hands/faces.
- Use premium commercial cinematography: intentional composition, physically believable camera movement, realistic motion blur, natural depth of field, controlled highlights, clean shadows, realistic materials, coherent reflections and high-detail texture. Avoid plastic skin, oversharpening, excessive bloom, cheap stock-video staging and random camera movement.
- Every action must resolve. Do not end the requested duration mid-click, mid-sentence, mid-gesture, mid-product reveal or before the final visual has settled. Do not show an ending, logo card, CTA card, fade-out or final hero pose before the last generation window.
- Maintain continuity across the entire film and especially across provider extension boundaries. Never restart the story, repeat the opening, reset the subject, jump to an unrelated environment, replay the same action, or insert a new title card just because generation is being extended.
- If dialogue is requested, keep speaker identity, mouth movement, expression, timing, room acoustics and turn-taking natural. Do not add unrequested dialogue. If narration is supplied separately, leave acoustic space for it.
- If audio is enabled, use clean scene-appropriate ambience, music and sound design with no clipping or abrupt resets. Audio should continue naturally as the visual film continues.
- Finish on a deliberate resolved frame suitable for delivery. The final seconds must look intentional, not like generation simply stopped.
`;

export interface ContinuousVideoPromptInput {
  mode: string;
  siteTitle: string;
  concept: string;
  vibe: string;
  scenes: StoryboardScene[];
  targetDurationSeconds: number;
  creativeBrief?: string;
  referenceLabels?: string[];
  aspectRatio?: '16:9' | '9:16' | '1:1';
  outputQuality?: '1080p' | '4k';
  frameRate?: 24 | 30 | 60;
  nativeAudio: boolean;
  musicOnly?: boolean;
  separateNarration?: boolean;
  variantSeed?: number;
}

/**
 * Builds one master prompt for a single continuous video. The storyboard is
 * treated only as a timeline/directing plan; it is NOT permission to generate
 * independent clips and concatenate them.
 */
export function buildContinuousVideoPrompt(input: ContinuousVideoPromptInput) {
  const {
    mode,
    siteTitle,
    concept,
    vibe,
    scenes,
    targetDurationSeconds,
    creativeBrief,
    referenceLabels,
    aspectRatio,
    outputQuality,
    frameRate,
    nativeAudio,
    musicOnly,
    separateNarration,
    variantSeed,
  } = input;
  const isStudioVideo = ['custom', 'ai-video', 'product-video', 'talking-scene'].includes(mode);
  const isPromptFirstStudio = ['custom', 'ai-video', 'talking-scene'].includes(mode);
  const safeBrief = customerBriefText(creativeBrief);
  const safeConcept = compactText(concept, 420);
  const safeVibe = compactText(vibe, 240);
  const refs = (referenceLabels ?? []).filter(Boolean).slice(0, 3).map((value) => compactText(value, 160));
  let timelineCursor = 0;
  const timeline = (scenes ?? []).slice(0, 24).map((scene, index) => {
    const remaining = Math.max(1, targetDurationSeconds - timelineCursor);
    const fallbackBeat = Math.max(1, Math.round((targetDurationSeconds - timelineCursor) / Math.max(1, scenes.length - index)));
    const beatSeconds = Math.min(remaining, Math.max(1, Math.round(scene.durationSeconds || fallbackBeat)));
    const start = timelineCursor;
    const end = index === Math.min(23, scenes.length - 1)
      ? targetDurationSeconds
      : Math.min(targetDurationSeconds, start + beatSeconds);
    timelineCursor = end;
    return `${start}-${end}s: ${compactText(scene.shotDescription, 900)}`;
  }).join('\n');

  const referenceRule = isStudioVideo
    ? mode === 'product-video'
      ? refs.length
        ? 'The supplied product images are product ground truth. Preserve the exact product identity, shape, proportions, materials, colors, logos, hardware, stitching, packaging and small details throughout the continuous film. Use them as identity/product references, not as separate scenes.'
        : 'A product video should be grounded in a real product reference. Do not invent or substitute product identity.'
      : refs.length
        ? 'Use the supplied customer reference images only as identity/product/place/style anchors. Preserve the real subject consistently while creating one coherent moving film; do not reset to the source image at each continuation.'
        : 'No visual reference is required. Generate directly from the customer brief while keeping subjects and environment consistent for the full film.'
    : refs.length
      ? 'The supplied real website captures are brand/UI ground truth. Keep the real website, product identity, colors and recognizable interface faithful. Do not invent unsupported pages, claims, prices or controls.'
      : 'Keep all brand/UI facts conservative. Never invent unsupported website details.';

  const audioRule = !nativeAudio
    ? 'The final film must work perfectly without generated speech or scene audio.'
    : musicOnly
      ? 'Generate instrumental music and natural ambience only; no speech, singing, narration or lip-synced dialogue.'
      : isPromptFirstStudio && !separateNarration
        ? 'Generate natural production audio. If and only if the customer explicitly requested dialogue, include that dialogue with believable performance and synchronization. Keep voices and acoustics continuous through extensions.'
        : mode === 'product-video' && !separateNarration
          ? 'Generate tasteful product-appropriate ambience, sound design and music; do not add unrequested speech or claims.'
          : 'Generate tasteful native ambience/music and scene effects; do not add unrelated dialogue, and leave room for the separate narration track.';

  const modeRules = compactText(modePrompt(mode), 1200);
  const formatRule = aspectRatio === '1:1'
    ? 'The provider generates a wide continuity source that is mastered to square; keep every essential face, product, device, logo and action inside the central square-safe area for the entire film.'
    : aspectRatio === '9:16' && targetDurationSeconds > 8
      ? 'The provider must extend a 16:9 continuity source, then mastering crops it to 9:16. Compose EVERY essential face, product, device, logo, readable UI area and action inside the central portrait-safe 9:16 region from first frame to last. Never place essential content near the left/right edges.'
      : `Compose natively for ${aspectRatio ?? '16:9'}.`;

  return `MASTER FILM PLAN — ONE CONTINUOUS AI-GENERATED PRODUCTION
The final delivery is exactly ${targetDurationSeconds} seconds. This plan is shared context for sequential Veo generation windows; it is NOT an instruction to perform the whole story or show the ending in the first provider call.

CUSTOMER BRIEF — VERBATIM, HIGHEST CREATIVE PRIORITY
${safeBrief || 'Use the strongest professional interpretation of the selected production mode and source material.'}

PROMPT-FIDELITY CONTRACT
- Carry every compatible customer detail into the finished film. Do not summarize away, ignore, weaken, or replace requirements from the brief.
- When a storyboard interpretation conflicts with an explicit customer detail, follow the customer detail.
- Use professional judgment only for choices the customer left open.

PROJECT
Subject / brand: ${compactText(siteTitle, 140)}
Concept: ${safeConcept || 'Premium directed film'}
Mood / grade: ${safeVibe || 'premium, modern, cinematic'}
Mode: ${mode}
Requested delivery: ${aspectRatio ?? '16:9'} · ${outputQuality ?? '1080p'} · ${frameRate ?? 24}fps
Variation key: ${variantSeed ?? 0}

MODE-SPECIFIC INTENT
${modeRules}

REFERENCE HANDLING
${referenceRule}
${refs.length ? `Available reference labels: ${refs.join(' | ')}` : ''}

FULL-FILM TIMELINE
Treat these as beats inside ONE continuing film. Blend them naturally; do not restart visual identity at beat boundaries.
${timeline || `0-${targetDurationSeconds}s: Follow the customer direction as one complete beginning-to-ending film.`}

CONTINUITY / EXTENSION INSTRUCTION
The film is generated as an initial segment and then extended from its own final frames. A separate CURRENT GENERATION WINDOW instruction tells each provider call which timestamp range to perform. Obey only the timeline beats that overlap that window. Every extension MUST continue the exact same film from the preceding frame. Never replay the opening, reset the set, swap the person/product, repeat an earlier beat, or create an unrelated new clip. Preserve visual/audio continuity.

FORMAT
${formatRule}
${audioRule}

${isStudioVideo ? '' : GLOBAL_AI_VIDEO_RULES}

${INTERNAL_MASTER_VIDEO_QUALITY_DIRECTIVE}

DELIVERY GOAL
A single polished film that looks intentionally directed from first frame to last, with stable identity, premium motion, clean audio treatment, no fake text or logos, no duplicated content, and one resolved final moment occurring only at the true end.`;
}

function generationWindowDirective(currentSeconds: number, targetSeconds: number, base: boolean) {
  const start = Math.max(0, Math.min(targetSeconds, currentSeconds));
  const capacitySeconds = base ? 8 : 7;
  const end = Math.min(targetSeconds, start + capacitySeconds);
  const usableSeconds = Math.max(0, end - start);
  const isFinalWindow = end >= targetSeconds;
  const windowName = base ? 'OPENING WINDOW' : 'CONTINUATION WINDOW';
  const endingRule = isFinalWindow
    ? `THIS IS THE FINAL WINDOW. Complete the remaining action within the FIRST ${usableSeconds} usable second${usableSeconds === 1 ? '' : 's'}, then hold a natural resolved visual through the trim point. Use a real verified logo or exact English closing copy only when the customer explicitly requested it and it is supported by the references; otherwise end visually with no generated text or logo.`
    : `THIS IS NOT THE END OF THE FILM. Do not show a closing card, logo reveal, slogan, URL, CTA card, fade-out, final hero pose, credits, or any other ending. Do not resolve the whole story yet; complete only this window's action and leave a natural moving handoff for the next continuation.`;

  return `CURRENT GENERATION WINDOW — ${windowName}: ${start}-${end}s OF ${targetSeconds}s
- Generate only the timeline material whose timestamp overlaps ${start}-${end}s. Do not jump ahead to later beats.
- ${base ? 'Begin immediately with the planned visual hook; no black frame, title card, loading screen, or generic intro.' : 'Continue from the exact existing final frame and audio state; no restart, recap, repeated opening, identity swap, or discontinuity.'}
- Only the first ${usableSeconds} second${usableSeconds === 1 ? '' : 's'} of this provider result will remain in the requested delivery. Resolve this window's action before that trim point; never put essential content after it.
- ${endingRule}
- Do not generate readable typography by default. If visible copy is explicitly required, render concise, correctly spelled ENGLISH only. Never synthesize non-English or pseudo-language lettering, and never invent a logo.`;
}

/** The first Veo call performs only the opening window, not the full master plan. */
export function buildContinuousBasePrompt(masterPrompt: string, targetSeconds: number) {
  return `${generationWindowDirective(0, targetSeconds, true)}\n\n${masterPrompt}`;
}

/** Each extension gets its exact usable time window and the complete master plan. */
export function buildContinuousExtensionPrompt(masterPrompt: string, currentSeconds: number, targetSeconds: number) {
  return `${generationWindowDirective(currentSeconds, targetSeconds, false)}\n\n${masterPrompt}`;
}
