import { compassName } from './street-view.js';
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
  /** The compass direction (0-359) the customer chose to look in on Street View. Customer-owned. */
  streetViewHeading?: number;
  /** Set by the server when Street View was attached: when it was captured, and how many views. Never from the page. */
  streetViewDate?: string;
  streetViewViews?: number;
  /** How the customer tilted and zoomed the Street View camera (degrees). */
  streetViewPitch?: number;
  streetViewFov?: number;
  /** What the customer pointed at: the whole building, one shop/unit, one floor, or empty land. Customer-owned. */
  targetKind?: TargetKind;
  targetLevel?: TargetLevel;
  /** Where they tapped on the picture, 0-1 from the left / top. */
  targetX?: number;
  targetY?: number;
  /** Tapped on the Street View frame, or on one of their own photos (which one). */
  targetSource?: 'street' | 'photo' | 'nearby';
  targetPhoto?: number;
  /** The nearby street photo (Mapillary id) the customer chose to design from. Validated by the server; attached only if it can be downloaded. */
  nearbyPhotoId?: string;
  /** Set by the server when the nearby photo was attached: the photographer's name, for the attribution CC BY-SA needs. Never from the page. */
  nearbyPhotoCredit?: string;
  /** Set by the server when a copy of the picture with the marker was attached. Never from the page. */
  targetMarked?: boolean;
  /** Set by the server: how many of the customer's own photos or screenshots were attached. Never from the page. */
  ownPhotos?: number;
}

/** Written into the site inputs when real photos of the place are attached; the camera plan reads it. */
export const REAL_PHOTOS_MARKER = '- REAL PHOTOS OF THE PLACE ARE ATTACHED';

export const TARGET_KINDS = ['building', 'unit', 'floor', 'land'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];
export const TARGET_LEVELS = ['basement', 'ground', '1', '2', '3', '4', '5', '6+', 'roof'] as const;
export type TargetLevel = (typeof TARGET_LEVELS)[number];

const LEVEL_WORDS: Record<TargetLevel, string> = {
  basement: 'the basement (below street level)',
  ground: 'the ground floor, at street level',
  '1': 'the 1st floor (one above the ground floor)',
  '2': 'the 2nd floor',
  '3': 'the 3rd floor',
  '4': 'the 4th floor',
  '5': 'the 5th floor',
  '6+': 'an upper floor (6th or higher)',
  roof: 'the roof',
};

function pointWords(x: number | undefined, y: number | undefined): { place: string; percent: string } | null {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  const horizontal = x < 0.34 ? 'left' : x > 0.66 ? 'right' : 'middle';
  const vertical = y < 0.34 ? 'upper' : y > 0.66 ? 'lower' : 'middle';
  const place = vertical === 'middle' && horizontal === 'middle' ? 'the centre' : vertical === 'middle' ? `the ${horizontal}` : `the ${vertical} ${horizontal}`;
  return { place, percent: `about ${Math.round(x * 100)}% from the left and ${Math.round(y * 100)}% from the top` };
}

/**
 * What the customer pointed at, in words the AI can act on. This is the customer's explicit choice: it decides what is being
 * designed, and everything else in the pictures stays as it is.
 */
export function describeTarget(input: ArchitectureInput | null | undefined): string[] {
  if (!input?.targetKind) return [];
  const level = input.targetLevel ? LEVEL_WORDS[input.targetLevel] : '';
  const lines: string[] = [];
  switch (input.targetKind) {
    case 'building':
      lines.push('- TARGET (the customer\'s explicit choice): the WHOLE BUILDING at the marked spot, every floor and the roof. The design is for this entire building');
      break;
    case 'unit':
      lines.push(`- TARGET (the customer\'s explicit choice): ONE SHOP / UNIT at the marked spot, on ${level || 'the ground floor, at street level'}. Design only that unit (its frontage, entrance and glazing from the street, and its interior when asked). The rest of the building, the units above, below and beside it, and the neighbours stay exactly as they are in the pictures`);
      break;
    case 'floor':
      lines.push(`- TARGET (the customer\'s explicit choice): ONE FLOOR of the building at the marked spot: ${level || 'the 1st floor'}. Only that level changes. The other floors, the facade rhythm, the roof and the neighbours stay as in the pictures. If the street cannot see that level (a basement, or an upper floor behind the facade), design it as an interior consistent with the building around it`);
      break;
    case 'land':
      lines.push('- TARGET (the customer\'s explicit choice): EMPTY LAND at the marked spot, a plot with no building to keep. Place a NEW building on exactly that plot. Follow the street line and the setbacks of the neighbours, respect their heights, and keep both neighbours unchanged');
      break;
  }
  const where = pointWords(input.targetX, input.targetY);
  if (where) {
    const onStreet = input.targetSource !== 'photo' && input.targetSource !== 'nearby';
    const pictureWords = input.targetSource === 'photo' ? 'their own photo' : input.targetSource === 'nearby' ? 'the nearby street photo (labelled STREET PHOTO)' : 'the first Street View picture';
    const camera = onStreet && typeof input.streetViewFov === 'number' || (onStreet && typeof input.streetViewPitch === 'number')
      ? `; the camera looks ${typeof input.streetViewPitch === 'number' && input.streetViewPitch > 8 ? `up ${Math.round(input.streetViewPitch)} degrees (to see the upper floors)` : 'level'}${typeof input.streetViewFov === 'number' && input.streetViewFov < 70 ? ' and is zoomed in' : ''}`
      : '';
    lines.push(`- Where: the customer pointed at ${where.place} of ${pictureWords} (${where.percent})${camera}`);
  }
  if (input.targetMarked) {
    lines.push('- A copy of that picture with a red box is attached and labelled TARGET MARKER. The box only shows where the customer pointed. It is a locating aid, not part of the scene, and it must never appear in any result');
  }
  return lines;
}

/** The customer's explicit target decides the kind of project; their words only choose between the close variants. */
export function scopeWithTarget(kind: TargetKind | undefined, fromWords: ProjectScope): ProjectScope {
  switch (kind) {
    case 'land': return 'new_building';
    case 'building': return fromWords === 'facade_retrofit' || fromWords === 'extension' || fromWords === 'landscape' ? fromWords : 'new_building';
    case 'unit': return fromWords === 'fit_out_interior' || fromWords === 'storefront_exterior' ? fromWords : 'storefront_exterior';
    case 'floor': return fromWords === 'extension' || fromWords === 'fit_out_interior' ? fromWords : 'fit_out_interior';
    default: return fromWords;
  }
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
- Avoid impossible furniture, floating objects, warped lines, changing room dimensions, invented rooms, random fixtures, fake construction details, watermarks, text overlays and lettering.

ACCURACY CHECKLIST (verify silently before returning each image)
- Count and keep every window, door, column, beam, niche, step and level change exactly where the references and plan put them; keep their real widths and heights and the wall they belong to.
- Keep the real room proportions: a 4 m wall must not read as 7 m; ceiling height stays what the references or numbers say; furniture is sized to real catalogue dimensions (a sofa seat about 45 cm high, a dining table about 75 cm, a door about 2.1 m) so scale is instantly believable.
- Keep the existing floor, ceiling and wall finishes unless the customer asked to change them; when a material is specified, show its true pattern scale, grout/joint rhythm and sheen.
- Light behaves physically: daylight enters through the real openings in a direction consistent with their position; artificial light matches the fixtures that are actually there or that the customer specified; shadows are soft, consistent and grounded.
- Photographed like a real interior photographer: a real wide lens (16-24 mm full-frame equivalent) at about 1.2-1.5 m camera height, verticals perfectly corrected, exposure balanced between window and room, natural colour, no HDR halos, no over-saturation, no glowing surfaces, no fisheye distortion.
- If a view cannot be rendered without inventing an unseen part of the space, choose a camera position that keeps the unknown area out of frame instead of guessing.`;

export const ARCHITECTURE_MASTER_DIRECTION = `${DIRECTION_MARKER} — ARCHITECTURE ON A REAL SITE
You are AiWebVideo's senior architectural visualization director working for licensed architects and engineers. The task is to place a NEW building on a REAL site so the result is a credible, presentation-quality visualization.

SITE FIDELITY
- The attached site references (map or satellite screenshot, site photo, plan) are ground truth for the surroundings: which side the street is on, neighbouring buildings, vegetation, terrain, orientation and light direction. Reproduce them faithfully. Never invent a different street, skyline or neighbourhood.
- If only a map or satellite view is supplied, read the plot's position relative to roads and neighbours from it and keep that same orientation in every image.
- Street-level photos (marked STREET VIEW) are the eye-level truth about the street: the road width, kerb and pavement, the neighbouring facades on both sides, their heights and materials, trees, poles and signs, and the camera height and lens. For street-level views of the new building, take the camera position and perspective from them, place the building on the plot exactly where it stands in them, and keep both neighbours as they are. Never remove or invent neighbouring buildings, and never copy a person, vehicle or sign from them into the result.

TARGET SELECTION
- When the site inputs state a TARGET (the whole building, one shop or unit, one floor, or empty land) it is the customer's explicit choice and overrides any guess about what is being designed. Design exactly that target and keep everything else in the references unchanged: the neighbouring buildings, the other floors, the facade rhythm and the street.
- A reference labelled TARGET MARKER only shows where the customer pointed. Never draw the marker, its box or a crosshair in any result.

REAL PHOTO FIDELITY (applies whenever the site inputs say real photos of the place are attached)
- This is a PHOTO EDIT, not a new picture. The result must look like the SAME real photograph taken after the work was built: the same position, camera height, angle, lens and framing, the same light, weather and shadows. Someone who knows the street must recognise it at once.
- Keep exactly as photographed, pixel for pixel in spirit: every neighbouring shop and building, their signs and lettering (Arabic included), shutters, awnings, balconies, air-conditioners, cables, poles, pavement, kerb, road, parked cars, trees and sky. Never tidy, clean, restyle, rebuild, move or "improve" anything outside the target.
- Keep the real structure around the target: the wall material and texture, the storey heights, the building outline and its joint with the neighbours, and the position and width of the real openings. The new design fills the real opening(s) of the target at the same scale. Do not widen, heighten, mirror or re-proportion the building.
- Replace the target completely (the old shutters, old sign, old awning, old door) with the new design in the same place. Nothing of the old target survives except what the customer asks to keep.
- Never move the camera to a "better" angle: no straight-on symmetric elevation, no wider lens, no cinematic re-framing, unless THIS image's camera note says so. If the output shape differs from the photo, extend the edges with the true continuation of the same scene.
- Interface marks inside a screenshot (street-view arrows, circles, buttons, the Google logo, copyright text, a red marker box) are not part of the place: leave them out of the result.

DIMENSIONS
- Numeric inputs are authoritative and in metres. The building footprint must fit inside the plot width x depth minus the setback on every side. Never exceed the stated number of floors. Keep floor-to-floor height realistic (about 3.0-3.5 m residential, 3.5-4.5 m commercial) so the overall height matches the floor count.
- Never claim survey-grade accuracy. When dimensions are marked as estimated, keep proportions plausible and never draw dimension lines or labels.

BUILDING REFERENCE
- If a building, elevation or render reference is attached, that building's massing, facade rhythm, materials and roof form ARE the design to place. Adapt only its scale and orientation to the plot. Do not redesign it.

CONSISTENCY
- Every image of a set shows the SAME building on the SAME plot: identical massing, floor count, materials, entrance position and orientation. Only the camera and the light change.

QUALITY
- Photoreal architectural photography: correct perspective with vertical lines kept vertical, physically plausible light and shadows consistent with the site's orientation, believable materials with real joints and edges, landscaping that belongs to the site, the building firmly grounded on the terrain, and people or cars only at correct scale and sparingly.
- Shot like a real architectural photographer: a shift lens or corrected verticals, camera at eye level or a stated vantage, natural time-of-day light with a real sky, honest exposure, true material colours, no HDR glow, no over-saturated sky, no lens flare, no glowing windows in daylight.

ACCURACY CHECKLIST (verify silently before returning each image)
- Floor count, floor-to-floor heights, plot footprint and setbacks match the stated numbers; window and door positions repeat consistently across every view; the entrance is in the same place in every image.
- Facade materials keep real joint patterns and panel sizes (brick courses, stone block sizes, cladding module widths) so the building scale reads correctly against the neighbours and the street furniture.
- The new building meets the ground correctly: kerb, pavement, thresholds and site levels continue from the real photos; no floating plinth, no missing pavement, no steps that lead nowhere.
- Neighbouring buildings, their heights, materials, signs and street elements are reproduced from the references, not approximated.
- Shadows fall in one consistent direction that matches the site orientation and the chosen time of day across the whole set.

AVOID
- Floating or warped geometry, extra floors, a building outside the plot, inconsistent windows, impossible cantilevers, fake construction drawings, invented signage or lettering (only the customer's own shop name, spelled exactly as in their brief, may appear on their own sign; every other sign stays as it is in the photo), watermarks, text overlays, dimension lines and inset mini-maps.`;

/** Product references are engineering truth: a look-alike is a failed render. */
export const PRODUCT_ACCURACY_RULES = `
PRODUCT ACCURACY — THE REAL PRODUCT, NOT A LOOK-ALIKE
- Study every supplied product reference together before composing. Count and lock the product's parts: buttons, ports, straps, pockets, laces, legs, handles, panels, caps and lids; label and logo placement; seams and stitching lines; hardware finish; packaging faces. Nothing may be added, removed, moved or re-proportioned.
- Keep the exact silhouette and proportions from every angle, the exact colour values and finish (matte vs gloss, metallic vs painted, fabric vs leather) and the way each material responds to light.
- Printed text, logos and labels are protected source pixels: identical letterforms, size, position and colour as in the reference. Never respell, translate, restyle or blur them. If a label would be too small to reproduce faithfully, frame wider instead of inventing detail.
- Show only sides and details the references prove. If the back, base or interior is not shown in any reference, keep it in soft focus, in shadow or out of frame rather than inventing it.
- Reflections, contact shadows and refraction must match the product's real materials and the new environment; the product sits with believable weight on its surface.
- One product, once: no duplicates, no colour variants, no "family" of similar items unless the references show them.
`;

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
  lines.push(...describeTarget(input));
  const realPhotos = (input.ownPhotos ?? 0) + (input.streetViewViews ?? 0) + (input.nearbyPhotoCredit ? 1 : 0);
  if (realPhotos > 0) {
    lines.push(`${REAL_PHOTOS_MARKER} (${realPhotos}). The first reference of the customer's own is the photograph to EDIT. Follow REAL PHOTO FIDELITY: same camera, same neighbours, same light, only the target changes`);
  }
  if (input.streetViewViews && input.streetViewViews > 0) {
    lines.push(`- Google Street View: ${input.streetViewViews} real street-level photo${input.streetViewViews === 1 ? '' : 's'} of this exact street are attached (${input.streetViewDate ? `captured ${input.streetViewDate}` : 'capture date unknown'}), the first looking straight at the plot. They show the real road, pavement, neighbouring facades, heights, materials, trees and street furniture`);
    lines.push('- The Street View photos can be older than the site today. If the customer\'s own photos or words disagree with them, the customer wins; otherwise treat them as the truth about the street');
    if (typeof input.streetViewHeading === 'number') lines.push(`- The customer chose to look toward compass heading ${Math.round(input.streetViewHeading)} degrees: that is the street-facing side of the plot`);
  }

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
  if (has(/\b(landscap\w*|garden|courtyard|park|pool area|outdoor spaces?)\b/)) return 'landscape';
  if (has(/\b(extension|add (?:\w+ ){0,3}floors?|extra floors?|vertical extension|rooftop addition)\b/)) return 'extension';
  if (has(/\b(facade|façade|renovat\w*|refurbish\w*|re-?clad\w*|exterior (?:redesign|makeover)|repaint the building)\b/)) return 'facade_retrofit';
  if (has(/\b(storefront|shop ?front|shop sign|signage|shop window|entrance of the shop)\b/)) return 'storefront_exterior';
  if (has(/\b(inside|interior|fit-?out|layout|inside the (?:shop|unit|apartment|store)|existing (?:unit|apartment|shop|store|space|building)|rented|rent)\b/)) return 'fit_out_interior';
  if (has(/\b(land|plot|empty|vacant|build (?:a|an|me)|new building|from scratch|ground-?up|construct\w*)\b/)) return 'new_building';
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
    const fallbackScope = scopeWithTarget(input.architecture?.targetKind, inferProjectScope(userBrief));
    sections.push(site || `PROJECT SCOPE: ${fallbackScope} — this is ${SCOPE_LABELS[fallbackScope]}.`);
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

/**
 * With a real photo of the place attached, every view keeps THAT camera. The set varies only the framing distance and the
 * hour, so each image is recognisably the customer's own street and none invents a new angle the references cannot support.
 */
export const ANCHORED_VIEW_ROLES = [
  'VIEW 1 — THE SAME PHOTO, EDITED: exactly the camera of the attached real photo (same position, height, angle, lens and framing) in the same light and weather. Only the target is redesigned; everything else is as photographed.',
  'VIEW 2 — SAME CAMERA, CLOSER: the same position and direction as VIEW 1, framed tighter on the target (frontage, entrance and glazing). The neighbours stay visible at the edges, exactly as photographed.',
  'VIEW 3 — SAME CAMERA, DUSK: the same position, direction and framing as VIEW 1 at blue hour. The new design is lit warmly from inside; the neighbours and the street are as photographed, now under dusk and street light.',
  'VIEW 4 — SAME CAMERA, BUSINESS OPEN: the same position, direction and framing as VIEW 1 in the same daylight, with the new design open and in use (door open, a few customers). No readable lettering on any added object.',
] as const;

/** True when the directed brief says real photos of the place are attached. */
export function hasRealPhotoAnchor(brief: string | null | undefined): boolean {
  return typeof brief === 'string' && brief.includes(REAL_PHOTOS_MARKER);
}

export function viewRolesForScope(scope: ProjectScope | null, kind: 'interior-design' | 'architecture', anchored = false) {
  if (scope === 'fit_out_interior') return INTERIOR_VIEW_ROLES;
  if (anchored && kind === 'architecture') return ANCHORED_VIEW_ROLES;
  if (scope === 'storefront_exterior') return STOREFRONT_VIEW_ROLES;
  return kind === 'architecture' ? ARCHITECTURE_VIEW_ROLES : INTERIOR_VIEW_ROLES;
}
