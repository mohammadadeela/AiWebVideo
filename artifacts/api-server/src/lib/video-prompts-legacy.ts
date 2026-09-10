import type { StoryboardScene } from './gemini.js';

export const VIDEO_MASTER_PROMPTS: Record<string, string> = {

  "ai-video": `AI VIDEO — ORIGINAL PROMPT-DRIVEN FILM
Create one coherent original AI-generated film directly from the customer's written idea. Do not introduce website, ecommerce, dashboard, browser, or product-ad language unless the customer actually asked for it. Optional reference images are identity/style anchors only. Preserve any referenced person, product, place or object consistently for the entire film. Follow the requested narrative, mood, action, camera and audio direction with a complete beginning-to-ending arc.`,

  "product-video": `PRODUCT VIDEO — REFERENCE-FAITHFUL COMMERCIAL FILM
Create one premium continuous product film grounded in the customer's real product images. Preserve exact product shape, proportions, materials, colors, logos, stitching, hardware, packaging and small details. Never redesign or substitute the product. Build an elegant commercial arc around the real item using believable motion, macro details, hero angles, lighting and environments that support the customer's brief. Do not invent prices, claims, labels or readable packaging text.`,

  "talking-scene": `TALKING SCENE — PERFORMANCE-FIRST CONTINUOUS VIDEO
Create one coherent dialogue/performance video from the customer's scenario. Preserve speaker identity, wardrobe, setting and eyelines throughout. Make speech, mouth movement, gestures, reactions, pauses and turn-taking feel natural. If exact dialogue is supplied, keep the spoken wording faithful and do not add unrelated lines. Optional reference images are identity/style anchors, not separate scenes. Use professional camera blocking and audio continuity from beginning to end.`,
  video: `PROMO VIDEO — AI-GENERATED WEBSITE COMMERCIAL
Create a real AI-generated commercial, not a slideshow and not a screen recording. Study the supplied website captures and identify what the website actually sells or does. Use the real UI, products, brand, colors, navigation, and visible content as the source of truth. Animate the website naturally with purposeful cursor/touch interaction only when an actual visible control supports it. Build a strong advertising arc: immediate hook, different real benefits/pages/products, satisfying interaction moments, and a clean branded ending. Do not repeat the same page or movement just to fill time.`,

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
Create a polished, credible video for the LinkedIn feed using the real website as evidence. Open with a concise problem/result hook, demonstrate the strongest real workflow, feature or product proof, and resolve on a clean branded state. Use restrained professional motion, readable pacing and business-appropriate sound design. Keep the composition safe for desktop and mobile LinkedIn feeds. Never invent metrics, customers, testimonials, prices, claims, endorsements or capabilities that are not supported by the supplied captures.`,

  custom: `CUSTOM IDEA — THE CUSTOMER'S OWN VIDEO, NOT A WEBSITE COMMERCIAL
The customer's own written brief is the actual creative direction for this complete film — a personal or creative production (a product idea, a lifestyle scene, a narrative moment, a conversation, a testimonial, or anything else they imagined), not a fixed template and not an ecommerce/website promo. Follow it closely and specifically. Reference images are optional: with none, generate directly from the written idea. If a supplied image shows something real, keep it recognizable and never fabricate text/prices/logos that would misrepresent it. The whole film is true AI-generated video, never code-driven motion or stitched unrelated scenes. If the brief describes people talking or a conversation, direct real dialogue and performance. Where the brief leaves a creative choice open, make a strong, exciting, professional choice rather than defaulting to something bland or website-like.`,
};

export const GLOBAL_AI_VIDEO_RULES = `
NON-NEGOTIABLE WEBSITE FIDELITY RULES
- The supplied screenshots are the visual source of truth. Use them as starting/end/reference frames for AI video generation.
- Never rewrite, translate, correct, relabel, respell, replace, or hallucinate visible website text. Preserve Arabic and English wording, logos, prices, product names, buttons, labels, and brand marks exactly as shown whenever they are visible.
- Never invent a product, page, modal, control, cart state, checkout state, payment state, confirmation, feature, claim, review, statistic, discount, field value, or navigation item that is not supported by the supplied captures.
- You MAY generate natural motion, cursor movement, taps/clicks, scrolling-like movement, dimensional camera movement, UI transitions, reflections, depth, lighting, or cinematic surroundings, but the action must remain grounded in real controls/states from the references.
- For an interaction, the action and its result must both be supported. If a "before" capture exists but no "after" state exists, show the action only if the result is not displayed; otherwise omit the action rather than inventing what happens.
- Never create random captions, subtitles, fake CTA cards, fake browser text, or generated marketing copy. If the customer's brief explicitly requires added on-screen copy, the added copy must be short, simple, correctly spelled ENGLISH only, placed outside the website UI, and must never cover important interface content.
- For non-English websites, DO NOT translate or regenerate the site's existing text. Keep the captured source-language UI as visual ground truth, avoid extreme close-ups on dense typography, and use English only for any newly added title/CTA copy. Brand names and proper names stay unchanged.
- Avoid morphing or warping text, logos, faces, products, or UI geometry. Keep interface planes stable and readable while motion occurs.
- Do not turn the website into a generic stock video. The website and its real content must stay central.

AI VIDEO, NOT CODE-GENERATED MOTION
- The final deliverable must be one continuous video generated by the selected AI video provider. Timeline beats are directing notes only; they must not become independently generated clips that are concatenated afterward.
- Do not describe Ken Burns pans, deterministic crop animations, code-drawn cursors, slideshow transitions, screenshot-only editing, or stitched-shot construction as the film itself.
- The application may normalize resolution, trim to the exact requested duration, crop a delivery format, apply a deterministic real-brand closing overlay, or mix/strip audio, but it must not manufacture the visual action in place of AI video generation.

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
- The captures are truth. Preserve visible Arabic/English UI text, logo, product identity, prices, buttons and layout; never invent or rewrite UI, products, claims or states.
- A cursor/touch may act only on a real visible control. Show an outcome only when a supplied reference proves that outcome. For before/after references, move naturally from the first real state to the last and finish the action before the clip ends.
- Keep text/UI stable and readable; avoid morphing, warped letters, duplicate controls, fake captions or random marketing text.
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
- Keep any on-screen subject stable and readable; avoid morphing, warped faces/text, or duplicate elements.
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

  // Veo 3.1 has a finite prompt budget. The old runtime prompt repeated the
  // full master policy + execution policy + project metadata, which could push
  // the actual scene direction and customer brief too far down the prompt.
  // Keep the storyboard planner rich, but make the *video-model* prompt lean,
  // scene-first, and cinematic so the instructions that matter most survive.
  const safeBrief = compactText(creativeBrief, 1400);
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
      ? `The supplied website capture${refs.length === 1 ? '' : 's'} are ground truth. Preserve visible UI, logo, wording, prices, controls and product identity exactly; do not invent interface states.`
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
- Do NOT create posters, storyboards, collages, split screens, infographics, generated subtitles, random text, watermarks or fake logos. If the customer's scene explicitly requires added readable on-screen copy, use short, correctly spelled ENGLISH only; preserve real brand/proper names unchanged and never rewrite text already present in a reference image.
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
- The customer's prompt controls WHAT the film should communicate. These master rules control HOW professionally it is executed; never override a specific safe customer request merely to force a generic ad template.
- Start with useful visual information immediately. No black frames, loading cards, placeholder screens, dead air, test patterns, countdowns or generic AI intros.
- Preserve identity rigorously. The same person must keep the same face, age range, hair, clothing and proportions. The same product must keep shape, materials, colors, logos and small details. The same website/brand must keep its real logo, palette and recognizable UI.
- Typography is a quality-critical area. Do not let the video model invent or redraw marketing text. Newly added on-screen copy, only when explicitly required, must be concise, correctly spelled ENGLISH only. Brand names/proper names remain unchanged. When real reference text is visible in any source language, preserve it as source imagery; never translate, respell, or regenerate it. If exact readable source text cannot be preserved, use wider framing or shallower emphasis so the interface remains recognizable without fabricating replacement wording.
- Never misspell, translate, rewrite or hallucinate a real logo or brand name. Avoid warped letters, morphing interface geometry, duplicate controls, duplicated products, duplicate people, flicker, jitter, temporal tearing and unstable hands/faces.
- Use premium commercial cinematography: intentional composition, physically believable camera movement, realistic motion blur, natural depth of field, controlled highlights, clean shadows, realistic materials, coherent reflections and high-detail texture. Avoid plastic skin, oversharpening, excessive bloom, cheap stock-video staging and random camera movement.
- Every action must resolve. Do not end the requested duration mid-click, mid-sentence, mid-gesture, mid-product reveal or before the CTA/ending has visually settled.
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
    nativeAudio,
    musicOnly,
    separateNarration,
    variantSeed,
  } = input;
  const isCustom = mode === 'custom';
  const isStudioVideo = ['custom', 'ai-video', 'product-video', 'talking-scene'].includes(mode);
  const isPromptFirstStudio = ['custom', 'ai-video', 'talking-scene'].includes(mode);
  const safeBrief = compactText(creativeBrief, 2200);
  const safeConcept = compactText(concept, 420);
  const safeVibe = compactText(vibe, 240);
  const refs = (referenceLabels ?? []).filter(Boolean).slice(0, 8).map((value) => compactText(value, 120));
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
    return `${start}-${end}s: ${compactText(scene.shotDescription, 430)}`;
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

  return `Create ONE complete, coherent, premium AI-generated video for the entire requested duration: exactly ${targetDurationSeconds} seconds in the final delivery. This is one film, not a collection of separately generated scenes.

CUSTOMER DIRECTION
${safeBrief || 'Use the strongest professional interpretation of the selected production mode and source material.'}

PROJECT
Subject / brand: ${compactText(siteTitle, 140)}
Concept: ${safeConcept || 'Premium directed film'}
Mood / grade: ${safeVibe || 'premium, modern, cinematic'}
Mode: ${mode}
Requested delivery: ${aspectRatio ?? '16:9'} · ${outputQuality ?? '1080p'} · cinematic 24fps
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
The video may be generated by Veo as an initial segment and then extended from its own final frames. Every extension MUST continue the exact same film from the preceding frame. Never replay the opening, reset the set, swap the person/product, repeat an earlier beat, or create an unrelated new clip. Advance toward the next unfinished timeline beat and preserve visual/audio continuity.

FORMAT
${formatRule}
${audioRule}

${isStudioVideo ? '' : GLOBAL_AI_VIDEO_RULES}

${INTERNAL_MASTER_VIDEO_QUALITY_DIRECTIVE}

DELIVERY GOAL
A single polished film that looks intentionally directed from first frame to last, with stable identity, premium motion, clean audio treatment, no fake text, no duplicated content and a resolved final moment.`;
}

/** Keep extension prompts compact while retaining the permanent master rules. */
export function buildContinuousExtensionPrompt(masterPrompt: string, currentSeconds: number, targetSeconds: number) {
  return `CONTINUE THE EXACT SAME EXISTING VIDEO. Do not restart, recap, repeat the opening, change identity, or create a disconnected new scene. Continue naturally from the final frame and audio state already present. The complete film target is ${targetSeconds}s; approximately ${currentSeconds}s already exists. Progress the story toward the next unfinished beat and preserve the same people/products/brand/environment/grade/camera language. Resolve actions before moving on.\n\nMASTER DIRECTION (continue obeying it):\n${compactText(masterPrompt, 7000)}`;
}
