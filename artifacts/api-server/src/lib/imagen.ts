// Route real image generation through the proven legacy creative implementation
// while keeping current import compatibility for the rest of the application.
export * from './imagen-legacy.js';

// Compatibility exports retained for current tests/tools. The legacy generator
// owns the actual hidden quality directive used for customer generations.
export const INTERNAL_MASTER_IMAGE_QUALITY_DIRECTIVE = `
MASTER IMAGE QUALITY STANDARD — ALWAYS APPLY
- Preserve the exact identity of every supplied real product, person, logo and brand asset. Do not redesign, recolor, replace or simplify source details unless the customer explicitly requests that exact change.
- No random text, fake prices, fake product names, fake letters, misspelled logos, watermarks or unrelated brand marks. If exact text is not required, omit generated text entirely.
- Premium commercial photography quality: realistic materials, accurate geometry, natural light behavior, controlled highlights, clean shadows, coherent reflections, high micro-detail and believable depth.
- Avoid duplicated objects, extra limbs, warped hands/faces, melted edges, distorted logos, inconsistent product proportions, oversharpening, heavy blur, excessive bloom and stock-template styling.
- Respect the requested aspect ratio and keep the main subject safely composed for the final crop.
- Return one polished final image, not a contact sheet, collage, before/after panel or explanatory layout unless the customer explicitly asked for that format.
`;

export function imageModelName() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
}
