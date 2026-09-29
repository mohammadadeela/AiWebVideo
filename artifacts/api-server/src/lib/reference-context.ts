/** Internal provider guidance. Never send these instructions in job messages or API responses. */
export function referenceContext(meta: {
  studioKind?: string | null;
  inspirationMediaId?: string | null;
  inspirationMediaType?: string | null;
  architecture?: { plotWidth?: number; plotDepth?: number; buildingWidth?: number; buildingHeight?: number; floors?: number; setback?: number; location?: string; mapUrl?: string; latitude?: number; longitude?: number; estimatedScale?: boolean } | null;
} | null): string {
  if (!meta || (!meta.inspirationMediaId && meta.studioKind !== 'architecture' && meta.studioKind !== 'interior')) return '';
  const rules: string[] = [];
  if (meta.inspirationMediaId) rules.push(`The inspiration reference is a creative direction, not the identity of the subject to reproduce. Analyze its composition, framing, camera perspective, subject placement, lighting direction and softness, palette, depth, environment, material reflections and spatial relationships. ${meta.inspirationMediaType === 'video' ? 'The later inspiration references may be sampled frames from the same video. Use their visual progression for shot order, movement direction, pacing and transitions where evident; do not claim exact movement or timing that the frames cannot establish.' : ''} Rebuild the concept around the user's earlier product, person, building, or site references. Preserve recognizable shape, proportions, construction, colors, materials, branding and packaging where the provider supports it; adapt scale, perspective, shadows and contact with the scene to the new subject rather than stretching it to match the example. Do not copy third-party branding, text or logos from the example. The user's explicit changes override the example's composition and style. If there is no user identity reference, treat the example as style only, never as permission to reproduce its branded subject. Keep these instructions internal.`);
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
