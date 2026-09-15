import { GoogleGenAI } from '@google/genai';
import { saveImageFile } from './capture.js';
import { GEMINI_COST_CATALOG, recordGenerationCost } from './costs.js';
import { runQueuedProviderCall } from './provider-queue.js';

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export class StudioProviderError extends Error {
  providerStarted: boolean;
  constructor(message: string, providerStarted: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StudioProviderError';
    this.providerStarted = providerStarted;
  }
}

export interface StudioReferenceImage {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export async function runStudioImageOperation(input: {
  billingJobId: string;
  operationId: string;
  operation: 'generateImage' | 'editImage' | 'removeBackground' | 'eraseObject' | 'replaceBackground' | 'upscale';
  instruction: string;
  references: StudioReferenceImage[];
  aspectRatio: '16:9' | '9:16' | '1:1';
  quality: '1080p' | '4k';
}) {
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
  let providerStarted = false;
  const exactOperation = input.operation;
  const operationRules: Record<typeof exactOperation, string> = {
    generateImage: 'Create one polished new image that follows the user instruction precisely.',
    editImage: 'Edit the supplied image(s) according to the instruction while preserving every identity-critical detail that the user did not explicitly ask to change.',
    removeBackground: 'Remove the existing background cleanly. Preserve the foreground subject exactly, including edges, logos, labels, proportions and colors. Return the subject on a clean neutral/transparent-looking studio background suitable for later compositing.',
    eraseObject: 'Remove only the requested object/person and reconstruct the revealed background coherently. Do not change unrelated subjects, products, logos or text.',
    replaceBackground: 'Replace only the background as requested. Preserve the supplied foreground product/person/logo exactly and integrate it with physically believable light, shadow and perspective.',
    upscale: 'Enhance apparent resolution, fine detail and edge quality without changing identity, text, logos, product geometry, colors or composition.',
  };

  const prompt = `AIWEBVIDEO STUDIO IMAGE OPERATION\n\nUSER INSTRUCTION:\n${input.instruction.trim()}\n\nOPERATION RULE:\n${operationRules[exactOperation]}\n\nQUALITY / FIDELITY RULES:\n- The user instruction is authoritative. Do not add unrelated creative changes.\n- Treat supplied references as exact visual ground truth for products, people, logos, packaging and locations.\n- Preserve readable existing source text as source pixels; never redraw critical typography unless the user explicitly asked for new text.\n- No random text, fake prices, misspelled logos, watermarks, duplicate objects, warped geometry or identity drift.\n- Keep lighting, shadows, reflections, perspective and materials physically coherent.\n- Return one finished image, not a collage or before/after board.\n- Respect the requested ${input.aspectRatio} output composition.`;

  try {
    const output = await runQueuedProviderCall({
      kind: 'image',
      model,
      operation: `studio_${exactOperation}`,
      jobId: input.billingJobId,
      task: async () => {
        providerStarted = true;
        const requestInput: Array<
          { type: 'image'; data: string; mime_type: string } |
          { type: 'text'; text: string }
        > = input.references.slice(0, 4).map((reference) => ({
          type: 'image' as const,
          data: reference.data.toString('base64'),
          mime_type: reference.mimeType,
        }));
        requestInput.push({ type: 'text', text: prompt });
        return getClient().interactions.create({
          model,
          input: requestInput,
          response_format: {
            type: 'image',
            aspect_ratio: input.aspectRatio,
            image_size: input.quality === '4k' ? '4K' : '2K',
          },
        });
      },
    });
    if (!output.output_image?.data) throw new StudioProviderError('The image provider returned no image.', providerStarted);
    const filename = `studio-ai-${input.operationId}-${input.quality}.png`;
    const storageUrl = await saveImageFile(input.billingJobId, filename, Buffer.from(output.output_image.data, 'base64'));
    const defaultCost = input.quality === '4k' ? GEMINI_COST_CATALOG.image.fourK : GEMINI_COST_CATALOG.image.twoK;
    const configuredCost = Number(process.env[input.quality === '4k' ? 'GEMINI_IMAGE_COST_4K_USD' : 'GEMINI_IMAGE_COST_2K_USD'] ?? defaultCost);
    await recordGenerationCost({
      jobId: input.billingJobId,
      provider: 'gemini',
      model,
      operation: `studio_${exactOperation}`,
      quantity: 1,
      unit: 'image',
      unitCostUsd: Math.max(0, configuredCost),
      metadata: { studioOperationId: input.operationId, quality: input.quality },
    });
    return { storageUrl, model, actualCostUsd: Math.max(0, configuredCost) };
  } catch (error) {
    if (error instanceof StudioProviderError) throw error;
    throw new StudioProviderError(error instanceof Error ? error.message : 'Studio image generation failed.', providerStarted, { cause: error });
  }
}
