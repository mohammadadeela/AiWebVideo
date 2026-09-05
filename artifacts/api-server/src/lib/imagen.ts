import { GoogleGenAI } from '@google/genai';
import { ASSETS_DIR, saveImageFile } from './capture.js';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { query } from './pool.js';
import { GEMINI_COST_CATALOG, recordGenerationCost } from './costs.js';
import { runQueuedProviderCall } from './provider-queue.js';


const execFileAsync = promisify(execFile);

// Server-only quality rules appended to every image-generation request.
// Customer prompts still control the creative direction; these rules provide
// permanent fidelity, typography and commercial-quality guardrails.
const INTERNAL_MASTER_IMAGE_QUALITY_DIRECTIVE = `
MASTER IMAGE QUALITY STANDARD — ALWAYS APPLY
- Preserve the exact identity of every supplied real product, person, logo and brand asset. Do not redesign, recolor, replace or simplify source details unless the customer explicitly requests that exact change.
- No random text, fake prices, fake product names, fake Arabic/English, misspelled logos, watermarks or unrelated brand marks. If exact text is not required, omit generated text entirely.
- Premium commercial photography quality: realistic materials, accurate geometry, natural light behavior, controlled highlights, clean shadows, coherent reflections, high micro-detail and believable depth.
- Avoid duplicated objects, extra limbs, warped hands/faces, melted edges, distorted logos, inconsistent product proportions, oversharpening, heavy blur, excessive bloom and stock-template styling.
- Respect the requested aspect ratio and keep the main subject safely composed for the final crop.
- Return one polished final image, not a contact sheet, collage, before/after panel or explanatory layout unless the customer explicitly asked for that format.
`;

function imageOutputFrame(aspectRatio: '16:9' | '9:16' | '1:1', quality: '1080p' | '4k') {
  const scale = quality === '4k' ? 2 : 1;
  if (aspectRatio === '9:16') return { width: 1080 * scale, height: 1920 * scale };
  if (aspectRatio === '1:1') return { width: 1080 * scale, height: 1080 * scale };
  return { width: 1920 * scale, height: 1080 * scale };
}

async function masterGeneratedImage(
  jobId: string,
  sourceFilename: string,
  finalFilename: string,
  aspectRatio: '16:9' | '9:16' | '1:1',
  outputQuality: '1080p' | '4k',
) {
  const { width, height } = imageOutputFrame(aspectRatio, outputQuality);
  const source = path.join(ASSETS_DIR, jobId, sourceFilename);
  const output = path.join(ASSETS_DIR, jobId, finalFilename);
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', source,
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
    '-frames:v', '1', output,
  ], { timeout: 2 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  await fs.rm(source, { force: true }).catch(() => {});
  const stat = await fs.stat(output);
  if (!stat.size) throw new Error('Generated image mastering produced an empty file.');
  return `/api/assets/${jobId}/${finalFilename}`;
}

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export interface GeneratedImage { url: string; aspectRatio: string; }

/**
 * Shared image-generation plumbing used by both photo-mode marketing images
 * and demo-mode cinematic scene frames. It sends the prompt and reference
 * images to Gemini and saves the returned image.
 * Callers own their own prompt text and log label; this only owns the
 * transport and file-saving mechanics.
 */
async function runImageGeneration(
  jobId: string,
  sceneIndex: number,
  logLabel: string,
  filenamePrefix: string,
  prompt: string,
  referenceImages: Buffer[],
  aspectRatio: '16:9' | '9:16' | '1:1',
  outputQuality: '1080p' | '4k',
  operation = 'marketing_image',
): Promise<GeneratedImage> {
  const geminiImageModel = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
  console.info(
    `[${logLabel}] job=${jobId} scene=${sceneIndex} provider=gemini ` +
    `model=${geminiImageModel} reference_assets=${referenceImages.length}`,
  );

  const input: Array<{ type: 'image'; data: string; mime_type: string } | { type: 'text'; text: string }> = referenceImages
    .filter((buffer) => buffer.length > 0)
    .slice(0, 4)
    .map((buffer) => ({ type: 'image' as const, data: buffer.toString('base64'), mime_type: 'image/jpeg' }));
  input.push({ type: 'text', text: `${prompt}\n\n${INTERNAL_MASTER_IMAGE_QUALITY_DIRECTIVE}` });

  const interaction = await runQueuedProviderCall({
    kind: 'image',
    model: geminiImageModel,
    operation,
    jobId,
    task: () => getClient().interactions.create({
      model: geminiImageModel,
      input,
      response_format: {
        type: 'image',
        aspect_ratio: aspectRatio,
        image_size: outputQuality === '4k' ? '4K' : '2K',
      },
    }),
  });

  const image = interaction.output_image;
  if (!image?.data) throw new Error('The image provider returned no generated image.');
  const filename = `${filenamePrefix}-${sceneIndex}-${outputQuality}.png`;
  const rawFilename = `${filenamePrefix}-${sceneIndex}-${outputQuality}-provider.png`;
  await saveImageFile(jobId, rawFilename, Buffer.from(image.data, 'base64'));
  // Provider aspect-ratio metadata is not enough. Master the actual file to
  // the exact delivery canvas selected by the user so 1:1/9:16/16:9 are true
  // pixel dimensions in the downloaded result.
  const url = await masterGeneratedImage(jobId, rawFilename, filename, aspectRatio, outputQuality);
  const defaultCost = outputQuality === '4k' ? GEMINI_COST_CATALOG.image.fourK : GEMINI_COST_CATALOG.image.twoK;
  const configuredCost = Number(process.env[outputQuality === '4k' ? 'GEMINI_IMAGE_COST_4K_USD' : 'GEMINI_IMAGE_COST_2K_USD'] ?? defaultCost);
  await recordGenerationCost({
    jobId, provider: 'gemini', model: geminiImageModel, operation,
    quantity: 1, unit: 'image', unitCostUsd: Math.max(0, configuredCost),
    metadata: { image: sceneIndex + 1, quality: outputQuality },
  });
  return { url, aspectRatio };
}

/**
 * Generate a photoreal "seed" concept image purely from a user's written idea
 * — no captured website or uploaded photo required. This exists for the
 * Studio entry points (Custom Idea Video, Scenario Video) that let a signed-in
 * user start from imagination alone. The resulting image is then saved and
 * fed back into the exact same upload-job pipeline a real uploaded photo
 * would use, so every downstream step (storyboard planning, AI video
 * grounding, credits, refunds) needs zero special-casing for "no photo was
 * ever provided".
 */
export async function generateIdeaSeedImage(
  jobId: string,
  index: number,
  idea: string,
  referenceImages: Buffer[],
  aspectRatio: '16:9' | '9:16' | '1:1',
  outputQuality: '1080p' | '4k',
  variantLabel: string,
): Promise<GeneratedImage> {
  const prompt = `Create ONE photorealistic concept image to serve as the visual foundation for a short AI-generated video.

USER'S IDEA (this is the actual creative brief — follow it closely and specifically):
${idea.trim()}

CREATIVE VARIATION: ${variantLabel}

${referenceImages.length ? 'Use the attached reference photo(s) as ground truth for any real person, product, or setting they show. Keep them recognizable and do not distort their identity.' : 'No reference photos were supplied — invent a compelling, realistic scene that matches the idea exactly.'}

REQUIREMENTS:
- Photoreal, high production quality, natural lighting, believable composition — this must look like a real first frame of a professional video, not an illustration or 3D render.
- Leave clear, uncluttered space and a natural pose/moment that a video model can continue believably (a person mid-gesture or mid-speech reads better than a static frozen smile).
- No on-screen text, captions, logos, or watermarks unless the idea explicitly asks for them.
- No collage, no multiple panels, no mockup frames — one single continuous scene.`;

  return runImageGeneration(
    jobId,
    index,
    'idea-seed',
    'idea-seed-concept',
    prompt,
    referenceImages,
    aspectRatio,
    outputQuality,
    'idea_seed_image',
  );
}

/** Generate one square website/app-icon concept grounded in the real site. */
export async function generateWebsiteIcon(
  jobId: string,
  conceptIndex: number,
  siteTitle: string,
  vibe: string,
  referenceImages: Buffer[],
  outputQuality: '1080p' | '4k',
  customBrief?: string | null,
): Promise<GeneratedImage> {
  if (!referenceImages.length) throw new Error('No captured website brand references are available for icon generation.');
  const directions = [
    'A refined minimal symbol with exceptional small-size clarity and balanced negative space.',
    'A premium dimensional emblem with subtle depth, controlled highlights, and a modern app-icon finish.',
    'A bold geometric brand mark distilled from the website visual identity, recognizable in one glance.',
    'An elegant editorial icon with a distinctive silhouette and a sophisticated brand-appropriate color treatment.',
  ];
  const prompt = `Design ONE original square website/app icon concept for "${siteTitle}" using the attached real website screenshots and captured icon/logo as brand references.

CONCEPT ${conceptIndex + 1} DIRECTION:
${directions[conceptIndex % directions.length]}

USER DIRECTION:
${customBrief?.trim() || 'Choose the strongest professional direction that best fits this website.'}

BRAND ANALYSIS:
- Study what the website sells or does, its existing icon/logo, dominant colors, visual mood, shapes, and audience.
- Preserve the real brand identity and make the result feel designed specifically for this site—not a generic AI icon.
- Use the existing mark as a reference, then intelligently refine or reinterpret it into a cleaner, more distinctive icon. Do not copy unrelated brands.

ICON REQUIREMENTS:
- Exact 1:1 square composition, one clear centered mark, strong silhouette, generous safe padding, and excellent readability from 16px favicon size through mobile app-icon size.
- Premium, polished, modern finish suitable for browser favicon, mobile shortcut, social avatar, and branded video ending.
- Avoid thin fragile details, busy backgrounds, mockup devices, screenshots pasted into the result, watermarks, random decorative objects, and stock-template styling.
- Do not invent random letters or words. Only preserve a real existing initial/monogram when it is clearly supported by the captured brand, or when the user's request explicitly asks for it.
- No presentation sheet, no multiple icons in one image, no browser frame, no explanatory text. Return only the finished icon artwork.

MOOD:
${vibe}`;

  return runImageGeneration(
    jobId,
    conceptIndex,
    'website-icon',
    'website-icon-concept',
    prompt,
    referenceImages,
    '1:1',
    outputQuality,
    'website_icon_generation',
  );
}

/**
 * Create a marketing image from the website captures as visual references.
 * Unlike website-video rendering, photo mode is intentionally creative: users
 * can ask for ad/lifestyle/background/composition edits. Brand/product identity
 * stays anchored to the captured source, while website UI text is never redrawn.
 */
export async function generateMarketingPhoto(
  jobId: string,
  sceneIndex: number,
  siteTitle: string,
  concept: string,
  sceneDescription: string,
  _onScreenCopy: string,
  vibe: string,
  referenceImages: Buffer[],
  aspectRatio: '16:9' | '9:16' | '1:1',
  outputQuality: '1080p' | '4k',
  customBrief?: string | null,
): Promise<GeneratedImage> {
  if (!referenceImages.length) {
    throw new Error('No captured website images are available to use as references for the marketing photo.');
  }

  const userDirection = customBrief?.trim() || 'Create the strongest premium marketing image based on the captured website and products.';
  const prompt = `Create ONE premium marketing campaign image for "${siteTitle}" using the attached website captures as the source references.

USER REQUEST — FOLLOW THIS CLOSELY:
${userDirection}

CAMPAIGN CONCEPT:
${concept}

THIS IMAGE'S ART DIRECTION:
${sceneDescription}

MOOD:
${vibe}

SOURCE-OF-TRUTH RULES:
- The attached screenshots define the real brand, products, colors, logos, product shapes, materials, clothing, shoes, packaging, and visual identity.
- Preserve recognizable product identity and brand identity. Do not substitute a different product, logo, garment, colorway, or design unless the user explicitly requested that exact change.
- If a real person/model from a source image remains in the result, preserve their recognizable appearance and clothing unless the user explicitly requests a different marketing treatment.

CREATIVE PHOTO EDITING IS ALLOWED:
- You MAY isolate or feature a real captured product and place it into a new premium marketing environment.
- You MAY change or create the background, studio setup, lighting, surface, props, composition, crop, depth, shadows, reflections, and campaign atmosphere when that helps satisfy the user's request.
- You MAY create social-ad, editorial, product-hero, lifestyle, seasonal, launch, sale, or campaign-style imagery based on the real captured products and brand.
- You MAY remove irrelevant website chrome when the goal is a standalone marketing image.
- The result should look intentionally art-directed, not like a screenshot pasted into a template.

CRITICAL TEXT / UI SAFETY:
- Do NOT invent random words, fake prices, fake product names, fake Arabic, fake English, fake buttons, or fake website copy.
- Do NOT add any new typography unless the user's request explicitly asks for text in the marketing image.
- If any part of the actual website UI/screenshot is shown in the final image, keep that UI visually faithful to the source. Do not redraw, translate, correct, restyle, or replace its existing text.
- Never "improve" Arabic or English website text. Existing text must remain as it appears in the source image.
- When in doubt, omit generated text and let the product/visual carry the ad.

QUALITY:
Premium commercial art direction, realistic materials and fabric, accurate product geometry, natural highlights, controlled reflections, intentional negative space, clean shadows, balanced composition, high-end fashion/SaaS advertising finish as appropriate to the source site. Avoid distorted faces or hands, duplicated products, extra limbs, warped logos, random text, watermarks, unrelated brands, oversaturation, blur, low-resolution details, and stock-template styling.`;

  return runImageGeneration(jobId, sceneIndex, 'photo', 'photo', prompt, referenceImages, aspectRatio, outputQuality);
}

/**
 * Generate ONE cinematic frame for demo-mode's generative brand film. This is
 * the only place in the app that produces fully AI-composited frames intended
 * to be cut together into a single video — so, unlike a standalone marketing
 * photo, every call must be explicitly told the shared "style bible" (from
 * the storyboard's concept/vibe) so consecutive scenes look like they belong
 * to the same film instead of unrelated stock images.
 */
export async function generateCinematicSceneImage(
  jobId: string,
  sceneIndex: number,
  siteTitle: string,
  concept: string,
  shotDescription: string,
  onScreenCopy: string,
  vibe: string,
  referenceImages: Buffer[],
  aspectRatio: '16:9' | '9:16' | '1:1',
  outputQuality: '1080p' | '4k',
  customBrief?: string | null,
): Promise<GeneratedImage> {
  if (!referenceImages.length) {
    throw new Error('No captured website images are available to use as brand/product references for this cinematic scene.');
  }

  const captionInstruction = onScreenCopy?.trim()
    ? `Bake this exact short caption into the frame, in clean premium typography that matches the rest of the film: "${onScreenCopy.trim()}". Do not add any other text.`
    : 'Do not add any on-image typography to this frame unless it is the real captured logo wordmark.';

  const prompt = `Create ONE cinematic frame for a premium AI-generated SaaS/brand product film for "${siteTitle}", in the style of an Apple, Linear, Framer, or polished product launch video. This single frame will later be given one slow camera move (push-in/pull-out/pan) and cut together with the film's other scenes — it must look like it belongs to the exact same continuous film as those other scenes.

FILM CONCEPT (shared by every scene — match its lighting, palette, and mood exactly):
${concept}

MOOD:
${vibe}

THIS SCENE'S SHOT:
${shotDescription}

ON-IMAGE TEXT:
${captionInstruction}

SOURCE-OF-TRUTH RULES (do not violate these — this is still an ad for a real business):
- The attached screenshots are the ONLY source for the real logo, product photography, brand colors, and any UI content shown inside a device mockup or feature card in this frame.
- Never substitute a different logo, brand name, or product than what is actually captured.
- Do NOT invent product names, prices, discount claims, review/user counts, or specific feature or capability claims. If a feature card names a capability, it must be visibly present in the captured site's own navigation, headings, or copy — otherwise omit the claim entirely.
- If a real captured UI screen is shown inside a device mockup, keep its real text/layout recognizable rather than inventing a different interface.

CINEMATIC TREATMENT:
- Premium 3D device mockups (tablet/phone), glassmorphism UI/feature cards, soft studio or lifestyle backdrop (e.g. marble surface, soft daylight, gentle shadows, subtle particles) — full-bleed, one clear focal subject, generous headroom and negative space so a slow push/pan reads well.
- Consistent color grade and light direction with the rest of this film's concept — do not introduce a different backdrop, material palette, or lighting mood scene to scene.
- No UI screenshots pasted flat with no composition — every real UI element must be presented inside an intentional mockup, card, or device frame.

QUALITY:
Photoreal materials and reflections, accurate device geometry, clean shadows, balanced composition, high-end product-launch commercial finish. Avoid distorted hands/faces, warped logos, illegible or garbled text, watermarks, unrelated brands, oversaturation, blur, and stock-template styling.
${customBrief?.trim() ? `\nADDITIONAL CUSTOMER NOTES:\n${customBrief.trim()}` : ''}`;

  return runImageGeneration(jobId, sceneIndex, 'demo-scene', 'demo-scene', prompt, referenceImages, aspectRatio, outputQuality);
}
