import { GoogleGenAI } from '@google/genai';
import { recordGeminiTextUsage } from './costs.js';
import { runQueuedProviderCall } from './provider-queue.js';
import {
  PROJECT_SCOPES,
  describeTarget,
  inferProjectScope,
  isProjectScope,
  type ArchitectureInput,
  type ProductFactsInput,
  type ProductInsights,
  type SiteInsights,
} from './studio-direction.js';

/**
 * The AI "understands" the product or the site BEFORE anything is generated, so the result matches what the
 * customer actually has. It runs inside the planning step, which has already reserved the customer's credits.
 * Every failure is non-fatal: without insights the production continues with the customer's own inputs.
 */

export interface InsightPart { text?: string; inlineData?: { mimeType: string; data: string } }
export interface InsightRequest { jobId: string; operation: string; parts: InsightPart[]; maps?: { latitude: number; longitude: number } | null }
export type InsightGenerator = (request: InsightRequest) => Promise<string>;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const ANALYSIS_TIMEOUT_MS = 28_000;

const geminiGenerator: InsightGenerator = async (request) => {
  const model = process.env.GEMINI_ANALYSIS_MODEL?.trim() || process.env.GEMINI_STORYBOARD_MODEL?.trim() || 'gemini-3.6-flash';
  const ai = getClient();
  const config = request.maps
    // Grounding with Google Maps: the model can look up what is really at and around the point.
    ? { tools: [{ googleMaps: {} }], toolConfig: { retrievalConfig: { latLng: request.maps } }, temperature: 0.2 }
    : { responseMimeType: 'application/json', temperature: 0.2 };
  const response = await runQueuedProviderCall({
    kind: 'storyboard',
    model,
    operation: request.operation,
    jobId: request.jobId,
    task: () => ai.models.generateContent({ model, contents: [{ role: 'user', parts: request.parts }], config } as never),
  });
  await recordGeminiTextUsage(request.jobId, model, request.operation, response.usageMetadata);
  return response.text ?? '';
};

// ---- parsing and sanitising: model output is untrusted text that ends up inside later prompts -------------------

/** Pulls the first JSON object out of a model reply, tolerating code fences and chatter around it. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/\[\[\/?AIWEBVIDEO[^\]]*\]\]/gi, ' ')           // never let model text pose as our own markers
    .replace(/AIWEBVIDEO STUDIO DIRECTION|USER DESIGN BRIEF|PROJECT SCOPE:/gi, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function cleanList(value: unknown, maxItems: number, maxLength: number): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;\n]/) : [];
  return items.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

export function normalizeProductInsights(raw: Record<string, unknown> | null): ProductInsights | null {
  if (!raw) return null;
  const name = clean(raw.name, 120);
  const summary = clean(raw.summary, 400);
  if (!name && !summary) return null;
  return {
    name: name || summary.slice(0, 80),
    category: clean(raw.category, 80) || 'product',
    brand: clean(raw.brand, 80) || undefined,
    summary,
    keyFeatures: cleanList(raw.keyFeatures, 8, 120),
    colors: cleanList(raw.colors, 8, 40),
    materials: cleanList(raw.materials, 8, 60),
    mustPreserve: cleanList(raw.mustPreserve, 10, 140),
    approximateSize: clean(raw.approximateSize, 80) || undefined,
    suggestedScenes: cleanList(raw.suggestedScenes, 6, 140),
    audience: clean(raw.audience, 120) || undefined,
    avoid: cleanList(raw.avoid, 6, 120),
  };
}

export function normalizeSiteInsights(raw: Record<string, unknown> | null, customerBrief: string): SiteInsights | null {
  if (!raw) return null;
  const whatIsHere = clean(raw.whatIsHere, 300);
  const designBrief = clean(raw.designBrief, 700);
  if (!whatIsHere && !designBrief) return null;
  const confidence = clean(raw.confidence, 10).toLowerCase();
  const scope = isProjectScope(raw.projectScope) ? raw.projectScope : inferProjectScope(customerBrief, whatIsHere);
  return {
    placeName: clean(raw.placeName, 120) || undefined,
    address: clean(raw.address, 200) || undefined,
    settlement: clean(raw.settlement, 40) || 'unknown',
    siteCondition: clean(raw.siteCondition, 40) || 'unknown',
    whatIsHere: whatIsHere || 'unknown',
    frontage: clean(raw.frontage, 200) || undefined,
    surroundings: cleanList(raw.surroundings, 6, 140),
    neighbourHeights: clean(raw.neighbourHeights, 80) || undefined,
    localCharacter: cleanList(raw.localCharacter, 6, 100),
    climate: clean(raw.climate, 160) || undefined,
    constraints: cleanList(raw.constraints, 6, 140),
    projectScope: scope,
    scopeReason: clean(raw.scopeReason, 200) || undefined,
    designBrief: designBrief || clean(customerBrief, 400),
    confidence: confidence === 'high' || confidence === 'low' ? confidence : 'medium',
    unknowns: cleanList(raw.unknowns, 6, 120),
  };
}

function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  return Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ANALYSIS_TIMEOUT_MS))]);
}

// ---- product -------------------------------------------------------------------------------------------------------

export async function analyzeProduct(
  input: { jobId: string; facts?: ProductFactsInput | null; customerBrief?: string | null; images: Array<{ label: string; base64: string; mimeType?: string }> },
  generate: InsightGenerator = geminiGenerator,
): Promise<ProductInsights | null> {
  const images = input.images.filter((image) => image.base64).slice(0, 4);
  if (!images.length && !input.facts?.title) return null;
  const known = [
    input.facts?.title ? `Page title: ${clean(input.facts.title, 160)}` : '',
    input.facts?.description ? `Page description: ${clean(input.facts.description, 400)}` : '',
    ...Object.entries(input.facts?.facts ?? {}).map(([key, value]) => `${clean(key, 20)}: ${clean(value, 60)}`),
  ].filter(Boolean).join('\n');
  const parts: InsightPart[] = [
    { text: `You are a product photographer's producer. Study the attached product photos${known ? ' and the facts from its product page' : ''}. Describe the product ACCURATELY so that images and films made later reproduce it exactly.

${known ? `FACTS FROM THE PAGE (may be incomplete):\n${known}\n\n` : ''}${input.customerBrief ? `WHAT THE CUSTOMER WANTS TO MAKE: ${clean(input.customerBrief, 400)}\n\n` : ''}Reply with ONLY one JSON object with these keys: name, category, brand, summary (what it is, one or two sentences), keyFeatures (array), colors (array), materials (array), mustPreserve (array: logos, printed text, shape, proportions, hardware, patterns that must never change), approximateSize, suggestedScenes (array of settings where this product naturally belongs), audience, avoid (array of things that would misrepresent it). Describe only what you can SEE or what the facts state. Use an empty string or empty array when unknown. Never invent a brand, claim or feature.` },
    ...images.flatMap((image) => [{ text: `PRODUCT PHOTO: ${clean(image.label, 60)}` }, { inlineData: { mimeType: image.mimeType ?? 'image/jpeg', data: image.base64 } }]),
  ];
  try {
    const text = await withTimeout(generate({ jobId: input.jobId, operation: 'product_analysis', parts }));
    return text ? normalizeProductInsights(parseJsonObject(text)) : null;
  } catch (error) {
    console.warn('[insights] product analysis skipped:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ---- site ----------------------------------------------------------------------------------------------------------

export async function analyzeSite(
  input: { jobId: string; architecture: ArchitectureInput; customerBrief: string; images: Array<{ label: string; base64: string; mimeType?: string }> },
  generate: InsightGenerator = geminiGenerator,
): Promise<SiteInsights | null> {
  const { architecture } = input;
  const hasPoint = typeof architecture.latitude === 'number' && typeof architecture.longitude === 'number';
  if (!hasPoint && !architecture.location && !architecture.mapUrl) return null;
  const brief = clean(input.customerBrief, 600);
  const facts = [
    architecture.location ? `Location text: ${clean(architecture.location, 200)}` : '',
    hasPoint ? `Coordinates: ${architecture.latitude}, ${architecture.longitude}` : '',
    architecture.mapUrl ? `Maps link: ${clean(architecture.mapUrl, 300)}` : '',
    architecture.plotWidth && architecture.plotDepth ? `Plot (customer figures, metres): ${architecture.plotWidth} x ${architecture.plotDepth}${architecture.estimatedScale ? ' (estimated)' : ''}` : '',
    architecture.floors ? `Floors wanted: ${architecture.floors}` : '',
    architecture.setback ? `Setback: ${architecture.setback} m` : '',
    ...describeTarget(architecture).map((line) => line.replace(/^- /, '')),
  ].filter(Boolean).join('\n');
  const prompt = `You are a senior architect and site analyst. A customer pointed to a real place and described what they want. Work out what is at and around this exact point, and what they actually want built there.

THE PLACE:
${facts}

WHAT THE CUSTOMER SAID: ${brief || '(nothing beyond the location)'}

${hasPoint ? 'Use Google Maps data for this exact point to see what is really here and next to it (land, shops, apartments, offices, road frontage, neighbours).' : 'Use your knowledge of the named place.'}
Decide the PROJECT SCOPE from their words and what is at the point. If THE PLACE lists a TARGET, the customer chose it explicitly and the scope must follow it (empty land = new_building; one shop or unit = storefront_exterior or fit_out_interior; one floor = fit_out_interior or extension; the whole building = new_building, facade_retrofit or extension). They may be pointing at empty land, an apartment block, a row of shops or a commercial building, and asking for a shop or a design "there". Use one of: ${PROJECT_SCOPES.join(', ')}. (Example: "make me a clothes shop" pointing at an apartment building = fit_out_interior for a ground-floor unit, or storefront_exterior; pointing at empty land = new_building.)

Reply with ONLY one JSON object with keys: placeName, address, settlement (dense_urban | urban | suburban | rural | coastal | desert | mountain | unknown), siteCondition (empty_land | existing_building | shop_unit | apartment_building | mixed_use_block | road_frontage | unknown), whatIsHere (one or two sentences), frontage (which kind of street it faces), surroundings (array), neighbourHeights, localCharacter (array: typical materials, forms, roofs), climate, constraints (array), projectScope, scopeReason, designBrief (3-5 concrete sentences translating THEIR wish onto THIS site), confidence (high | medium | low), unknowns (array of things you could not determine).
Be honest: use "unknown" and lower the confidence rather than guessing. Never invent street names, business names or measurements.`;
  const parts: InsightPart[] = [
    { text: prompt },
    ...input.images.filter((image) => image.base64).slice(0, 3).flatMap((image) => [{ text: `SITE IMAGE: ${clean(image.label, 60)}` }, { inlineData: { mimeType: image.mimeType ?? 'image/jpeg', data: image.base64 } }]),
  ];
  const attempt = async (maps: InsightRequest['maps']) => {
    const text = await withTimeout(generate({ jobId: input.jobId, operation: 'site_analysis', parts, maps }));
    return text ? normalizeSiteInsights(parseJsonObject(text), brief) : null;
  };
  try {
    if (hasPoint && process.env.ARCHITECTURE_MAPS_GROUNDING !== '0') {
      try {
        const grounded = await attempt({ latitude: architecture.latitude as number, longitude: architecture.longitude as number });
        if (grounded) return grounded;
      } catch (error) {
        // The grounding tool may be unavailable for this model or key: continue without it.
        console.warn('[insights] maps grounding unavailable, retrying without it:', error instanceof Error ? error.message : error);
      }
    }
    return await attempt(null);
  } catch (error) {
    console.warn('[insights] site analysis skipped:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Product facts arrive from the browser: trim, cap and strip them before they are stored or put in a prompt. */
export function sanitizeProductFacts(raw: unknown): ProductFactsInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const title = clean(value.title, 160);
  const description = clean(value.description, 500);
  const facts: Record<string, string> = {};
  if (value.facts && typeof value.facts === 'object') {
    for (const [key, item] of Object.entries(value.facts as Record<string, unknown>).slice(0, 10)) {
      const k = clean(key, 24); const v = clean(item, 80);
      if (k && v) facts[k] = v;
    }
  }
  return title || description || Object.keys(facts).length ? { title: title || undefined, description: description || undefined, facts } : null;
}
