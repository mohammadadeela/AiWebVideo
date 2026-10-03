/**
 * Server-owned creative direction for studio productions.
 *
 * Everything here runs on the server so that:
 *  - every production gets the master direction even when the customer types their own
 *    prompt and never touches an Idea chip,
 *  - the master text never appears in the customer's chat, "Goal" line or regenerate box
 *    (those show the customer's own words only),
 *  - structured inputs such as site dimensions are turned into precise, unit-labelled
 *    instructions instead of raw "plotWidth: 20" fragments.
 */

export interface ArchitectureInput {
  location?: string;
  mapUrl?: string;
  latitude?: number;
  longitude?: number;
  plotWidth?: number;
  plotDepth?: number;
  floors?: number;
  setback?: number;
  estimatedScale?: boolean;
}

export type StudioKind = 'product' | 'idea' | 'scenario' | 'interior' | 'architecture';

export const USER_BRIEF_HEADER = 'USER DESIGN BRIEF (highest-priority creative direction):';
const DIRECTION_MARKER = 'AIWEBVIDEO STUDIO DIRECTION';
// Text older cached frontends prepended themselves; never add the same direction twice.
const LEGACY_FRONTEND_MARKER = "professional architectural visualization director";

export const INTERIOR_MASTER_DIRECTION = `${DIRECTION_MARKER} — INTERIOR DESIGN
You are AiWebVideo's senior interior architect and visualization director. Every supplied photo, floor plan, sketch, elevation and written measurement is engineering reference data.
- Preserve the existing shell: footprint, ceiling and roof geometry, curves, openings, columns, stairs, doors, windows and built-ins, unless the customer explicitly asks to change them.
- Numbers the customer supplies are authoritative. Never silently rescale them. When a dimension cannot be verified from the references, do not invent precision; keep proportions visually consistent.
- Reconstruct perspective and spatial relationships from ALL references together, not from one image.
- Furniture, joinery and fixtures must be at realistic human scale with real clearances and circulation. Materials need believable seams, edges and light response.
- Every image of a set shows the SAME space: identical walls, openings, ceiling, floor and design; only the camera changes.
- Produce photoreal architectural photography suitable for a client or engineer presentation. Straight lines stay straight; verticals stay vertical.
- Avoid impossible furniture, floating objects, warped lines, changing room dimensions, invented rooms, random fixtures, fake construction details, watermarks, text overlays and lettering.`;

export const ARCHITECTURE_MASTER_DIRECTION = `${DIRECTION_MARKER} — ARCHITECTURE ON A REAL SITE
You are AiWebVideo's senior architectural visualization director working for licensed architects and engineers. The task is to place a NEW building on a REAL site so the result is a credible, presentation-quality visualization.

SITE FIDELITY
- The attached site references (map or satellite screenshot, site photo, plan) are ground truth for the surroundings: which side the street is on, neighbouring buildings, vegetation, terrain, orientation and light direction. Reproduce them faithfully. Never invent a different street, skyline or neighbourhood.
- If only a map or satellite view is supplied, read the plot's position relative to roads and neighbours from it and keep that same orientation in every image.

DIMENSIONS
- Numeric inputs are authoritative and in metres. The building footprint must fit inside the plot width x depth minus the setback on every side. Never exceed the stated number of floors. Keep floor-to-floor height realistic (about 3.0-3.5 m residential, 3.5-4.5 m commercial) so the overall height matches the floor count.
- Never claim survey-grade accuracy. When dimensions are marked as estimated, keep proportions plausible and never draw dimension lines or labels.

BUILDING REFERENCE
- If a building, elevation or render reference is attached, that building's massing, facade rhythm, materials and roof form ARE the design to place. Adapt only its scale and orientation to the plot. Do not redesign it.

CONSISTENCY
- Every image of a set shows the SAME building on the SAME plot: identical massing, floor count, materials, entrance position and orientation. Only the camera and the light change.

QUALITY
- Photoreal architectural photography: correct perspective with vertical lines kept vertical, physically plausible light and shadows consistent with the site's orientation, believable materials with real joints and edges, landscaping that belongs to the site, the building firmly grounded on the terrain, and people or cars only at correct scale and sparingly.

AVOID
- Floating or warped geometry, extra floors, a building outside the plot, inconsistent windows, impossible cantilevers, fake construction drawings, invented signage or any lettering, watermarks, text overlays, dimension lines and inset mini-maps.`;

function metres(value: number) {
  return `${Number(value.toFixed(2))} m`;
}

/** Turns the raw form values into precise, unit-labelled site instructions. */
export function architectureContext(input: ArchitectureInput | null | undefined): string {
  if (!input) return '';
  const lines: string[] = [];
  const place = input.location?.trim();
  if (place) lines.push(`- Location: ${place}`);
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    lines.push(`- Coordinates: ${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)} (use them only to understand the region, climate, vegetation and sun path)`);
  }
  if (input.mapUrl) lines.push(`- Google Maps link supplied by the customer: ${input.mapUrl}`);

  const { plotWidth: width, plotDepth: depth, setback, floors } = input;
  if (width && depth) {
    lines.push(`- Plot: ${metres(width)} wide x ${metres(depth)} deep (${Number((width * depth).toFixed(1))} m2)${input.estimatedScale ? ' — ESTIMATED by the customer, treat as approximate' : ' — exact figures from the customer'}`);
    if (setback && setback > 0) {
      const buildableWidth = width - 2 * setback;
      const buildableDepth = depth - 2 * setback;
      if (buildableWidth > 0 && buildableDepth > 0) {
        lines.push(`- Setback: ${metres(setback)} from the plot boundary, so the maximum building footprint is ${metres(buildableWidth)} x ${metres(buildableDepth)}`);
      } else {
        lines.push(`- Setback: ${metres(setback)} was entered but it is larger than half of the plot; ignore it and keep a modest, plausible setback`);
      }
    }
  } else if (input.estimatedScale) {
    lines.push('- Plot size: not supplied. The customer asked for an estimated site scale, so infer a plausible plot from the site references and keep it consistent in every image');
  }
  if (floors && floors > 0) lines.push(`- Floors: exactly ${floors} above ground. Do not add or remove a floor`);

  if (!lines.length) return '';
  return `SITE AND ENGINEERING INPUTS (authoritative customer data):\n${lines.join('\n')}`;
}

export function studioMasterDirection(kind: StudioKind | null | undefined): string {
  if (kind === 'interior') return INTERIOR_MASTER_DIRECTION;
  if (kind === 'architecture') return ARCHITECTURE_MASTER_DIRECTION;
  return '';
}

const HIDDEN_OPEN = '[[AIWEBVIDEO_DIRECTION]]';
const HIDDEN_CLOSE = '[[/AIWEBVIDEO_DIRECTION]]';

/**
 * Website-mode Idea chips travel inside the brief between these markers so they survive every hop
 * (landing preview, sign-in redirect, drafts). The server splits them off on arrival: the customer's
 * own words are stored and shown, the direction is kept separately and used only when directing.
 */
export function splitHiddenDirection(text: string | null | undefined): { text: string | undefined; direction: string } {
  if (text === null || text === undefined) return { text: undefined, direction: '' };
  const start = text.indexOf(HIDDEN_OPEN);
  if (start < 0) return { text, direction: '' };
  const end = text.indexOf(HIDDEN_CLOSE, start);
  const direction = text.slice(start + HIDDEN_OPEN.length, end < 0 ? undefined : end).trim().slice(0, 6000);
  const rest = `${text.slice(0, start)}${end < 0 ? '' : text.slice(end + HIDDEN_CLOSE.length)}`.trim();
  return { text: rest, direction };
}

/** The customer's own words, without any direction we added. */
export function extractUserBrief(brief: string | null | undefined): string {
  const text = splitHiddenDirection(brief).text ?? '';
  const at = text.indexOf(USER_BRIEF_HEADER);
  return (at >= 0 ? text.slice(at + USER_BRIEF_HEADER.length) : text).trim();
}


// ---------------------------------------------------------------------------------------------------------
// What the AI learned about the product / the site (see studio-insights.ts). Pure data + pure rendering.
// ---------------------------------------------------------------------------------------------------------

export const PROJECT_SCOPES = ['new_building', 'fit_out_interior', 'facade_retrofit', 'storefront_exterior', 'extension', 'landscape'] as const;
export type ProjectScope = (typeof PROJECT_SCOPES)[number];

export interface ProductFactsInput {
  title?: string;
  description?: string;
  facts?: Record<string, string | undefined>;
}

export interface ProductInsights {
  name: string;
  category: string;
  brand?: string;
  summary: string;
  keyFeatures: string[];
  colors: string[];
  materials: string[];
  /** Details a faithful image or film must not change: logos, printed text, shape, proportions, hardware. */
  mustPreserve: string[];
  approximateSize?: string;
  suggestedScenes: string[];
  audience?: string;
  avoid: string[];
}

export interface SiteInsights {
  placeName?: string;
  address?: string;
  settlement: string;
  siteCondition: string;
  whatIsHere: string;
  frontage?: string;
  surroundings: string[];
  neighbourHeights?: string;
  localCharacter: string[];
  climate?: string;
  constraints: string[];
  projectScope: ProjectScope;
  scopeReason?: string;
  /** The customer's wish translated onto THIS site. */
  designBrief: string;
  confidence: 'high' | 'medium' | 'low';
  unknowns: string[];
}

const SCOPE_LABELS: Record<ProjectScope, string> = {
  new_building: 'a NEW building on the plot',
  fit_out_interior: 'the INTERIOR fit-out of a unit inside an existing building (the shell, structure and facade stay as they are)',
  facade_retrofit: 'a FACADE / exterior renovation of an existing building (massing and structure stay)',
  storefront_exterior: 'a STOREFRONT on the street: the shop frontage, signage zone, entrance and glazing of an existing unit',
  extension: 'an EXTENSION or additional floors on an existing building',
  landscape: 'LANDSCAPE / outdoor design of the site',
};

/**
 * Works out what the customer actually wants built from their own words, so "make me a clothes shop" on a
 * link to an apartment block is read as a shop fit-out and not as a new tower. A model refines this with the site;
 * this keyword reading is the fallback and the starting point.
 */
export function inferProjectScope(brief: string | null | undefined, siteHint?: string | null): ProjectScope {
  const text = `${brief ?? ''} ${siteHint ?? ''}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  if (has(/\b(landscap|garden|courtyard|park|pool area|outdoor space)\b/)) return 'landscape';
  if (has(/\b(extension|add (?:\w+ ){0,3}floors?|extra floors?|vertical extension|rooftop addition)\b/)) return 'extension';
  if (has(/\b(facade|façade|renovat|refurbish|re-?clad|exterior (?:redesign|makeover)|repaint the building)\b/)) return 'facade_retrofit';
  if (has(/\b(storefront|shop ?front|shop sign|signage|shop window|entrance of the shop)\b/)) return 'storefront_exterior';
  if (has(/\b(inside|interior|fit-?out|layout|inside the (?:shop|unit|apartment|store)|existing (?:unit|apartment|shop|store|space|building)|rented|rent)\b/)) return 'fit_out_interior';
  if (has(/\b(land|plot|empty|vacant|build (?:a|an|me)|new building|from scratch|ground-?up|construct)\b/)) return 'new_building';
  if (has(/\b(shop|store|boutique|clinic|salon|restaurant|cafe|café|office|gym|showroom)\b/) && has(/\b(apartment|unit|flat|building|mall|market|floor|ground floor)\b/)) return 'fit_out_interior';
  return 'new_building';
}

export function isProjectScope(value: unknown): value is ProjectScope {
  return typeof value === 'string' && (PROJECT_SCOPES as readonly string[]).includes(value);
}

function bullet(label: string, value: string | undefined | null) {
  return value && value.trim() ? `- ${label}: ${value.trim()}` : null;
}
function list(label: string, values: string[] | undefined) {
  return values && values.length ? `- ${label}: ${values.join('; ')}` : null;
}

export function productInsightsBlock(insights: ProductInsights | null | undefined, facts?: ProductFactsInput | null): string {
  if (!insights && !facts?.title) return '';
  const lines: Array<string | null> = [];
  if (insights) {
    lines.push(
      bullet('Product', insights.name), bullet('Category', insights.category), bullet('Brand', insights.brand),
      bullet('What it is', insights.summary), list('Key features', insights.keyFeatures), list('Colors', insights.colors),
      list('Materials', insights.materials), bullet('Real-world size', insights.approximateSize),
      list('MUST BE REPRODUCED EXACTLY (do not redraw, restyle or invent)', insights.mustPreserve),
      list('Scenes that suit it', insights.suggestedScenes), bullet('Who it is for', insights.audience), list('Avoid', insights.avoid),
    );
  } else if (facts) {
    lines.push(bullet('Product', facts.title), bullet('From the product page', facts.description?.slice(0, 300)),
      ...Object.entries(facts.facts ?? {}).map(([key, value]) => bullet(key, value)));
  }
  const body = lines.filter(Boolean).join('\n');
  if (!body) return '';
  return `PRODUCT FACTS (read from the product page and its photos). The product in the supplied photos IS the product: keep its exact shape, proportions, colors, materials, printed text and logos. Never invent a different product or add features it does not have:\n${body}`;
}

export function siteInsightsBlock(insights: SiteInsights | null | undefined): string {
  if (!insights) return '';
  const lines = [
    bullet('Place', [insights.placeName, insights.address].filter(Boolean).join(' — ')),
    bullet('Area type', insights.settlement), bullet('What is at this exact spot', insights.whatIsHere),
    bullet('Site condition', insights.siteCondition), bullet('Street frontage', insights.frontage),
    list('Surroundings', insights.surroundings), bullet('Neighbouring building heights', insights.neighbourHeights),
    list('Local architectural character', insights.localCharacter), bullet('Climate', insights.climate), list('Constraints', insights.constraints),
  ].filter(Boolean).join('\n');
  return `SITE ANALYSIS (worked out from the customer's location; the customer's own words and supplied images win wherever they conflict):
${lines}
PROJECT SCOPE: ${insights.projectScope} — this is ${SCOPE_LABELS[insights.projectScope]}.${insights.scopeReason ? ` (${insights.scopeReason})` : ''}
DESIGN INTENT FOR THIS SITE: ${insights.designBrief}
Confidence in this analysis: ${insights.confidence}.${insights.unknowns.length ? ` Not known (do not invent these): ${insights.unknowns.join('; ')}.` : ''}`;
}

/** Reads the scope back out of a directed brief, so the image step can choose the right camera views. */
export function extractProjectScope(directedBrief: string | null | undefined): ProjectScope | null {
  const match = /PROJECT SCOPE:\s*([a-z_]+)/.exec(directedBrief ?? '');
  return match && isProjectScope(match[1]) ? match[1] : null;
}

/**
 * Builds the brief the AI planner and renderers receive. The customer's own words always come
 * last and carry the highest priority. Idempotent: an already-directed brief is returned as is.
 */
export function composeStudioBrief(input: {
  studioKind?: StudioKind | null;
  architecture?: ArchitectureInput | null;
  userBrief?: string | null;
  hiddenDirection?: string | null;
  productFacts?: ProductFactsInput | null;
  productInsights?: ProductInsights | null;
  siteInsights?: SiteInsights | null;
  /** Figures read exactly from the customer's CAD drawing (see cad-drawing.ts). Interior and architecture only. */
  drawingBrief?: string | null;
}): string {
  const userBrief = (input.userBrief ?? '').trim();
  if (userBrief.includes(DIRECTION_MARKER) || userBrief.includes(LEGACY_FRONTEND_MARKER)) return userBrief;

  const sections: string[] = [];
  const master = studioMasterDirection(input.studioKind);
  if (master) sections.push(master);
  if (input.studioKind === 'architecture') {
    const context = architectureContext(input.architecture);
    if (context) sections.push(context);
    // Without any analysis the scope is still read from the customer's own words.
    const site = siteInsightsBlock(input.siteInsights);
    sections.push(site || `PROJECT SCOPE: ${inferProjectScope(userBrief)} — this is ${SCOPE_LABELS[inferProjectScope(userBrief)]}.`);
  }
  if ((input.studioKind === 'architecture' || input.studioKind === 'interior') && input.drawingBrief?.trim()) sections.push(input.drawingBrief.trim());
  if (input.studioKind === 'product') {
    const product = productInsightsBlock(input.productInsights, input.productFacts);
    if (product) sections.push(product);
  }
  const hidden = (input.hiddenDirection ?? '').trim();
  if (hidden) sections.push(`ADDITIONAL DIRECTION (the customer's own words below override it wherever they conflict):\n${hidden}`);
  if (!sections.length) return userBrief;
  if (userBrief) sections.push(`${USER_BRIEF_HEADER}\n${userBrief}`);
  return sections.join('\n\n');
}

/** Four consistent views of one design, used to vary the camera and never the design. */
export const INTERIOR_VIEW_ROLES = [
  'VIEW 1 — WIDE ESTABLISHING VIEW from the natural entrance or best vantage point, showing the whole space and the main design idea.',
  'VIEW 2 — REVERSE ANGLE from the opposite side of the SAME space, revealing the walls, openings and zones not visible in view 1.',
  'VIEW 3 — CEILING, LIGHTING AND MATERIAL DETAIL of the SAME design: a closer, intentional composition that shows craft and finish.',
  'VIEW 4 — HERO PRESENTATION VIEW: the strongest composition of the finished design, suitable for the cover of a client presentation.',
] as const;

export const ARCHITECTURE_VIEW_ROLES = [
  'VIEW 1 — EYE-LEVEL STREET VIEW: the building as a passer-by sees it from the street side of the plot, in soft daylight, showing its relationship to the neighbours.',
  'VIEW 2 — ELEVATED THREE-QUARTER VIEW: the same building from about 25-40 m up, showing the whole plot, setbacks, landscaping and surroundings.',
  'VIEW 3 — DUSK VIEW: the same building at blue hour with warm interior light, from a slightly different street-level angle.',
  'VIEW 4 — ENTRANCE AND FACADE DETAIL: a closer view of the entrance, materials and facade rhythm of the same building, keeping the site visible behind it.',
] as const;

/**
 * Added when a customer starts from a showcase sample ("make one like this with MY product").
 * The sample is attached as the LAST reference image; the customer's own references come first.
 */
export const TEMPLATE_REPLACEMENT_DIRECTION = `REPLACEMENT TEMPLATE
One attached reference image is a finished SAMPLE (it is marked "STYLE SAMPLE"). Recreate that sample for the customer:
- Keep the sample's composition, camera angle and movement, framing, lighting, colour mood, pacing, environment style and overall production quality.
- REPLACE the sample's subject completely with the subject shown in the customer's own reference images (their product, person, space or building). The customer's references are the ground truth for identity: exact shape, proportions, colours, materials, logos and details. Never keep, blend in or resemble the sample's original subject, branding or text.
- Place the customer's subject naturally into the scene: correct scale, perspective, contact shadows, reflections and lighting that match the sample's environment.
- If the customer's own words ask for changes to the sample (colours, background, mood, camera), apply them; their words win over the sample.
- Do not show the sample image itself, a split screen, a collage or any text.`;

/** Street-level views for a shop front: the face the customer's business shows to the road. */
export const STOREFRONT_VIEW_ROLES = [
  'VIEW 1 — EYE-LEVEL STREET VIEW of the SAME shop front as a passer-by sees it, in soft daylight, with the neighbouring units visible.',
  'VIEW 2 — ENTRANCE CLOSE-UP of the same shop front: door, glazing, signage zone (no readable lettering) and the first metres of the interior.',
  'VIEW 3 — DUSK VIEW of the same shop front with warm interior light spilling onto the pavement.',
  'VIEW 4 — INSIDE-OUT VIEW from just inside the entrance looking out through the glazing to the street.',
] as const;

export function viewRolesForScope(scope: ProjectScope | null, kind: 'interior-design' | 'architecture') {
  if (scope === 'fit_out_interior') return INTERIOR_VIEW_ROLES;
  if (scope === 'storefront_exterior') return STOREFRONT_VIEW_ROLES;
  return kind === 'architecture' ? ARCHITECTURE_VIEW_ROLES : INTERIOR_VIEW_ROLES;
}
