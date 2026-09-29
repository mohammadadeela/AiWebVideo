/** Internal provider guidance. Never send these instructions in job messages or API responses. */
export function referenceContext(meta: {
  studioKind?: string | null;
  inspirationMediaId?: string | null;
  inspirationMediaType?: string | null;
  architecture?: { plotWidth?: number; plotDepth?: number; buildingWidth?: number; buildingHeight?: number; floors?: number; setback?: number; location?: string; mapUrl?: string; latitude?: number; longitude?: number; estimatedScale?: boolean } | null;
} | null): string {
  if (!meta || (!meta.inspirationMediaId && meta.studioKind !== 'architecture' && meta.studioKind !== 'interior')) return '';
  const rules: string[] = [];
  if (meta.inspirationMediaId) rules.push(`The final supplied visual reference is an inspiration creative. Analyze its composition, framing, camera perspective, subject placement, lighting direction and softness, palette, depth, environment, material reflections and spatial relationships. ${meta.inspirationMediaType === 'video' ? 'Infer a coherent shot rhythm and camera movement from the reference concept where the still frame supports it; do not claim exact timing from a poster.' : ''} Rebuild the creative direction around the user's actual subject. Adapt scale and framing naturally to the user's product dimensions. Do not reproduce third-party branding, text or logos. Earlier uploaded images are the user's identity references; preserve their shape, proportions, material, colors and visible packaging. The user's explicit changes override the inspiration. Avoid substituting the inspiration subject for the user's subject.`);
  if (meta.studioKind === 'interior') rules.push('Maintain spatial consistency with supplied photographs, plans and stated dimensions. Preserve the shell and visible structural elements unless requested otherwise. Keep perspective, openings, vertical lines and material behavior realistic. Do not claim construction-ready precision.');
  if (meta.studioKind === 'architecture') {
    const site = meta.architecture;
    rules.push('Create a realistic architectural visualization integrated into the supplied site image. Preserve site perspective, plot boundaries when visible, road alignment, ground contact, neighboring context, terrain, sunlight direction and believable cast shadows. Preserve the reference building facade, major proportions, floor count, openings, roof and materials except where explicitly changed. Keep structural lines straight, floors consistently spaced, openings coherent, plausible access and parking, and no floating structures or duplicated distorted cars or people. The supplied site image is visual context, not a measured survey. Never invent precision, exact boundaries or dimensions from a map link. Respect measured user dimensions and setbacks as constraints; otherwise communicate approximate placement.');
    if (site) rules.push(`Site information: ${JSON.stringify(site)}. Explicit dimensions are user supplied in meters. Coordinates and address locate the site but alone do not establish plot scale.`);
  }
  return rules.join('\n\n');
}

export function providerBrief(userBrief: string | null | undefined, meta: Parameters<typeof referenceContext>[0]): string | null {
  const internal = referenceContext(meta);
  return internal ? `${internal}\n\nUSER REQUEST (overrides creative defaults):\n${userBrief || 'Create a visual grounded in the references.'}` : userBrief ?? null;
}
