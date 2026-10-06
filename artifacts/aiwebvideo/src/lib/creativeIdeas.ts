export type IdeaFeature = 'ai_video' | 'product_images' | 'product_video' | 'web_video' | 'scenario' | 'interior_design' | 'architecture';

export interface CreativeIdea {
  id: string;
  feature: IdeaFeature;
  category: string;
  displayText: string;
  /** The full master prompt placed in the chat box when the idea is chosen: readable, specific and editable. */
  prompt: string;
  /** Feature safety text sent separately and never shown: it protects references and accuracy. The customer's words always win. */
  guardrail: string;
  supportedAspectRatios: Array<'16:9' | '9:16' | '1:1'>;
  requiresReference: boolean;
  optionalReference: boolean;
  tags: string[];
  priority: number;
}

export interface IdeaContext {
  websiteUrl?: string;
  prompt?: string;
  referenceNames?: string[];
  hasReferences?: boolean;
  seed?: number;
}

const ALL_RATIOS: CreativeIdea['supportedAspectRatios'] = ['16:9', '9:16', '1:1'];

const VIDEO_GUARDRAIL = `Respect the user's selected duration, aspect ratio, quality, style and references as authoritative technical settings. Preserve the identity of supplied people, products, places, logos and brand assets. Use coherent geometry, believable perspective, physically plausible motion, intentional visual hierarchy, premium lighting and a strong final hero frame. Do not add random text, fake branding, distorted architecture, warped objects, watermarks, or unreadable lettering. Any exact user wording added after this prompt has priority over creative choices in this direction.`;
const PRODUCT_GUARDRAIL = `Use the supplied product as exact visual ground truth. Preserve its geometry, proportions, materials, colorway, branding, logo, label, packaging and identifiable details. Do not redesign or approximate the product. Build the environment, lighting and composition around the real product rather than regenerating identity-critical details. Respect the selected aspect ratio and quality, keep safe crop margins, and avoid fake text or unrelated brand marks. Any explicit user addition has priority.`;
const WEBSITE_GUARDRAIL = `Use the real captured website pages, actual interface, real branding, brand colors, copy, products/services and website structure as ground truth. Do not invent an unrelated brand, unsupported offer or fake feature. Keep visible copy short, correctly spelled and readable; favor real UI captures for critical website text. Respect the user's selected duration, aspect ratio, quality, style and references. User additions after this prompt have priority.`;
export const INTERIOR_MASTER_PROMPT = `You are AiWebVideo's professional architectural visualization director. Treat the user's references, measurements and explicit constraints as authoritative engineering inputs. Never trade geometric accuracy for creativity. Analyze every reference together before designing, cross-check perspective, preserve the existing shell and produce consistent geometry across all outputs. Do not claim construction-ready accuracy from ordinary photos; when a dimension is not supplied or cannot be reliably verified, avoid invented precision. Optimize for professional client/engineer/architect presentation quality.\n\nTreat every supplied room/shop/property photo, floor-plan image, sketch, elevation and written measurement as engineering reference data. Preserve the existing shell, footprint, ceiling/roof geometry, curves, openings, columns, stairs, doors, windows, built-ins and visible structural constraints unless the user explicitly asks to change them. Explicit numeric measurements supplied by the user are authoritative; never silently rescale them. If a measurement cannot be reliably established from the references, do not invent precision—keep the geometry visually consistent and clearly favor the user's stated dimension. Reconstruct perspective and spatial relationships from all references together, not from one image alone. Respect the requested room type, circulation, clearances, materials, furniture scale, lighting, gypsum/ceiling details, linear or magnetic/track lighting, electrical/architectural elements and design style. Produce professional photorealistic architectural visualization suitable for an engineer, architect, interior designer or real-estate presentation. Keep walls, floor, ceiling and roof planes coherent across views. Avoid impossible furniture, floating objects, warped straight lines, inconsistent windows/doors, changing room dimensions, random fixtures, fake construction details, or decorative elements that violate the supplied geometry. If the user asks for a technical/sketch presentation, create a clean architectural concept/visualization rather than claiming it is a construction-ready drawing. User-provided constraints and measurements have priority over creative additions.`;
// The full interior/architecture master direction is added on the server; ideas only carry their own direction.
const INTERIOR_GUARDRAIL = `Follow the supplied references and every numeric input exactly. The customer's own words override this direction.`;
const SCENARIO_GUARDRAIL = `Preserve any supplied person, product, place or brand reference. Keep dialogue/performance natural, camera movement physically plausible, pacing intentional and the selected duration/aspect ratio authoritative. Never invent unsupported claims or unreadable on-screen text. User additions have priority.`;

function idea(
  feature: IdeaFeature,
  id: string,
  category: string,
  displayText: string,
  prompt: string,
  options: Partial<Pick<CreativeIdea, 'requiresReference' | 'optionalReference' | 'tags' | 'priority' | 'supportedAspectRatios'>> = {},
): CreativeIdea {
  const guardrail = feature === 'interior_design' || feature === 'architecture'
    ? INTERIOR_GUARDRAIL
    : feature === 'product_images' || feature === 'product_video'
    ? PRODUCT_GUARDRAIL
    : feature === 'web_video'
      ? WEBSITE_GUARDRAIL
      : feature === 'scenario'
        ? SCENARIO_GUARDRAIL
        : VIDEO_GUARDRAIL;
  return {
    id,
    feature,
    category,
    displayText,
    prompt: prompt.trim(),
    guardrail,
    supportedAspectRatios: options.supportedAspectRatios ?? ALL_RATIOS,
    requiresReference: options.requiresReference ?? false,
    optionalReference: options.optionalReference ?? true,
    tags: options.tags ?? [],
    priority: options.priority ?? 50,
  };
}

const AI_VIDEO: CreativeIdea[] = [
  idea('ai_video', 'brand-intro', 'Brand', 'Create a premium cinematic intro for my brand',
    `Create a premium cinematic brand intro of about ten seconds for my business. Open on an abstract, atmospheric moment of light, texture or motion that hints at what we do, then let the camera glide forward and resolve into one confident hero image of my brand, product or place. Keep every movement smooth and deliberate, use rich natural contrast with a single signature accent colour taken from my brand, and finish on a calm held frame with clean space where my logo can sit. No on-screen text, no gimmicks, nothing that feels like a template.`,
    { tags: ['brand', 'logo', 'intro', 'business', 'company'], priority: 100 }),
  idea('ai_video', 'viral-reel', 'Social', 'Make a scroll-stopping vertical Reel',
    `Make a short vertical video built to stop the scroll on Instagram Reels and TikTok. The first second must be a bold, curiosity-driven visual that makes people stay: an unexpected angle, a fast reveal or a striking contrast. Then escalate with three or four quick, clearly different shots, purposeful speed ramps and strong subject focus, and land on one memorable hero frame. Keep the subject large and centred for a phone screen, the light punchy, the pacing tight, with no dead moments and no text on screen.`,
    { tags: ['reel', 'tiktok', 'social', 'instagram', 'viral'], priority: 98 }),
  idea('ai_video', 'living-photo', 'Photo to video', 'Bring my photo to life with natural motion',
    `Animate the photo I supplied into a short living moment that still feels like my original picture. Keep the composition, the people, the product and every identifying detail exactly as they are. Add only motion that would naturally be there: a light breeze in fabric, hair or leaves, drifting steam or dust in the light, gentle water or clouds, soft reflections, and a slow, restrained camera push-in with real depth between foreground and background. Subtle, believable and calm, never a distortion and never a change of identity.`,
    { requiresReference: true, tags: ['photo', 'portrait', 'picture'], priority: 96 }),
  idea('ai_video', 'drone-flyover', 'Location', 'Fly a cinematic drone shot over my place',
    `Create a cinematic drone sequence over the place in my reference. Start high with a wide establishing view that shows where it sits in its surroundings, then descend in one smooth stabilised move toward the most appealing part of the property, with natural parallax, gentle altitude changes and the warm light of late afternoon. Keep every building, road, tree and boundary exactly as in the reference. End on a slow, confident hero view that could sell, rent or promote the place.`,
    { requiresReference: true, tags: ['location', 'hotel', 'villa', 'resort', 'land', 'farm', 'real-estate', 'property'], priority: 94 }),
  idea('ai_video', 'travel-ad', 'Location', 'Turn my place into a high-end travel commercial',
    `Make a high-end travel commercial that sells the feeling of being at my place. Build a clear arc: arrive, discover, relax, and finally wish to stay. Use elegant establishing views, human-scale details such as a table set for two, light moving across stone, a door opening onto water or a view, smooth gimbal and aerial motion, and golden-hour colour. Keep the real architecture and surroundings from my reference, and end on a calm hero frame with room for a booking message added later.`,
    { requiresReference: true, tags: ['hotel', 'resort', 'travel', 'tourism', 'guesthouse', 'restaurant'], priority: 90 }),
  idea('ai_video', 'before-after', 'Transformation', 'Show a satisfying before-and-after transformation',
    `Show a clear, satisfying transformation of the subject in my reference. Hold on the before state long enough for anyone to understand it, then change to the after state with one motivated transition such as a light sweep, a camera move that passes an object, or a smooth match cut. Keep the camera position and framing identical across both states so the difference is obvious and honest, then hold the finished result for a full beat. The improvement must look real and achievable, not magical.`,
    { optionalReference: true, tags: ['renovation', 'makeover', 'repair', 'clean', 'design', 'transformation'], priority: 88 }),
  idea('ai_video', 'day-to-night', 'Transformation', 'Let a whole day turn into night over my scene',
    `Lock the camera in place and let a full day pass over the scene in my reference. Shadows sweep and lengthen, the sky moves through golden hour and dusk into a deep blue night, and windows, signs and lamps switch on one after another until the place glows. Nothing moves except light and a few natural details such as clouds or passers-by. The framing never changes, every building and object stays exactly as it is, and the final night frame is rich, warm and inviting.`,
    { requiresReference: true, tags: ['location', 'shop', 'hotel', 'restaurant', 'building', 'street'], priority: 84 }),
  idea('ai_video', 'cinema-orbit', 'Camera', 'Orbit around my subject like a cinema camera',
    `Create a smooth, physically believable camera orbit around the main subject of my reference. The subject keeps its exact proportions while the perspective changes naturally, with stable parallax, soft focus falloff, a consistent light direction and the behaviour of a real cinema lens. Start slightly wide, move in a slow arc of roughly ninety to one hundred and eighty degrees, and settle on a confident closer framing. Calm, premium and precise, with no wobble and no sudden speed changes.`,
    { tags: ['orbit', 'rotate', 'object', 'statue', 'car', 'product'], priority: 86 }),
  idea('ai_video', 'behind-the-scenes', 'Story', 'Tell the story of how my product or craft is made',
    `Create an intimate documentary-style short about how my product, dish or craft is made. Move through close, hands-on details: raw materials, tools, steam, dust, texture and honest imperfect light. Follow a simple sequence from raw material to process to finished piece to someone receiving it. Use stabilised handheld realism, shallow depth of field and natural sound design cues, and let the maker's hands carry the emotion. Keep it truthful to my references, with no invented steps and no text on screen.`,
    { tags: ['handmade', 'bakery', 'food', 'craft', 'workshop', 'factory', 'artisan', 'made'], priority: 82 }),
  idea('ai_video', 'seasonal-greeting', 'Seasonal', 'Create a warm seasonal greeting for my customers',
    `Create a warm, tasteful greeting video for my customers for the occasion coming up, such as Ramadan, Eid, a national day, a holiday or a seasonal sale, set inside the world of my business. Use soft festive light and details that fit the occasion with respect and accuracy, gentle camera drift and people shown with warmth. End on a calm frame with clear empty space for my own greeting and logo. Do not show text in the video, and do not depict any religious or cultural symbol inaccurately.`,
    { tags: ['ramadan', 'eid', 'holiday', 'greeting', 'season', 'christmas', 'sale', 'offer'], priority: 80 }),
  idea('ai_video', 'sensory-food', 'Food', 'Make my food or drink look irresistible',
    `Create a sensory close-up film of my food or drink: steam rising, sauce pouring, a knife breaking a crisp crust, ice settling in a glass, light catching moisture and texture. Use macro lenses with shallow depth of field, warm backlight, slow motion on the single most delicious moment and one confident reveal of the finished dish. Keep the food true to my reference, appetising and real, never plastic or over-saturated, with clean surfaces and no invented ingredients.`,
    { tags: ['food', 'restaurant', 'cafe', 'bakery', 'coffee', 'dish', 'drink', 'menu'], priority: 78 }),
  idea('ai_video', 'luxury-reveal', 'Luxury', 'Reveal my subject in a slow, luxurious way',
    `Create an elegant, unhurried reveal that begins on carefully chosen partial details and gradually exposes the complete subject of my reference. Use refined macro and medium shots, slow controlled movement, premium reflections, soft directional highlights and shallow depth of field. The pacing should feel expensive: long, patient moves, a quiet colour palette and one decisive final frame that holds. Preserve the exact look of the real subject and avoid any effect that makes it cheaper or busier.`,
    { tags: ['luxury', 'premium', 'jewelry', 'watch', 'perfume', 'fashion'], priority: 76 }),
];

const PRODUCT_IMAGES: CreativeIdea[] = [
  idea('product_images', 'marketplace-white', 'Ecommerce', 'Make marketplace-ready photos on a pure white background',
    `Create clean, conversion-focused product photos of my exact product on a pure white background, ready for an online shop or marketplace listing. Centre the product with comfortable margins, use soft even studio light with a gentle grounded shadow, keep edges crisp and colours true to the real item, and show it sharp from edge to edge. Make the set consistent: same lighting, same distance and same white, with no props, no reflections that hide details and no text, so the whole catalogue looks professional.`,
    { requiresReference: true, tags: ['ecommerce', 'amazon', 'etsy', 'listing', 'shop', 'catalog', 'marketplace'], priority: 100 }),
  idea('product_images', 'luxury-studio', 'Luxury', 'Create a luxury studio campaign photo',
    `Photograph my exact product as the hero of a premium advertising campaign. Place it in an elegant controlled studio with sculpted directional light, subtle reflections on a refined surface, precise shadows and a sophisticated tonal background chosen to flatter its colours. Keep the composition simple and confident, with generous negative space, true materials and perfectly readable logos and labels. The result should feel like a billboard-quality image from a high-end brand, never busy and never cheap.`,
    { requiresReference: true, priority: 98 }),
  idea('product_images', 'in-real-life', 'Lifestyle', 'Show my product being used in real life',
    `Place my exact product in a believable real-world scene that matches how it is actually used or displayed, such as a kitchen counter, a desk, a bathroom shelf, a market table or a bag on a shoulder. Match perspective, contact shadows, reflections and colour temperature so it belongs naturally, use soft window light and shallow depth of field, and keep the product the clear hero with its true shape, colour and branding. The scene should feel lived-in and aspirational, not staged or cluttered.`,
    { requiresReference: true, priority: 96 }),
  idea('product_images', 'instagram-launch', 'Social', 'Make a scroll-stopping Instagram launch post',
    `Create a scroll-stopping image for announcing my product on Instagram. The product must be recognisable in a fraction of a second, with a strong focal point, a bold but tasteful colour background that separates it cleanly, premium lighting and a composition that works in a square or four-by-five crop. Leave a calm area of empty space where I can add my own text later. Keep the product exact, with no fake logos, no invented text and no distracting props.`,
    { requiresReference: true, tags: ['instagram', 'launch', 'social', 'post', 'new'], priority: 94 }),
  idea('product_images', 'dark-studio-hero', 'Studio', 'Create a dramatic dark-studio hero with rim light',
    `Reveal my exact product from a deep, dark studio using one or two carefully controlled lights. Sculpt its form with clean rim light and soft falloff, let a faint, physically correct reflection ground it, and keep every label, logo and material detail readable. Add only a restrained touch of atmosphere such as a thin haze behind it. The mood is confident and premium, ideal for electronics, perfume, watches, bottles and anything that should feel exclusive.`,
    { requiresReference: true, tags: ['dark', 'perfume', 'watch', 'electronics', 'bottle', 'premium'], priority: 90 }),
  idea('product_images', 'flat-lay', 'Lifestyle', 'Style a beautiful flat-lay with fitting props',
    `Create a top-down flat-lay with my exact product as the clear centre of attention. Surround it with a small number of props that make sense for what it is and who buys it, arranged with deliberate spacing, a clear colour palette and soft, even daylight from one side. Keep the product fully visible and unobstructed, with true colours and readable branding, and avoid clutter. The result should look like a professionally styled editorial or catalogue image.`,
    { requiresReference: true, tags: ['flat-lay', 'cosmetics', 'accessories', 'stationery', 'food'], priority: 86 }),
  idea('product_images', 'hand-scale', 'Ecommerce', 'Show it in a hand so customers see the real size',
    `Show my exact product held naturally in a clean, well-groomed hand, so customers instantly understand its real size. Use a neutral, softly lit background, correct hand anatomy with natural fingers and skin, a believable grip that does not cover the logo or the key details, and a shallow depth of field that keeps the product sharp. The hand should support the product, never compete with it. Keep proportions truthful so the size shown matches the real item.`,
    { requiresReference: true, tags: ['size', 'scale', 'small', 'jewelry', 'cosmetics', 'gadget'], priority: 82 }),
  idea('product_images', 'colour-options', 'Ecommerce', 'Show all my colour options together in one clean shot',
    `Arrange the colour or style variations of my product that I supplied together in one clean, well-balanced catalogue image. Keep each version exact, with its true colour, material and branding, evenly lit, consistently scaled and neatly spaced, on a calm neutral background that lets the colours stand out without tinting them. Use only the variations I provided and never invent a new colour. The result should help a customer compare options at a glance.`,
    { requiresReference: true, tags: ['colors', 'colours', 'variants', 'sizes', 'options', 'collection'], priority: 80 }),
  idea('product_images', 'seasonal-campaign', 'Seasonal', 'Create a seasonal campaign for Ramadan, Eid or the holidays',
    `Create a seasonal campaign image for the occasion coming up, such as Ramadan, Eid, a national day, back-to-school or the holidays. Build a tasteful setting from materials, light and a few well-chosen details that clearly signal the occasion, while my exact product stays unchanged, dominant and sharp. Use warm, inviting light and a cohesive palette, avoid cliche clutter, depict any cultural or religious detail accurately and respectfully, and leave calm space for a greeting or offer to be added later.`,
    { requiresReference: true, tags: ['ramadan', 'eid', 'holiday', 'season', 'sale', 'gift', 'christmas'], priority: 78 }),
  idea('product_images', 'ingredient-splash', 'Food and beauty', 'Surround it with its natural ingredients and a splash',
    `Build a fresh, dynamic campaign image around my exact product, surrounded by the natural ingredients that belong to it and a frozen splash of liquid, cream or powder. Use a very fast-shutter look with crisp droplets, backlight that gives every particle a bright edge, and a clean colour-matched background. Keep the product itself dry-looking, perfectly sharp and exactly true to the real packaging, with every label readable. Energetic, appetising and clean, never messy.`,
    { requiresReference: true, tags: ['drink', 'beverage', 'juice', 'cosmetics', 'skincare', 'cream', 'food', 'natural'], priority: 76 }),
  idea('product_images', 'magazine-ad', 'Luxury', 'Make a premium magazine advertisement',
    `Create an editorial, magazine-grade photograph of my exact product with disciplined art direction. Use elegant negative space for a headline to be added later, sophisticated lighting, a refined but simple set and a composition that guides the eye straight to the product. Materials must look real, colour must be true to the item, and nothing should distract. It should look as if it belongs in a high-end printed magazine, with no text and no logos other than the ones already on the product.`,
    { requiresReference: true, tags: ['magazine', 'editorial', 'advert', 'print', 'brand'], priority: 74 }),
  idea('product_images', 'minimal-premium', 'Minimal', 'Create a minimal, premium-tech product composition',
    `Create an ultra-clean composition with my exact product, disciplined geometry and abundant negative space. Use soft neutral gradients, precise edge lighting and one subtle geometric element or pedestal to give scale and structure. The calm, confident mood suits technology, personal care and design objects. Every material must render flawlessly, every edge must be crisp, and the product must keep its true colours and proportions. No clutter, no decoration for its own sake, no text.`,
    { requiresReference: true, tags: ['minimal', 'tech', 'gadget', 'clean', 'apple', 'design'], priority: 72 }),
];

const PRODUCT_VIDEO: CreativeIdea[] = [
  idea('product_video', 'luxury-360', 'Luxury', 'Reveal my product in a luxury 360-degree orbit',
    `Create a premium commercial centred entirely on my exact product. Begin on a mysterious detail, then reveal the complete product through a smooth motion-control orbit on a refined set. Use sculpted studio lighting, realistic reflections and a slow, confident rhythm, and keep every logo, label and material exactly as the real item. End on a steady hero frame with room around the product for a message. No text, no gimmicks, and nothing that changes the product itself.`,
    { requiresReference: true, priority: 100 }),
  idea('product_video', 'tiktok-hook', 'Social', 'Make a TikTok-style reveal that hooks in one second',
    `Create a short, vertical, high-energy product video built for TikTok and Reels. Open with an instantly curious visual in the first second, then cut quickly through three or four dynamic shots of my exact product from different angles, using whip pans, speed ramps and punchy light. Keep the product large, centred and easy to recognise on a phone, finish on a clean hero frame, and keep the pace tight with no slow moments, no invented features and no text on screen.`,
    { requiresReference: true, tags: ['tiktok', 'reel', 'social', 'viral', 'short'], priority: 98 }),
  idea('product_video', 'detail-to-hero', 'Reveal', 'Move from macro details to the full hero shot',
    `Start with extreme close-ups of my exact product that show real craft: stitching, texture, a button, a finish, an engraved detail. Let each macro shot flow into the next with slow, precise camera motion, then pull back in one smooth movement to reveal the complete product as a confident hero shot. Use controlled macro lighting, shallow depth of field and truthful materials. Every detail shown must exist on the real product, so nothing is invented or improved.`,
    { requiresReference: true, tags: ['detail', 'quality', 'craft', 'leather', 'watch', 'jewelry'], priority: 94 }),
  idea('product_video', 'unboxing-reveal', 'Reveal', 'Open the packaging into a premium unboxing reveal',
    `Show my exact product and its packaging in a satisfying, premium unboxing. A clean surface, hands that move with care, the lid lifting or sliding open, tissue or inserts parting, and then the product revealed in a slow, beautiful close-up before rising to a hero frame. Use soft overhead and side light, tactile detail and an unhurried rhythm. Keep the real packaging design and product exactly as supplied, with no invented printing or extra contents.`,
    { requiresReference: true, tags: ['unboxing', 'package', 'packaging', 'gift', 'box'], priority: 92 }),
  idea('product_video', 'floating-ad', 'Luxury', 'Make my product levitate in a floating commercial',
    `Create an elegant floating-product commercial. My exact product hovers weightlessly in a clean, softly lit space, rotating slowly while one or two complementary elements drift around it in a balanced, gravity-defying composition. Use soft shadows on the floor beneath, subtle reflections and slow camera movement that keeps the product the stable hero. Material, colour and branding must stay exactly true to the real item, and the mood should be calm, premium and modern.`,
    { requiresReference: true, priority: 90 }),
  idea('product_video', 'in-use', 'Lifestyle', 'Show my product in real use',
    `Show my exact product being used naturally in the setting where customers would use it, with realistic hands, believable movement and warm natural light. Move from a wide shot that sets the scene to close, purposeful shots of the key moment of use, then to a satisfied final frame with the product clearly visible. Keep the product exactly as supplied and demonstrate only what it really does. Avoid exaggerated claims, impossible results and any on-screen text.`,
    { requiresReference: true, tags: ['use', 'demo', 'lifestyle', 'kitchen', 'home', 'tool'], priority: 88 }),
  idea('product_video', 'website-loop', 'Website', 'Create a calm looping clip for my website header',
    `Create a calm, seamless looping video of my exact product for use as a website header background. Use a slow, gentle movement such as a subtle orbit, a drifting light sweep or a slow push-in, on a clean composition with generous empty space on one side so headline text stays readable. The last frame must flow smoothly back into the first. Keep colours harmonious with the product, avoid fast cuts, flashing or distracting effects, and keep the mood refined and quiet.`,
    { requiresReference: true, tags: ['website', 'hero', 'header', 'background', 'loop', 'landing'], priority: 86 }),
  idea('product_video', 'liquid-burst', 'Dynamic', 'Make my product burst through water or liquid',
    `Create a powerful slow-motion moment where my exact product rises or bursts through a body of clear water or liquid, with crisp droplets, glowing rim light and a lingering ripple. Keep the camera low and steady, let the splash peak at the perfect instant, and settle on a clean, dripping hero frame. The product must look genuinely waterproof or sealed as it really is, with true colours, labels and shape, and no distortion from the liquid.`,
    { requiresReference: true, tags: ['water', 'drink', 'beverage', 'cosmetics', 'perfume', 'bottle', 'fresh'], priority: 80 }),
  idea('product_video', 'smoke-light', 'Reveal', 'Reveal my product through smoke and moving light',
    `Stage a restrained, dramatic reveal. Slow volumetric haze and directional beams hide my exact product at first, then controlled camera movement and shifting light uncover its form piece by piece. Keep the smoke physically believable and the edges clean, hold on a bold hero frame with rim light, and keep colours deep and elegant. The product's shape, materials and branding must stay exactly as supplied and never be hidden for long.`,
    { requiresReference: true, tags: ['dramatic', 'dark', 'perfume', 'watch', 'cinematic'], priority: 78 }),
  idea('product_video', 'new-drop', 'Social', 'Announce a new product drop with rising tension',
    `Create a short teaser for a new product drop. Begin with silence, shadow and a single sliver of light, build tension with fast, rhythmic glimpses of my exact product, then release it all in one decisive reveal and a bold hero frame. Use controlled flashes, speed ramps and confident low camera angles. Keep every detail of the product true to the real item, show no price or invented claims, and leave clean space at the end for a date or link to be added.`,
    { requiresReference: true, tags: ['drop', 'launch', 'new', 'teaser', 'release', 'collection'], priority: 76 }),
  idea('product_video', 'fabric-motion', 'Fashion', 'Show fabric, leather or material in motion',
    `Show how my exact product moves and feels: fabric flowing, a shoe flexing, a bag swinging, leather catching light, a surface glinting as it turns. Use slow motion, tasteful macro and medium shots, soft directional light and a clean, fashionable set. Keep colours, patterns, stitching and logos exactly true to the real item, and let movement show quality instead of effects. The mood is confident and editorial, never rushed or exaggerated.`,
    { requiresReference: true, tags: ['fashion', 'clothes', 'shoe', 'bag', 'leather', 'dress', 'fabric', 'jeans'], priority: 74 }),
  idea('product_video', 'assemble', 'Reveal', 'Make my product assemble itself piece by piece',
    `Show my exact product assembling itself in mid-air from its real components, each part gliding into its true position in a precise, satisfying choreography, with clean light and a seamless final click into place. Parts must resemble the real product's actual construction, with no invented components. Use a calm studio background, steady camera movement that follows the assembly, and a strong final hero frame. Ideal for gadgets, tools, furniture and anything with visible parts.`,
    { requiresReference: true, tags: ['gadget', 'tech', 'furniture', 'tool', 'parts', 'electronics', 'device'], priority: 70 }),
];

const WEB_VIDEO: CreativeIdea[] = [
  idea('web_video', 'launch-trailer', 'Launch', 'Turn my website into a premium launch trailer',
    `Turn my website into a premium launch trailer of about thirty seconds. Open with a strong first-second hook, then move through the most compelling real pages, sections and visuals of my site in a confident rhythm with smooth camera moves and tasteful depth. Show the real interface, real branding, real products and real wording, keep any on-screen words short and correctly spelled, and finish on a clear, memorable closing frame that invites the viewer to visit. Polished, modern and credible, never generic.`,
    { priority: 100 }),
  idea('web_video', 'problem-solution', 'Conversion', 'Show the problem my website solves, then the solution',
    `Create a short advertisement that starts with the everyday frustration my customers have, shown in a few honest, relatable moments, and then turns to my website as the clear answer. Use the real pages, real offers and real brand look of my site to show how simple the solution is, and end with a confident call to action. Keep every claim to what my website actually says, with no invented results, no fake numbers and no exaggerated promises.`,
    { priority: 97 }),
  idea('web_video', 'ecom-shopping', 'Online store', 'Make my online store feel like a premium shopping ad',
    `Turn my online store into a premium shopping commercial. Show the real products, real prices and real categories of my store as an appealing journey: browsing, discovering a favourite, adding it to the cart and a satisfying finish. Use smooth transitions between the real pages, crisp close-ups of the best product photos and warm, inviting light. Keep the branding and the products exactly as they appear on my site, and avoid showing prices or offers that are not on it.`,
    { tags: ['ecommerce', 'shop', 'store', 'product', 'cart', 'shopify', 'woocommerce'], priority: 96 }),
  idea('web_video', 'best-sellers', 'Online store', 'Showcase my best sellers',
    `Create a cinematic showcase of the best-selling or most featured products on my website. Give each product a clear, confident moment with a clean close-up, its real name and a smooth move to the next, building momentum toward the strongest one. Use the real photos and the real product names from my site, add tasteful motion and depth, and keep the pace brisk. Do not invent products, discounts or reviews that my site does not show.`,
    { tags: ['ecommerce', 'shop', 'store', 'products', 'bestseller', 'collection'], priority: 92 }),
  idea('web_video', 'restaurant-menu', 'Food', 'Make my menu come alive as dishes being served',
    `Bring my menu to life. Using the real dishes, drinks and photos on my website, show food being served in warm, appetising scenes: steam, a pour, a garnish, hands placing the plate, a table with friends, and the restaurant's real atmosphere if it is shown. Keep the menu items and the brand style true to my site and end with a clear invitation to visit or order. Make the food look delicious but real, with no invented dishes and no fake prices.`,
    { tags: ['restaurant', 'cafe', 'food', 'menu', 'coffee', 'bakery', 'catering'], priority: 95 }),
  idea('web_video', 'saas-workflow', 'Product tour', 'Show my product workflow clearly, step by step',
    `Show how my software or platform works as a clear, cinematic workflow. Start with the problem, then walk the viewer through the three or four most important real screens of my site or product, with smooth zooms into the interface, a clear sense of progress from step to step and a satisfying result at the end. Use the real interface, the real names of features and the real brand colours, keep text short and legible, and never invent features, integrations or numbers.`,
    { tags: ['saas', 'software', 'app', 'platform', 'dashboard', 'tool', 'startup'], priority: 94 }),
  idea('web_video', 'customer-journey', 'Conversion', 'Show the journey from first visit to booking or purchase',
    `Show the customer journey on my website from the first visit to the moment someone books, buys or gets in touch. Use the real pages in their real order, with natural cursor and scroll movement, smooth camera pushes into the key buttons and forms, and a clear, reassuring finish. Keep it simple and believable so a new customer feels how easy it is, with the real wording, real branding and no invented steps.`,
    { tags: ['booking', 'checkout', 'signup', 'order', 'appointment', 'journey'], priority: 90 }),
  idea('web_video', 'social-reel', 'Social', 'Turn my website into a vertical social reel',
    `Turn my website into a fast, vertical reel for Instagram and TikTok. Start with an immediate visual hook from the strongest page or image, then move through three or four punchy moments from my real site with quick, rhythmic transitions and bold framing that reads well on a phone. Keep the real branding and wording, keep any text very short and correctly spelled, and end on a clear final frame. No slow openings, no filler and no invented claims.`,
    { tags: ['reel', 'tiktok', 'instagram', 'social', 'short', 'vertical'], priority: 88 }),
  idea('web_video', 'linkedin-b2b', 'Business', 'Create a clean, credible video for business buyers',
    `Create a clean, credible video for LinkedIn and business buyers based on my website. Use a calm, professional tone, clear sequencing and restrained motion. State what the company does, who it is for and the main benefit in plain terms, using the real pages, services and proof points from my site. Keep the look refined and trustworthy, with accurate text, no hype and no invented clients, awards or numbers.`,
    { tags: ['b2b', 'agency', 'consulting', 'services', 'company', 'linkedin', 'corporate'], priority: 86 }),
  idea('web_video', 'why-choose-us', 'Trust', 'Show why customers choose us, using my real reviews and results',
    `Make a trust-building video that shows why customers choose my business. Use only the real reviews, ratings, results, guarantees, years in business and photos that appear on my website, presented with warmth and confidence through calm movement over the real pages and close-ups of the strongest proof. End with a clear invitation to get in touch. If the site shows little proof, keep the message simple and honest rather than inventing testimonials or numbers.`,
    { tags: ['reviews', 'testimonials', 'trust', 'results', 'about', 'guarantee'], priority: 84 }),
  idea('web_video', 'property-destination', 'Hospitality', 'Present my property or destination like a luxury listing',
    `Present the property, hotel, resort or destination on my website like a luxury listing. Use the real photos and real rooms or areas from my site, moving from an elegant establishing view to the best spaces and details, with slow gimbal-style motion, warm natural light and a calm, aspirational rhythm. End with a clear way to book or enquire. Keep the real layout, names and amenities exactly as on my site, and never invent facilities, views or prices.`,
    { requiresReference: true, tags: ['hotel', 'resort', 'villa', 'real-estate', 'property', 'guesthouse', 'travel', 'booking'], priority: 82 }),
  idea('web_video', 'offer-promo', 'Promotion', 'Announce my current offer or sale',
    `Announce the current offer, sale or new arrival shown on my website. Build energy from the first second with a bold visual, show the real products or services involved, and make the offer easy to understand. Use the real prices, dates and conditions from my site only if they are shown there, keep any text short and correctly spelled, and end on a strong call to action. Do not invent discounts, deadlines or limited stock that my website does not state.`,
    { tags: ['offer', 'sale', 'discount', 'promotion', 'deal', 'new', 'season'], priority: 80 }),
];

const SCENARIO: CreativeIdea[] = [
  idea('scenario', 'founder-explains', 'Performance', 'Have the founder explain the business naturally',
    `Create a natural talking-to-camera scene in which the owner of my business explains what we do, who it helps and why it is different, in a calm, warm and believable way. Frame them in a real, well-lit workplace with subtle depth, let them glance away naturally and gesture with ease, and use gentle push-ins on key moments. Keep the wording simple and conversational, limit every claim to what my references or words support, and avoid sales hype, stiff delivery and invented facts.`,
    { priority: 100 }),
  idea('scenario', 'customer-testimonial', 'Social proof', 'Create a warm customer testimonial',
    `Create a warm, believable testimonial scene in which a happy customer speaks to camera or to an off-screen interviewer about their experience with my business or product. Use natural daylight, a comfortable real-life setting and genuine, imperfect delivery with small pauses and smiles. Cut in a few relevant visuals of the product or service. Keep what they say modest and specific, supported only by what I have provided, with no exaggerated claims, fake numbers or invented endorsements.`,
    { priority: 98 }),
  idea('scenario', 'two-person-chat', 'Performance', 'Stage a natural two-person conversation about my product',
    `Stage a relaxed conversation between two people, one curious and one who knows my product or service well, in a believable everyday setting. Let the dialogue flow with natural interruptions, reactions and small gestures, and answer the questions customers really ask, in plain words. Use over-the-shoulder and two-shot framing with gentle camera movement, show the product clearly at the right moment, and keep every statement within what my references and words support.`,
    { priority: 94 }),
  idea('scenario', 'demo-dialogue', 'Performance', 'Explain how it works while using it',
    `Show a person explaining my product or service while actually using it, step by step, speaking naturally to the camera or to a friend. Alternate between a clear view of their face and close, well-lit shots of the product or screen showing the action as they describe it. Keep the explanation short, practical and easy to follow, in the order a first-time user would need it, with natural pauses and no jargon. Show only what the product really does.`,
    { tags: ['demo', 'how-to', 'tutorial', 'app', 'software', 'product'], priority: 92 }),
  idea('scenario', 'problem-skit', 'Story', 'Act out the problem, then reveal the solution',
    `Create a short scene that acts out a small, relatable problem my customers face, played with light humour and real emotion, and then shows my product or service solving it in a clear, satisfying moment. Keep the performances natural, the setting believable and the turn from problem to solution unmistakable. End on a warm closing beat with the product in view, with no insulting stereotypes, no invented claims and no overacting.`,
    { priority: 90 }),
  idea('scenario', 'direct-announcement', 'Performance', 'Deliver a confident direct-to-camera announcement',
    `Create a confident, friendly direct-to-camera announcement for my business, such as a new product, a new branch, a special offer or an important update. The speaker looks into the lens, uses a clear, upbeat tone and natural gestures, in a clean, well-lit setting that fits my brand. Keep the message short, specific and easy to remember, give dates or details only if I have supplied them, and end with a clear next step for the viewer.`,
    { tags: ['announcement', 'offer', 'launch', 'news', 'opening'], priority: 88 }),
  idea('scenario', 'expert-interview', 'Authority', 'Create an expert interview with natural cutaways',
    `Create a professional but relaxed interview in which an expert from my field answers three or four questions that customers genuinely ask. Use a calm two-camera look with a steady wide shot and a closer angle, subtle cutaways to the real work, product or place, and natural body language with thoughtful pauses. Keep answers clear, honest and practical, built from my references and words only, with no medical, legal or financial promises beyond what I supplied.`,
    { tags: ['expert', 'doctor', 'lawyer', 'consultant', 'advice', 'clinic', 'interview'], priority: 86 }),
  idea('scenario', 'faq-answer', 'Trust', 'Answer the one question every customer asks',
    `Pick the single question my customers ask most and have a friendly, knowledgeable person answer it directly to camera in a calm, human way, in under a minute. Give the honest answer first, then one clear reason, then a simple next step. Use a clean, real setting with soft light, small natural gestures and one or two cutaways that illustrate the answer. Stay inside the facts I have provided and never invent policies, prices or guarantees.`,
    { tags: ['faq', 'question', 'support', 'help', 'answer'], priority: 84 }),
  idea('scenario', 'podcast-clip', 'Social', 'Turn this into a premium podcast-style clip',
    `Create a polished podcast-style conversation between a host and a guest, seated at professional microphones in a warm, well-designed studio with soft practical lights. Alternate between a wide shot and two close shots, with natural reactions, small laughs and attentive listening. The topic is the idea behind my business or product, kept clear and engaging, built only from what I have provided, and framed so it works as a short clip for social media.`,
    { tags: ['podcast', 'talk', 'interview', 'host', 'guest'], priority: 78 }),
  idea('scenario', 'walk-and-talk', 'Tour', 'Walk and talk through my shop, place or project',
    `Film a walk-and-talk in which a host moves through my shop, office, workshop or project while explaining what visitors will see and why it matters. Use a smooth stabilised follow shot at eye level, natural pauses where they point to details, and gentle cuts to close-ups of what they mention. The space must stay exactly as in my references. Keep the speech warm, specific and easy to follow, and end at the entrance or counter with a friendly invitation.`,
    { requiresReference: true, tags: ['shop', 'tour', 'showroom', 'office', 'workshop', 'space'], priority: 76 }),
  idea('scenario', 'unboxing-reaction', 'Social', 'Film a genuine unboxing reaction with spoken thoughts',
    `Film a genuine unboxing in which a person opens my product at a table in natural light and shares honest first impressions out loud: the packaging, the feel, the first use. Keep the reactions real, with small surprises and clear opinions, close-ups on the product and their face, and a relaxed, unscripted rhythm. Show the product exactly as supplied, and keep every spoken claim modest and true to what I have provided.`,
    { requiresReference: true, tags: ['unboxing', 'review', 'first impression', 'reaction'], priority: 74 }),
  idea('scenario', 'welcome-team', 'Brand', 'Welcome people and introduce my team',
    `Create a friendly welcome scene in which a host greets viewers and introduces my team and the values that guide our work. Use a bright, real workplace, natural introductions where each person says a short line, warm smiles and relaxed movement. Keep the tone human and proud, not corporate, use only the names, roles and facts I have provided, and end together with a welcoming gesture and an invitation to get in touch.`,
    { tags: ['team', 'about', 'welcome', 'staff', 'culture', 'company'], priority: 72 }),
];

const INTERIOR_DESIGN: CreativeIdea[] = [
  idea('interior_design', 'existing-space-redesign', 'Redesign', 'Redesign this exact space without changing its architecture',
    `Redesign the interior in my photos while keeping its architecture exactly as it is: the same walls, openings, doors, windows, ceiling shape, columns and proportions. Propose a complete, coherent scheme for floors, walls, ceiling, lighting, furniture and decor, with believable materials, comfortable circulation and realistic human scale. Show it from the same viewpoint as my photo so I can compare directly. The result must look like a real, buildable interior in the real room I supplied, never a different space.`,
    { requiresReference: true, tags: ['room', 'home', 'house', 'apartment', 'office', 'redesign', 'real-space'], priority: 100 }),
  idea('interior_design', 'boutique-store', 'Retail', 'Design a boutique clothing store interior',
    `Design the interior of a boutique clothing store for the space in my references. Plan a welcoming entrance zone, a clear route past feature displays, hanging rails and shelving at comfortable heights, fitting rooms with soft, flattering light, and a cash counter that feels part of the design. Choose a refined palette and warm lighting that make the clothes the stars. Respect the real walls, openings and proportions of my space, and keep everything buildable and realistic in scale.`,
    { tags: ['shop', 'store', 'boutique', 'clothes', 'fashion', 'retail', 'clothing'], priority: 98 }),
  idea('interior_design', 'retail-shop', 'Retail', 'Plan a complete retail shop layout and look',
    `Design the interior of a retail shop for the space in my references, selling whatever I describe below. Define the customer flow from entrance to counter, place shelving, display tables and a feature wall where they give each product the best visibility, and add lighting that makes products look their best. Use durable, realistic materials and a coherent brand-friendly palette. Keep the real shell, openings and proportions of my space, and show a clear main view with enough layout detail to be useful to a contractor.`,
    { tags: ['shop', 'store', 'retail', 'supermarket', 'gifts', 'phone', 'electronics', 'showroom'], priority: 94 }),
  idea('interior_design', 'cafe-interior', 'Hospitality', 'Design a warm, modern cafe or restaurant interior',
    `Design a warm, modern cafe or restaurant interior inside the space in my references. Create a mix of seating that suits the room, such as banquettes, small tables and a social counter, with a service area that flows logically, soft layered lighting and tactile materials like wood, stone, plaster and textiles. The atmosphere should invite people to stay. Keep the real walls, openings and proportions of my space, and make sure aisles and seating are realistic and comfortable.`,
    { tags: ['cafe', 'coffee', 'restaurant', 'food', 'bakery', 'bar', 'dining'], priority: 92 }),
  idea('interior_design', 'clinic-reception', 'Healthcare and beauty', 'Design a calm clinic, dental or salon reception',
    `Design a calm, reassuring reception and waiting interior for a clinic, dental practice or salon in the space in my references. Include a welcoming desk, comfortable seating with clear sight lines, gentle layered lighting, easy-to-clean durable finishes, good wayfinding to treatment rooms and a clean, professional palette. It should feel trustworthy and modern. Keep the real walls, openings and proportions of my space, and make everything realistic, accessible and buildable.`,
    { tags: ['clinic', 'dental', 'medical', 'salon', 'spa', 'beauty', 'barber', 'doctor'], priority: 88 }),
  idea('interior_design', 'furnish-empty-room', 'Real estate', 'Furnish this empty room so the property sells',
    `Stage the empty interior in my photos so that it sells or rents faster. Furnish it with tasteful, well-scaled pieces that show how the room can be lived in, with a neutral warm palette, soft layered lighting and a few simple decor accents. Keep every wall, window, door, floor and ceiling exactly as in my photo, with realistic proportions and walking space. The result should look like a professional listing photograph of the same real room.`,
    { requiresReference: true, tags: ['real-estate', 'staging', 'empty', 'listing', 'sell', 'rent', 'apartment', 'villa'], priority: 86 }),
  idea('interior_design', 'before-after-interior', 'Transformation', 'Show a precise before-and-after of my interior',
    `Show a precise before-and-after transformation of the interior in my photos. Keep the camera position, the walls, openings, ceiling and proportions identical so the two images line up and the improvement is obvious and honest. The after image should change finishes, lighting, furniture and decor into a cohesive, realistic design that suits the room and its use. Nothing structural may move unless I ask for it, and every new element must be believable and buildable.`,
    { requiresReference: true, priority: 84 }),
  idea('interior_design', 'multiple-angles', 'Presentation', 'Show my design from several consistent angles',
    `Produce a consistent set of views of one single design for the interior in my references, so that the same room appears from several different positions: a wide establishing view, a reverse angle, a detail view of materials and lighting, and a presentation view. Every image must show identical walls, openings, finishes, furniture and colours, with only the camera changing. Use the real geometry of my space, with believable perspective and straight vertical lines throughout.`,
    { requiresReference: true, priority: 82 }),
  idea('interior_design', 'three-styles', 'Presentation', 'Compare the same room in three different styles',
    `Show the same interior from my references in three clearly different design styles, for example modern minimal, warm classic and bold contemporary, so I can compare and decide. Keep the architecture, camera position, openings and proportions identical across all three, and change only materials, colours, furniture, lighting and decor. Each style must feel complete, realistic and well designed, not a filter, and each should be a scheme a real client could choose.`,
    { requiresReference: true, priority: 80 }),
  idea('interior_design', 'ceiling-lighting', 'Detail', 'Design the ceiling, gypsum work and lighting',
    `Design the ceiling and lighting system for the interior in my references. Propose a gypsum or plaster ceiling with clean lines, coves and shadow gaps, and a layered lighting plan combining ambient, task and accent light with linear lights, spots or pendants where they make sense. Keep the real room height, beams, openings and proportions, avoid overcrowding the ceiling, and show how the lighting looks at night and in the day. Everything should be realistic for a contractor to build.`,
    { requiresReference: true, tags: ['ceiling', 'gypsum', 'lighting', 'linear', 'spots', 'cove'], priority: 78 }),
  idea('interior_design', 'kitchen-redesign', 'Home', 'Create a warm, practical kitchen redesign',
    `Redesign the kitchen interior in my photos so that it is both beautiful and practical. Plan a clear working triangle, generous worktops, well-organised storage, durable cabinets and surfaces, good task lighting and a warm, welcoming atmosphere. Keep the real walls, windows, doors and plumbing positions unless I say otherwise, use realistic appliance sizes and show the finished kitchen from the same viewpoint as my photo so I can compare the two.`,
    { tags: ['kitchen', 'home', 'apartment', 'cabinets', 'cooking'], priority: 76 }),
  idea('interior_design', 'bedroom-retreat', 'Home', 'Redesign this bedroom as a calm retreat',
    `Redesign the bedroom interior in my photos as a calm, restful retreat. Use a soft palette, layered textiles, warm indirect lighting, well-placed storage and a bed that anchors the room without crowding it. Keep the real walls, windows, doors and proportions, and keep circulation space comfortable. The mood should be quiet and welcoming, with natural materials and realistic furniture sizes, shown from the same viewpoint as my photo.`,
    { tags: ['bedroom', 'home', 'villa', 'apartment', 'sleep', 'master'], priority: 74 }),
  idea('interior_design', 'family-living-majlis', 'Home', 'Design a family living room with a guest seating area',
    `Design a welcoming family living room with a generous guest seating area for hosting visitors, inside the space in my references. Arrange comfortable seating around a clear focal point, add warm layered lighting, durable family-friendly fabrics, a tasteful rug and decor with a touch of local character. Keep the real walls, openings and proportions, make sure there is room to move and serve guests, and show it from a natural eye-level viewpoint so it feels like a real home.`,
    { tags: ['living room', 'majlis', 'salon', 'guest', 'family', 'home', 'villa'], priority: 72 }),
  idea('interior_design', 'interior-walkthrough', 'Video', 'Create a smooth walkthrough of my interior design',
    `Create a smooth, professional walkthrough video of the interior design for the space in my references. Start at the natural entrance, move slowly through the main areas at eye height, pause on the best compositions such as a focal wall, a lighting feature or a view through a doorway, and end on a hero view. Keep the layout, openings and proportions consistent across every shot, use gentle stabilised movement with no cuts that break the geography, and no text on screen.`,
    { requiresReference: true, tags: ['walkthrough', 'tour', 'video', 'real-estate', 'presentation'], priority: 70 }),
];

const ARCHITECTURE: CreativeIdea[] = [
  idea('architecture', 'site-concept', 'New building', 'Design a contemporary building that fits this exact plot',
    `Design a contemporary new building for the plot I marked, shown on the real site. Study the street, the neighbouring buildings, their heights and their line along the road, and fit the new building naturally into that rhythm with a clear massing, a believable floor count and a clean, well-proportioned elevation. Use materials that suit the climate and the neighbourhood, keep the footprint within the plot, and show it at eye level from the street in soft daylight so the real surroundings stay recognisable.`,
    { tags: ['plot', 'land', 'site', 'building', 'new', 'empty'], priority: 100 }),
  idea('architecture', 'family-villa', 'Residential', 'Design a modern family villa for this plot',
    `Design a modern family villa for the plot I marked. Give it a clear entrance, generous living areas that open to terraces, a sensible arrangement of floors and a calm, well-proportioned form with quality local materials such as stone and render. Respect the setbacks, keep the building within the plot, and let the neighbours and the street stay exactly as they are in my references. Show it at eye level from the street in warm daylight, with planting that belongs to the site.`,
    { tags: ['villa', 'house', 'residential', 'family', 'home'], priority: 94 }),
  idea('architecture', 'apartment-block', 'Residential', 'Design a mid-rise apartment building',
    `Design a mid-rise apartment building for the plot I marked, with a clear base, a rhythmic arrangement of balconies and windows, a well-marked entrance and a roof that finishes the building elegantly. Respect the stated floor count and setbacks, relate its height and line to the neighbouring buildings in my references, and choose durable materials that suit the climate. Show it at eye level from the street, in soft daylight, on its real site.`,
    { tags: ['apartment', 'residential', 'flats', 'tower', 'housing'], priority: 88 }),
  idea('architecture', 'mixed-use', 'Mixed use', 'Design a new mixed-use building: shops below, homes above',
    `Design a new mixed-use building for the plot I marked, with lively shops at street level and homes above. Give the shop level generous glazing, a clear rhythm of units and sheltered pavement frontage, and give the upper floors a calmer residential character with balconies and a separate, welcoming residential entrance. Respect the setbacks and the stated number of floors, relate the building to the heights of its neighbours, and show it from street level in the real surroundings.`,
    { tags: ['mixed', 'retail', 'residential', 'shops', 'commercial', 'homes'], priority: 86 }),
  idea('architecture', 'shop-fit-out', 'Shop inside a building', 'Design my shop inside this existing building',
    `Design the interior of my shop inside the existing unit I marked, on the real street shown in my references. Show it from the street through the real entrance and glazing as a passer-by would see it, with a welcoming layout, lighting and displays that suit the business I describe. The rest of the building, the units above and beside it, the neighbours and the street all stay exactly as they are. Keep it realistic, buildable and true to the real unit.`,
    { tags: ['shop', 'store', 'boutique', 'clothes', 'fashion', 'retail', 'unit', 'clothing'], priority: 96 }),
  idea('architecture', 'shopfront', 'Shop front', 'Design a new shopfront and entrance for my shop',
    `Design a new shopfront for the unit I marked, on the real street shown in my references. Create an inviting entrance, large clear glazing, a refined sign zone with my business name only if I provide it, a canopy or lighting that works day and night, and materials that suit the building. The rest of the building, the neighbouring shops, the pavement and the street stay exactly as photographed, and the new design fills the real opening at its real scale.`,
    { tags: ['shopfront', 'storefront', 'sign', 'entrance', 'retail', 'shop'], priority: 92 }),
  idea('architecture', 'facade-renovation', 'Renovation', 'Renovate the facade of this existing building',
    `Renovate the facade of the existing building I marked, keeping its real structure, floor heights and openings. Propose new cladding, colours, lighting and shading elements that bring it up to date, repair or replace balconies and windows where it helps, and unify the street-facing elevation. The neighbours, the street and the camera view stay exactly as in my references. The result must look like a realistic, achievable makeover of this very building.`,
    { tags: ['renovate', 'facade', 'refurbish', 'old', 'existing', 'repaint', 'cladding'], priority: 90 }),
  idea('architecture', 'add-floors', 'Extension', 'Add two floors to this existing building',
    `Add two more floors to the existing building I marked, so it looks as if it was always designed that way. Keep the original building and its materials, continue its rhythm of windows and balconies, step or set back the new floors where it helps, and choose a roof that finishes the whole building. Respect the real height of the neighbours, keep the street and surroundings exactly as in my references, and keep the structure plausible for the existing frame.`,
    { tags: ['extension', 'floors', 'add', 'existing', 'upper', 'vertical'], priority: 84 }),
  idea('architecture', 'office-building', 'Commercial', 'Design a compact modern office building',
    `Design a compact modern office building for the plot I marked. Give it a clear, welcoming entrance and lobby, efficient floor plates, large well-shaded windows and a refined, durable elevation that projects confidence and a professional character. Keep it within the plot and the setbacks, fit its height and line to the neighbouring buildings, and show it from street level in clear daylight on its real site, with the surroundings left exactly as photographed.`,
    { tags: ['office', 'commercial', 'corporate', 'business', 'headquarters'], priority: 80 }),
  idea('architecture', 'boutique-hotel', 'Hospitality', 'Design a boutique hotel on this plot',
    `Design a small boutique hotel for the plot I marked, with a memorable arrival, a lobby that opens to a terrace, rooms with balconies that make the most of the views, and a form that feels intimate, local and welcoming. Use warm local materials, shading and lighting that glow at dusk, keep within the plot and the stated floor count, and show the hotel from the street in soft evening light with the real neighbours left unchanged.`,
    { tags: ['hotel', 'guesthouse', 'hospitality', 'tourism', 'resort', 'boutique'], priority: 78 }),
  idea('architecture', 'day-and-dusk', 'Presentation', 'Show my finished building by day and at dusk',
    `Present my finished design on its real site in two matching images: one in clear daylight and one at dusk with warm light glowing from the windows and softly lit surroundings. Keep the design, the camera position, the plot and the neighbours identical in both, and change only the time of day and the light. Every window, entrance and material must match exactly across the pair, so the two views read as one real building photographed twice.`,
    { tags: ['dusk', 'night', 'lighting', 'presentation', 'render'], priority: 76 }),
  idea('architecture', 'plot-before-after', 'Transformation', 'Show the empty plot and the finished building',
    `Show a convincing before-and-after of the plot I marked: the empty land exactly as photographed, and the finished building standing on it from the same camera position. The real street, neighbours, trees, poles and road stay identical in both images, and the new building has a believable height, setback and shadow that belong to the site. The pair should help a client picture the future clearly and honestly.`,
    { tags: ['before', 'after', 'transformation', 'plot', 'empty', 'land'], priority: 74 }),
  idea('architecture', 'drone-reveal', 'Video', 'Create a cinematic drone reveal of my building on its plot',
    `Create a cinematic drone reveal of my finished building on its real plot. Start high with a wide view that shows the street and surroundings exactly as they are, then descend and curve smoothly toward the building to reveal its form, materials and entrance, and settle on a confident hero view in warm light. Keep the building identical in every frame, use slow stabilised movement, keep the neighbours unchanged, and add no text or people close to the camera.`,
    { tags: ['video', 'drone', 'aerial', 'reveal', 'walkthrough', 'presentation'], priority: 72 }),
  idea('architecture', 'site-landscape', 'Landscape', 'Design the landscape and outdoor spaces for this site',
    `Design the landscape and outdoor spaces for the site I marked: paths, seating, shade, planting, lighting and any water feature that suits the climate, arranged so the spaces feel useful and calm. Use plants that thrive locally, durable paving and lighting that works at night, and keep the building, boundary walls and neighbours exactly as in my references. Show it at eye level in soft daylight so the design reads as a real, maintainable place.`,
    { tags: ['landscape', 'garden', 'courtyard', 'outdoor', 'plants', 'terrace'], priority: 68 }),
];

export const CREATIVE_IDEAS: Record<IdeaFeature, CreativeIdea[]> = {
  ai_video: AI_VIDEO,
  product_images: PRODUCT_IMAGES,
  product_video: PRODUCT_VIDEO,
  web_video: WEB_VIDEO,
  scenario: SCENARIO,
  interior_design: INTERIOR_DESIGN,
  architecture: ARCHITECTURE,
};

const INTENT_FEATURE = {
  website: 'web_video',
  video: 'ai_video',
  photo: 'product_images',
  'product-video': 'product_video',
  scenario: 'scenario',
  interior: 'interior_design',
  architecture: 'architecture',
} as const;

export type IdeaIntent = keyof typeof INTENT_FEATURE;
export function featureForIntent(intent: IdeaIntent): IdeaFeature { return INTENT_FEATURE[intent]; }

function contextTokens(context: IdeaContext) {
  return `${context.websiteUrl ?? ''} ${context.prompt ?? ''} ${(context.referenceNames ?? []).join(' ')}`.toLowerCase();
}

function scoreIdea(item: CreativeIdea, context: IdeaContext) {
  const tokens = contextTokens(context);
  let score = item.priority;
  for (const tag of item.tags) if (tokens.includes(tag.toLowerCase())) score += 35;
  if (item.requiresReference && !context.hasReferences) score -= 14;
  if (item.requiresReference && context.hasReferences) score += 8;
  const seed = context.seed ?? 0;
  let hash = seed + 17;
  for (const ch of item.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  score += (hash % 13) / 10;
  return score;
}

export function getIdeasForIntent(intent: IdeaIntent, context: IdeaContext = {}, limit = 8) {
  return [...CREATIVE_IDEAS[featureForIntent(intent)]]
    .sort((a, b) => scoreIdea(b, context) - scoreIdea(a, context))
    .slice(0, Math.max(1, limit));
}

export function referenceHintForIdea(item: CreativeIdea, context: IdeaContext) {
  return item.requiresReference && !context.hasReferences
    ? 'Add a photo or reference for a more accurate result.'
    : null;
}

// ---------------------------------------------------------------------------------------------------------
// The chat box holds the idea's full master prompt. Whatever the person had already typed is kept under it,
// so choosing (or changing) an idea never throws their own words away.
// ---------------------------------------------------------------------------------------------------------
const DETAILS_MARK = '\n\nMy details: ';
const EVERY_IDEA = Object.values(CREATIVE_IDEAS).flat();

/** The text for the chat box: the idea's master prompt, then the person's own details if they had any. */
export function composeIdeaText(item: CreativeIdea, details = ''): string {
  const own = details.trim();
  return own ? `${item.prompt}${DETAILS_MARK}${own}` : item.prompt;
}

/** Splits the box into the idea it came from (if any, and not rewritten) and the person's own words. */
export function splitIdeaText(text: string | null | undefined): { idea: CreativeIdea | null; details: string } {
  const value = (text ?? '').trim();
  for (const item of EVERY_IDEA) {
    if (value === item.prompt) return { idea: item, details: '' };
    if (value.startsWith(item.prompt + DETAILS_MARK)) return { idea: item, details: value.slice(item.prompt.length + DETAILS_MARK.length).trim() };
  }
  return { idea: null, details: value };
}
