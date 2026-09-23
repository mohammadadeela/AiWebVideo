export interface SeoPage {
  path: string;
  title: string;
  description: string;
  index: boolean;
}

export interface PublicMarketingVideo {
  url: string | null;
  posterUrl: string | null;
  caption: string | null;
  eyebrow: string | null;
}

type SeoCopy = {
  eyebrow: string;
  h1: string;
  intro: string;
  sections?: Array<{ heading: string; body: string }>;
  faq?: Array<[string, string]>;
  links?: Array<[string, string]>;
  createHref?: string;
};

type PublicPageDefinition = Omit<SeoPage, 'path' | 'index'> & { copy: SeoCopy };

const MODE_LINKS: Array<[string, string]> = [
  ['Website Video', '/website-video-generator'],
  ['AI Video', '/ai-video-generator'],
  ['Product Photos', '/product-photo-generator'],
  ['Product Video', '/product-video-generator'],
  ['Talking Scenes', '/talking-video-generator'],
  ['Interior Design', '/ai-interior-design-generator'],
];

const FEATURE_PATHS = new Set([
  '/url-to-video', '/website-video-generator', '/saas-demo-video-generator', '/product-page-to-video',
  '/ai-video-generator', '/product-photo-generator', '/product-video-generator', '/talking-video-generator',
  '/ai-interior-design-generator', '/interior-design-walkthrough-video', '/real-estate-walkthrough-video',
  '/3d-house-walkthrough', '/ai-architectural-visualization', '/floor-plan-to-3d', '/room-redesign-ai',
]);

const PUBLIC_PAGES: Record<string, PublicPageDefinition> = {
  '/': {
    title: 'AI Video, Product Images & Interior Design | AiWebVideo',
    description:
      'Create website videos, original AI videos, product photos and videos, talking scenes, and interior design images or walkthroughs from your own sources.',
    copy: {
      eyebrow: 'Creative studio',
      h1: 'Make something worth showing.',
      intro:
        'Create videos, product imagery, and interior designs from a prompt, a website, or your own photos. Choose a mode and start in one creative workspace.',
      sections: [
        { heading: 'Website to video', body: 'Paste a public website or product page and describe the audience, offer, and campaign. Public page content and brand cues provide source context for a generated video.' },
        { heading: 'Idea or dialogue to video', body: 'Describe an original scene, or write the people, setting, and dialogue for a talking video. Add optional image references when visual identity matters.' },
        { heading: 'Real product to photos or video', body: 'Upload clear photographs of the actual product. Choose still campaign images or a product-focused video, and describe the setting, lighting, camera, and goal.' },
        { heading: 'Real spaces to design images or walkthroughs', body: 'Upload room or property photos, floor plans, or sketches and describe the intended design. Supply measured dimensions or scaled plans when proportions matter; a single photo cannot guarantee exact measurements.' },
        { heading: 'One production workspace', body: 'Keep the prompt, source material, selected settings, credits, progress, and completed results in the same project conversation.' },
      ],
      faq: [
        ['Can I turn a website URL into a video?', 'Yes. Submit a public website or product page, then describe what the campaign should promote.'],
        ['Can I generate product images and videos?', 'Yes. Supply photographs of the real product, then choose Product Photos for still images or Product Video for a moving commercial.'],
        ['Can I make interior design images or a tour?', 'Yes. Upload authorized photos, plans, or sketches and choose design images or a walkthrough. Use explicit measurements or a scaled plan when proportions matter.'],
      ],
      links: [['Website Video Generator', '/website-video-generator'], ['AI Video Generator', '/ai-video-generator'], ['Product Photo Generator', '/product-photo-generator'], ['Product Video Generator', '/product-video-generator'], ['Talking Video Generator', '/talking-video-generator'], ['AI Interior Design Generator', '/ai-interior-design-generator'], ['All creation modes', '/features'], ['Examples', '/examples']],
    },
  },
  '/url-to-video': {
    title: 'URL to Video AI Generator — Turn a Website Into Video | AiWebVideo',
    description:
      'Paste a public website URL and turn it into a brand-aware AI marketing video. AiWebVideo reads the page, plans the story, generates the film, and keeps production in one workspace.',
    copy: {
      eyebrow: 'URL to video AI',
      h1: 'Turn any website URL into an AI video',
      intro: 'Paste a public URL, describe what you want to promote, and let the website provide real product, brand, and messaging context for an AI-directed campaign video.',
      sections: [
        { heading: 'Paste the URL', body: 'Use a public homepage, landing page, product page, or campaign page as the source.' },
        { heading: 'AI studies the page', body: 'Useful visible content and brand context are captured so the creative direction is grounded in the real business.' },
        { heading: 'Generate the campaign', body: 'The workflow plans the story and produces AI-generated video scenes instead of presenting a simple screenshot slideshow as the final film.' },
      ],
      faq: [
        ['What is a URL to video generator?', 'It is a workflow that uses a webpage link as source context for creating a video. AiWebVideo combines that page with your campaign goal and directs the production.'],
        ['What URLs work best?', 'Public pages with clear products, services, features, visuals, and calls to action work best. Private pages that require login should not be submitted.'],
        ['Can I make vertical video?', 'Yes. Common landscape, portrait, and square formats are supported by the creator.'],
      ],
      links: [['Website Video Generator', '/website-video-generator'], ['SaaS Demo Video', '/saas-demo-video-generator'], ['Product Page to Video', '/product-page-to-video'], ['Website-to-video guide', '/guides/turn-website-into-video']],
    },
  },
  '/website-video-generator': {
    title: 'AI Website Video Generator — Website to Marketing Video | AiWebVideo',
    description:
      'Create an AI marketing video from your website. AiWebVideo studies useful pages and brand context, builds the campaign direction, and generates the final film in one workspace.',
    copy: {
      eyebrow: 'Website video generator',
      h1: 'Create a marketing video from your website',
      intro: 'Use the website as the source of truth for the business, then direct a focused campaign around the product, offer, audience, or call to action that matters most.',
      sections: [
        { heading: 'Use broader website context', body: 'Homepage, product, feature, and campaign pages can provide context beyond a single copied block of text.' },
        { heading: 'Direct one clear story', body: 'Tell the creator which product, offer, feature, or audience matters so the video does not try to explain everything at once.' },
        { heading: 'Return to saved production', body: 'Signed-in projects keep active generation state and completed media attached to the workspace.' },
      ],
      faq: [
        ['How is this different from URL to video?', 'URL to video describes the input pattern. Website video generation is specifically designed around turning a business website and its useful public pages into a campaign story.'],
        ['Does it need private website access?', 'No. Use public pages only and do not submit private dashboards or customer information.'],
      ],
      links: [['URL to Video', '/url-to-video'], ['Examples', '/examples'], ['How it works', '/how-it-works'], ['Features', '/features']],
    },
  },
  '/saas-demo-video-generator': {
    title: 'SaaS Demo Video Generator — Create Product Videos With AI | AiWebVideo',
    description:
      'Create AI SaaS demo and launch videos from your product website. Ground the story in real product positioning and interface context, then generate the campaign in one workspace.',
    copy: {
      eyebrow: 'SaaS video generator',
      h1: 'Turn your SaaS website into a product story',
      intro: 'Use public SaaS positioning, feature pages, and interface context to create a focused launch, feature, or product-introduction video without starting from a blank script.',
      sections: [
        { heading: 'Choose the audience first', body: 'A founder, marketer, operations team, and developer care about different outcomes. Define the viewer before the feature list.' },
        { heading: 'Focus the product angle', body: 'Build the story around one launch, workflow, pain point, differentiator, or call to action.' },
        { heading: 'Create variants from one product', body: 'Use different prompts and formats for launch campaigns, sales outreach, feature announcements, and social distribution.' },
      ],
      faq: [
        ['Is this just a screen recorder?', 'No. The website is used as product and brand context while the workflow creates an AI-directed campaign story.'],
        ['Can I focus on one SaaS feature?', 'Yes. Tell the creator which feature, audience, pain point, or launch message should lead the video.'],
      ],
      links: [['Website Video Generator', '/website-video-generator'], ['URL to Video', '/url-to-video'], ['SaaS product video guide', '/guides/saas-product-demo-video'], ['Examples', '/examples']],
    },
  },
  '/product-page-to-video': {
    title: 'Product Page to Video AI — Ecommerce Video Generator | AiWebVideo',
    description:
      'Turn a public ecommerce product page into an AI campaign video. Use product benefits, merchandising, and brand context to direct social, launch, and promotional video.',
    copy: {
      eyebrow: 'Product page to video',
      h1: 'Turn a product page into campaign video',
      intro: 'Start from the product page customers already see, then direct a focused film around the offer, audience, product benefit, and campaign goal.',
      sections: [
        { heading: 'Use product-page context', body: 'Visible benefits, merchandising, product information, and brand language can ground the creative brief.' },
        { heading: 'Choose the campaign angle', body: 'Lead with the strongest reason to care: a launch, benefit, use case, seasonal offer, or problem the product solves.' },
        { heading: 'Use real references when exact appearance matters', body: 'Product photo and product-video modes accept supplied reference images when the real product needs to stay central to the production.' },
      ],
      faq: [
        ['Can I use an ecommerce product page?', 'You can submit a public product page that the website capture workflow can access and render.'],
        ['Can I create product photos too?', 'Yes. The unified creator includes product-photo generation from supplied reference images.'],
      ],
      links: [['URL to Video', '/url-to-video'], ['Product video guide', '/guides/product-page-video-ads'], ['Product Photo Generator', '/product-photo-generator'], ['Product Video Generator', '/product-video-generator'], ['Examples', '/examples']],
    },
  },
  '/ai-video-generator': {
    title: 'AI Video Generator — Create AI Videos From Prompts | AiWebVideo',
    description: 'Create original AI videos from a prompt and optional image references. Direct the story, camera, style, pacing, and format with AiWebVideo.',
    copy: {
      eyebrow: 'AI video generator',
      h1: 'Create an original AI video from an idea',
      intro: 'Describe the video you want in normal language, add references when useful, and let AiWebVideo turn the idea into a complete AI-directed video.',
      createHref: '/?create=video#generate',
      sections: [
        { heading: 'Describe the idea', body: 'Explain the subject, setting, action, style, audience, or story in your own words.' },
        { heading: 'Add optional references', body: 'Supply images when identity, appearance, product details, or visual direction should stay grounded.' },
        { heading: 'Choose delivery settings', body: 'Use portrait, landscape, or square format according to where the video will appear. Set duration and audio before generation when the campaign needs specific delivery.' },
        { heading: 'Generate a coherent video', body: 'The creator turns the brief into a planned production with camera, motion, pacing, and visual direction.' },
        { heading: 'Use the right mode', body: 'For dialogue and character performance, use Talking Video. For a public website as source, use Website Video. For a real product that needs supplied images, use Product Video.' },
      ],
      faq: [
        ['What is an AI video generator?', 'It is a tool that uses an instruction and optional references to generate video content. AiWebVideo adds creative planning so the request becomes a coherent production.'],
        ['Can I use an image as a reference?', 'Yes. Optional reference images can help anchor subjects, products, identity, or visual direction.'],
        ['Can I choose portrait video?', 'Yes. The creator supports common landscape, portrait, and square formats.'],
      ],
      links: [['Product Video Generator', '/product-video-generator'], ['Product Photo Generator', '/product-photo-generator'], ['Talking Video Generator', '/talking-video-generator'], ['AI video prompt guide', '/guides/create-ai-video-from-prompt']],
    },
  },
  '/product-photo-generator': {
    title: 'AI Product Photo Generator — Create Product Images | AiWebVideo',
    description: 'Upload real product references and create polished AI product photos for ecommerce, campaigns, social media, and marketing.',
    copy: {
      eyebrow: 'AI product photo generator',
      h1: 'Create product images from real references',
      intro: 'Give AiWebVideo your real product images and describe the scene, styling, background, or campaign you want. The product remains the visual anchor.',
      createHref: '/?create=photo#generate',
      sections: [
        { heading: 'Upload the real product', body: 'Add clear product images that show the shape, materials, colors, and important details.' },
        { heading: 'Describe the campaign image', body: 'Ask for a studio setup, lifestyle environment, seasonal concept, campaign mood, or specific composition.' },
        { heading: 'Keep the product recognizable', body: 'Show the label, packaging, and important visible details in the reference photos. Review generated outputs against the actual item before publishing a product listing.' },
        { heading: 'Generate variations', body: 'Create multiple visual directions from the same product reference for ecommerce, social, and marketing use.' },
        { heading: 'Choose photos or video', body: 'Use Product Photos for still images and Product Video for camera motion and a moving commercial. A public product URL uses the separate Product Page to Video workflow.' },
      ],
      faq: [
        ['Do I need to upload a product image?', 'Yes. Product-photo generation is designed around supplied references when the exact product should remain central.'],
        ['Can I request a specific background?', 'Yes. Describe the environment, surface, lighting, composition, and campaign mood you want.'],
        ['Can I make a product video from the same product?', 'Yes. Product Video is a separate mode designed for reference-grounded motion.'],
      ],
      links: [['Product Video Generator', '/product-video-generator'], ['Product Page to Video', '/product-page-to-video'], ['AI Video Generator', '/ai-video-generator'], ['Product media guide', '/guides/product-photos-and-videos-from-images']],
    },
  },
  '/product-video-generator': {
    title: 'AI Product Video Generator — Create Product Videos | AiWebVideo',
    description: 'Create AI product videos from real product images. Preserve the product as the reference while generating commercial motion, camera movement, and environments.',
    copy: {
      eyebrow: 'AI product video generator',
      h1: 'Create product videos from real references',
      intro: 'Upload the real product, describe the commercial direction, and let AiWebVideo build a continuous product-focused film around it.',
      createHref: '/?create=product-video#generate',
      sections: [
        { heading: 'Use real product references', body: 'Provide clear images that show the real product and important details.' },
        { heading: 'Direct the commercial', body: 'Specify the audience, environment, mood, motion, benefit, or campaign angle.' },
        { heading: 'Choose camera and format', body: 'Request a hero reveal, macro detail, or lifestyle setting and select landscape, portrait, or square based on the intended channel.' },
        { heading: 'Generate one coherent film', body: 'The workflow is designed around a complete product film rather than unrelated clips.' },
        { heading: 'Check product fidelity', body: 'Compare the finished video with your real item, including logos, colors, and packaging. Image references guide generation but do not guarantee pixel-perfect reproduction.' },
      ],
      faq: [
        ['Does it use my real product image?', 'Yes. Product Video is designed around supplied product references so the real item remains the primary visual anchor.'],
        ['Can I control the video style?', 'Yes. Describe the camera, environment, mood, pacing, audience, and campaign goal in the brief.'],
        ['Can I make product photos too?', 'Yes. Use Product Photos when you need still campaign imagery.'],
      ],
      links: [['Product Photo Generator', '/product-photo-generator'], ['Product Page to Video', '/product-page-to-video'], ['AI Video Generator', '/ai-video-generator'], ['Product media guide', '/guides/product-photos-and-videos-from-images']],
    },
  },
  '/talking-video-generator': {
    title: 'AI Talking Video Generator — Create Dialogue & Scenario Videos | AiWebVideo',
    description: 'Create AI talking and scenario videos from a description of the characters, dialogue, setting, camera, and performance you want.',
    copy: {
      eyebrow: 'AI talking video generator',
      h1: 'Direct a talking or scenario-driven AI video',
      intro: 'Describe the people, conversation, testimonial, or scripted scenario and let AiWebVideo direct the performance, camera blocking, pacing, and scene audio.',
      createHref: '/?create=scenario#generate',
      sections: [
        { heading: 'Describe the scene', body: 'Explain who is present, where they are, what happens, and what the viewer should understand.' },
        { heading: 'Direct dialogue and performance', body: 'Provide exact lines when wording matters and specify tone, reactions, camera style, and pacing.' },
        { heading: 'Add visual references if needed', body: 'Supply reference images when character identity or scene appearance needs grounding. State the spoken language and choose an audio setting supported by the creator.' },
        { heading: 'Generate the scene', body: 'Create a coherent talking or scenario-driven video with the selected audio direction.' },
        { heading: 'Review the spoken result', body: 'Listen to the final dialogue and check names, product claims, and wording before using the video publicly.' },
      ],
      faq: [
        ['Can I provide exact dialogue?', 'Yes. When exact wording is supplied, the production direction is designed to keep the spoken content faithful.'],
        ['Can I add character references?', 'Yes. Reference images can help anchor identity and visual direction where supported.'],
        ['Can I make a normal AI video instead?', 'Yes. Use the AI Video Generator for non-dialogue original concepts.'],
      ],
      links: [['AI Video Generator', '/ai-video-generator'], ['Product Video Generator', '/product-video-generator'], ['Website Video Generator', '/website-video-generator'], ['AI video prompt guide', '/guides/create-ai-video-from-prompt']],
    },
  },
  '/ai-interior-design-generator': {
    title: 'AI Interior Design Generator — Create Interior Design Images & Tours | AiWebVideo',
    description: 'Upload room photos, plans, or sketches and create AI interior design concepts, realistic redesign images, and walkthrough videos with reference-aware controls.',
    copy: {
      eyebrow: 'AI interior design generator',
      h1: 'Redesign rooms, homes, shops, and real estate spaces with AI',
      intro: 'Upload photos, floor plans, sketches, or elevations, then describe the interior you want. AiWebVideo can create design images or a walkthrough while using your references as the visual and architectural starting point.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Upload the space', body: 'Add room photos, plans, sketches, elevations, or other references you are authorized to use.' },
        { heading: 'Describe the design', body: 'Explain the style, materials, furniture, colors, lighting, function, and changes you want.' },
        { heading: 'Supply reliable dimensions', body: 'Give room widths, lengths, heights, or a scaled plan when proportions matter. Identify windows, doors, columns, curves, and ceiling details that must remain.' },
        { heading: 'Choose images or a walkthrough', body: 'Generate still design concepts or a presentation-style walkthrough while keeping the reference space as the starting point.' },
        { heading: 'Verify before building', body: 'AI concepts help present ideas. Check construction details, measurements, and code compliance separately with qualified professionals before using a concept for real work.' },
      ],
      faq: [
        ['Can I upload a floor plan?', 'Yes. Plans and sketches can be used as references, and explicit measurements should be supplied when accurate proportions matter.'],
        ['Can it make a walkthrough video?', 'Yes. Interior Design supports design-image and walkthrough-video outputs.'],
        ['Will a normal room photo give exact dimensions?', 'No. A photo alone cannot guarantee exact measurements. Use a scaled plan or explicit dimensions when geometry must be reliable.'],
        ['Can I use it for real estate?', 'Yes. Real estate presentation is a practical use case for concept images and walkthrough-style media, but generated visuals should not be presented as construction-ready drawings unless separately verified by a qualified professional.'],
      ],
      links: [['Interior Design Walkthrough', '/interior-design-walkthrough-video'], ['Real Estate Walkthrough', '/real-estate-walkthrough-video'], ['3D House Walkthrough', '/3d-house-walkthrough'], ['AI Architectural Visualization', '/ai-architectural-visualization'], ['Floor Plan to 3D', '/floor-plan-to-3d'], ['Room Redesign AI', '/room-redesign-ai'], ['Interior design guide', '/guides/interior-design-from-photos-and-plans']],
    },
  },
  '/interior-design-walkthrough-video': {
    title: 'AI Interior Design Walkthrough Video Generator | AiWebVideo',
    description: 'Turn room photos, plans, sketches, or design concepts into an AI interior design walkthrough video for homes, shops, and property presentations.',
    copy: {
      eyebrow: 'Interior design walkthrough video',
      h1: 'Create an AI interior design walkthrough video',
      intro: 'Upload the space and describe the design direction to create a presentation-style walkthrough grounded in your references.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Upload the space', body: 'Add photos, plans, sketches, elevations, or other references you are authorized to use.' },
        { heading: 'Describe the redesign', body: 'Specify style, materials, furniture, colors, lighting, and changes.' },
        { heading: 'Choose a walkthrough', body: 'Create a presentation-oriented tour from the supplied design references.' },
      ],
      faq: [
        ['Can I use a floor plan?', 'Yes. Use a scaled plan or explicit measurements when accurate proportions matter.'],
        ['Is it construction documentation?', 'No. Generated visuals are presentation concepts and do not replace professional construction documentation.'],
      ],
      links: [['AI Interior Design Generator', '/ai-interior-design-generator'], ['3D House Walkthrough', '/3d-house-walkthrough'], ['Floor Plan to 3D', '/floor-plan-to-3d']],
    },
  },
  '/real-estate-walkthrough-video': {
    title: 'AI Real Estate Walkthrough Video Generator | AiWebVideo',
    description: 'Create property walkthrough and presentation videos from real estate photos, plans, sketches, and interior design references.',
    copy: {
      eyebrow: 'Real estate walkthrough video',
      h1: 'Create an AI real estate property walkthrough',
      intro: 'Turn property references into a guided visual tour or redesign presentation for homes, apartments, shops, and other spaces.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Add property references', body: 'Upload photos, plans, sketches, or other authorized media.' },
        { heading: 'Describe the property story', body: 'Explain rooms, audience, style, key features, and desired pacing.' },
        { heading: 'Generate the walkthrough', body: 'Create a presentation-style property tour from the project references.' },
      ],
      faq: [
        ['Can I use listing photos?', 'Yes, when you have authorization to use them.'],
        ['Can it guarantee exact dimensions?', 'Use scaled plans or explicit measurements when dimensional accuracy matters; ordinary photos alone cannot guarantee it.'],
      ],
      links: [['Interior Design Walkthrough', '/interior-design-walkthrough-video'], ['AI Interior Design Generator', '/ai-interior-design-generator'], ['3D House Walkthrough', '/3d-house-walkthrough']],
    },
  },
  '/3d-house-walkthrough': {
    title: '3D House Walkthrough AI Generator | AiWebVideo',
    description: 'Create a 3D-style visual walkthrough concept for a house using photos, floor plans, sketches, and interior design references.',
    copy: {
      eyebrow: '3D house walkthrough',
      h1: 'Create a 3D-style house walkthrough with AI',
      intro: 'Start from house references and describe the architectural and interior direction to create a presentation walkthrough.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Upload references', body: 'Use house photos, floor plans, sketches, elevations, or design references.' },
        { heading: 'Describe the architecture', body: 'Specify materials, style, rooms, circulation, landscaping, or interior direction.' },
        { heading: 'Generate the walkthrough', body: 'Create a 3D-style presentation sequence around the supplied concept.' },
      ],
      faq: [
        ['Is this a CAD or BIM model?', 'No. It is a generated visual presentation, not a substitute for CAD, BIM, surveying, or construction documentation.'],
        ['Can I use a floor plan?', 'Yes. Scaled plans or explicit measurements are recommended when geometry matters.'],
      ],
      links: [['Interior Design Walkthrough', '/interior-design-walkthrough-video'], ['Floor Plan to 3D', '/floor-plan-to-3d'], ['AI Architectural Visualization', '/ai-architectural-visualization']],
    },
  },
  '/ai-architectural-visualization': {
    title: 'AI Architectural Visualization Generator | AiWebVideo',
    description: 'Create architectural concept images and walkthrough-style presentations from plans, sketches, elevations, and reference photos.',
    copy: {
      eyebrow: 'AI architectural visualization',
      h1: 'Create AI architectural visualization from plans and references',
      intro: 'Upload architectural references and describe the intended design to create presentation-oriented visual material.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Upload drawings', body: 'Add plans, sketches, elevations, or authorized reference photos.' },
        { heading: 'Describe design intent', body: 'Specify architecture, materials, lighting, landscape, interiors, and presentation style.' },
        { heading: 'Generate concept visuals', body: 'Create images or walkthrough-style presentation media while keeping supplied references central.' },
      ],
      faq: [
        ['Can it replace architectural drawings?', 'No. Generated visuals are presentation concepts and do not replace professional architectural, engineering, surveying, CAD, or BIM documentation.'],
        ['Can I use a sketch?', 'Yes. Sketches and plans can be supplied as visual references.'],
      ],
      links: [['AI Interior Design Generator', '/ai-interior-design-generator'], ['3D House Walkthrough', '/3d-house-walkthrough'], ['Floor Plan to 3D', '/floor-plan-to-3d']],
    },
  },
  '/floor-plan-to-3d': {
    title: 'Floor Plan to 3D AI Generator — Visualize Floor Plans | AiWebVideo',
    description: 'Use a floor plan, sketch, or architectural reference to create AI interior design images and walkthrough-style visual concepts.',
    copy: {
      eyebrow: 'Floor plan to 3D concept',
      h1: 'Turn a floor plan into a 3D-style design concept',
      intro: 'Upload a floor plan and describe the style, materials, furniture, rooms, and presentation you want.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Upload the plan', body: 'Add a clear floor plan, sketch, or other authorized architectural reference.' },
        { heading: 'Provide scale', body: 'Include dimensions or a scale reference when room proportions must be reliable.' },
        { heading: 'Visualize the interior', body: 'Create still concepts or a presentation-style walkthrough.' },
      ],
      faq: [
        ['Will the AI infer exact dimensions from any image?', 'No. Use a scaled plan or explicit dimensions when accurate geometry matters.'],
        ['Can I create a video tour?', 'Yes. The Interior Design workflow supports walkthrough-style video output.'],
      ],
      links: [['AI Architectural Visualization', '/ai-architectural-visualization'], ['Room Redesign AI', '/room-redesign-ai'], ['Interior Design Walkthrough', '/interior-design-walkthrough-video']],
    },
  },
  '/room-redesign-ai': {
    title: 'AI Room Redesign Generator — Redesign Any Room From a Photo | AiWebVideo',
    description: 'Upload a room photo and create interior redesign concepts with new furniture, materials, colors, lighting, and style.',
    copy: {
      eyebrow: 'AI room redesign',
      h1: 'Redesign a room from a photo with AI',
      intro: 'Upload a room photo and describe the look you want. Explore interior directions while keeping the room as the visual starting point.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Upload the room', body: 'Add a clear room photo or an additional plan/reference if available.' },
        { heading: 'Describe the style', body: 'Tell the creator the furniture, materials, colors, lighting, and atmosphere you want.' },
        { heading: 'Generate design images', body: 'Create visual concepts and continue to a walkthrough-style output when useful.' },
      ],
      faq: [
        ['Can a photo guarantee exact room dimensions?', 'No. A photo alone cannot guarantee exact measurements. Use a scaled plan or explicit dimensions when geometry matters.'],
        ['Can I ask it to keep windows and doors?', 'Yes. State the existing elements that must remain in the request.'],
      ],
      links: [['AI Interior Design Generator', '/ai-interior-design-generator'], ['Interior Design Walkthrough', '/interior-design-walkthrough-video'], ['Floor Plan to 3D', '/floor-plan-to-3d']],
    },
  },
  '/examples': {
    title: 'AI Video, Product Media & Interior Design Examples | AiWebVideo',
    description:
      'Explore available AiWebVideo campaign videos and practical starting points for website video, AI video, product photos and video, talking scenes, and interior design.',
    copy: {
      eyebrow: 'Examples and use cases',
      h1: 'See what you can create from a website, product, idea, or space',
      intro: 'Watch campaign films when available and explore distinct starting points for each creation mode. Use-case descriptions explain possible workflows; they are not claimed customer results.',
      sections: [
        { heading: 'Website and SaaS video', body: 'Use a public website or SaaS product page as source context for a campaign with one audience, clear story, and call to action.' },
        { heading: 'AI video and talking scenes', body: 'Start from a prompt for an original video, or specify characters, dialogue, setting, and camera direction for a talking scene.' },
        { heading: 'Product photos and product video', body: 'Supply photographs of the real item to direct still ecommerce visuals or a moving product campaign.' },
        { heading: 'Interior images and property walkthroughs', body: 'Start from a real room photo, plan, or sketch; describe the desired design and choose still concepts or a presentation tour.' },
      ],
      links: [['Website Video', '/website-video-generator'], ['AI Video', '/ai-video-generator'], ['Product Photos', '/product-photo-generator'], ['Product Video', '/product-video-generator'], ['Talking Scenes', '/talking-video-generator'], ['Interior Design', '/ai-interior-design-generator']],
    },
  },
  '/guides/turn-website-into-video': {
    title: 'How to Turn a Website Into a Video With AI | AiWebVideo',
    description:
      'A practical guide to turning a website into a useful AI marketing video: choose the goal, source pages, story, format, prompt, and review criteria.',
    copy: {
      eyebrow: 'Practical guide',
      h1: 'How to turn a website into a video with AI',
      intro: 'A good website-to-video workflow is not about showing every page. It is about deciding what the viewer should understand, using the site as evidence, and building one clear campaign around that goal.',
      sections: [
        { heading: 'Start with one campaign goal', body: 'Define the audience, the single offer or product focus, the call to action, and where the video will be published.' },
        { heading: 'Use the website as source context', body: 'Web copy is written for scanning and navigation; video needs sequence. Use the site for facts, visuals, positioning, and brand cues while the campaign plan decides what appears first.' },
        { heading: 'Review the story before polish', body: 'Check whether the sequence communicates a clear hook, value, evidence, and call to action before optimizing visual details.' },
      ],
      links: [['Try URL to Video', '/url-to-video'], ['Website Video Generator', '/website-video-generator'], ['How it works', '/how-it-works']],
    },
  },
  '/guides/saas-product-demo-video': {
    title: 'How to Create a SaaS Product Demo Video With AI | AiWebVideo',
    description:
      'Plan a stronger SaaS product video by choosing one audience, one product angle, the right website context, a clear narrative, and a distribution format.',
    copy: {
      eyebrow: 'Practical guide',
      h1: 'How to make a stronger SaaS product video',
      intro: 'The biggest SaaS video mistake is trying to explain the entire product. Choose one audience and one job, then use the product website to support that story.',
      sections: [
        { heading: 'Pick the viewer before the feature', body: 'Define who is watching, what problem feels urgent to them, and what outcome would make them care.' },
        { heading: 'Choose one product angle', body: 'A launch film can focus on a new capability; an outbound film can focus on a painful workflow; a homepage overview can explain category and value.' },
        { heading: 'Create variants instead of one overloaded master', body: 'Use separate versions for different audiences, features, and channels rather than forcing every purpose into one short film.' },
      ],
      links: [['SaaS Demo Generator', '/saas-demo-video-generator'], ['URL to Video', '/url-to-video'], ['Examples', '/examples']],
    },
  },
  '/guides/product-page-video-ads': {
    title: 'How to Turn a Product Page Into a Video Ad With AI | AiWebVideo',
    description:
      'A practical guide to converting ecommerce product-page context into a focused AI video campaign for launches, offers, and social promotion.',
    copy: {
      eyebrow: 'Practical guide',
      h1: 'How to turn a product page into a video campaign',
      intro: 'Product pages answer buying questions. Video campaigns need a hook and a sequence. Use the page for product truth while the campaign brief chooses the angle.',
      sections: [
        { heading: 'Decide the buying reason', body: 'Choose one audience, one product, one leading benefit, and one call to action.' },
        { heading: 'Separate product truth from creative angle', body: 'Use the page for grounded product information and the prompt to decide how those facts become a campaign.' },
        { heading: 'Create variants around one source', body: 'Change the audience, benefit, hook, offer, or destination instead of trying to put every angle into one video.' },
      ],
      links: [['Product Page to Video', '/product-page-to-video'], ['Product Photo Generator', '/product-photo-generator'], ['Product Video Generator', '/product-video-generator'], ['URL to Video', '/url-to-video']],
    },
  },
  '/guides/create-ai-video-from-prompt': {
    title: 'How to Create an AI Video From a Prompt or Dialogue | AiWebVideo',
    description: 'Plan an original AI video or talking scene: define the subject, action, camera, references, audio, format, and review criteria before generating.',
    copy: {
      eyebrow: 'Practical guide',
      h1: 'How to create an AI video from a prompt or dialogue',
      intro: 'An original film begins with an action and visual direction. A talking scene also needs characters, dialogue, and performance instructions. Choose the mode based on what viewers should see and hear.',
      createHref: '/?create=video#generate',
      sections: [
        { heading: 'Choose original video or talking scene', body: 'Use AI Video when the subject, setting, and visual action lead the film. Use Talking Video when a conversation, scripted line, explanation, or scenario is the main result.' },
        { heading: 'Describe visible action', body: 'Name the subject, location, movement, and mood. Specify what must remain visible from any supplied image references.' },
        { heading: 'Direct camera, format, and audio', body: 'Choose landscape, square, or portrait for the destination. Set duration and audio; for talking scenes, state the language and exact lines when wording matters.' },
        { heading: 'Add references selectively', body: 'Image references can guide appearance or identity, but generation should still be reviewed for visual fidelity.' },
        { heading: 'Review before publishing', body: 'Check continuity, distorted text, unsupported claims, dialogue mistakes, and mismatched audio in the final video.' },
      ],
      links: [['AI Video Generator', '/ai-video-generator'], ['Talking Video Generator', '/talking-video-generator'], ['All creation modes', '/features']],
    },
  },
  '/guides/product-photos-and-videos-from-images': {
    title: 'How to Make AI Product Photos and Videos From Images | AiWebVideo',
    description: 'Use real product photos as references for AI ecommerce imagery and product commercials, with practical guidance for lighting, motion, fidelity, and review.',
    copy: {
      eyebrow: 'Practical guide',
      h1: 'How to make product photos and videos from real images',
      intro: 'A public product page and an uploaded photograph are different starting points. Use reference photos when the actual item, packaging, or label needs to guide the output, then choose a still image or a moving film.',
      createHref: '/?create=photo#generate',
      sections: [
        { heading: 'Photograph the real product clearly', body: 'Use sharp, well-lit images from useful angles showing shape, materials, color, label, and packaging. Upload only media you may use.' },
        { heading: 'Choose photos or video', body: 'Product Photos makes still ecommerce or campaign concepts. Product Video adds movement and camera direction. Product Page to Video starts from a public ecommerce URL.' },
        { heading: 'Describe one campaign direction', body: 'Specify the audience, setting, lighting, and desired use. For video, add camera movement, a reveal or close-up, pacing, and aspect ratio.' },
        { heading: 'Pick a format for the destination', body: 'A vertical social ad, a square feed image, and a wide banner need different framing; decide the placement before generating.' },
        { heading: 'Compare output to the real item', body: 'AI can alter small text, logos, colors, or packaging. Review the result before making commercial claims or publishing a listing.' },
      ],
      links: [['Product Photo Generator', '/product-photo-generator'], ['Product Video Generator', '/product-video-generator'], ['Product Page to Video', '/product-page-to-video']],
    },
  },
  '/guides/interior-design-from-photos-and-plans': {
    title: 'How to Create AI Interior Design From Photos and Floor Plans | AiWebVideo',
    description: 'Prepare room photos, scaled plans, measurements, preserved elements, and a design brief for AI interior images or a presentation walkthrough.',
    copy: {
      eyebrow: 'Practical guide',
      h1: 'How to make interior design images and walkthroughs from real spaces',
      intro: 'A useful redesign starts with the actual room or property. Supply references for existing geometry, specify what should change, and choose still concepts or a walkthrough presentation.',
      createHref: '/?create=interior#generate',
      sections: [
        { heading: 'Capture the space', body: 'Show walls, windows, doors, columns, ceiling, curves, and built-ins. Identify which photo belongs to which room. Plans and elevations provide context a single perspective cannot.' },
        { heading: 'Supply dimensions when they matter', body: 'Give measured width, length, and height or a scaled plan. A normal photo alone cannot guarantee exact dimensions or a true 3D model. Mark fixed elements to preserve.' },
        { heading: 'Specify design decisions', body: 'Describe intended use, materials, furniture, ceiling treatment, lighting, color, and atmosphere. State structural changes explicitly when permitted.' },
        { heading: 'Select images or walkthrough video', body: 'Use still images to compare options. For a walkthrough, specify room order, camera path, and focus areas; it is a presentation concept, not CAD or BIM geometry.' },
        { heading: 'Verify before building or listing', body: 'Check openings, proportions, ceiling details, lighting, and material claims against the real property. Have professionals verify construction requirements.' },
      ],
      links: [['AI Interior Design Generator', '/ai-interior-design-generator'], ['Interior Design Walkthrough', '/interior-design-walkthrough-video'], ['Floor Plan to 3D-style Concept', '/floor-plan-to-3d']],
    },
  },
  '/features': {
    title: 'AI Video, Product Media & Interior Design Features | AiWebVideo',
    description:
      'Compare AiWebVideo creation modes: website video, original AI video, product photos and video, talking scenes, and interior design images or walkthroughs.',
    copy: {
      eyebrow: 'Choose the right creation mode',
      h1: 'What can I create with AiWebVideo?',
      intro: 'Choose the source you already have and the result you need. Every mode runs in the same creator, with its own references, settings, and credit estimate.',
      sections: [
        { heading: 'Website Video: public URL to campaign', body: 'Provide a public business website or product page and a campaign goal. The site supplies messaging and brand context; the output is an AI-directed marketing video.' },
        { heading: 'AI Video: prompt to original film', body: 'Describe the subject, action, setting, camera, and style. Optional references can help ground the look; the output is an original video.' },
        { heading: 'Product Photos: real product to still images', body: 'Provide clear images of your real product and request a studio, lifestyle, or seasonal scene. The output is campaign or ecommerce imagery.' },
        { heading: 'Product Video: real product to moving film', body: 'Provide images of the real product and describe motion, camera, and campaign intent. The output is a product-focused video rather than a still image.' },
        { heading: 'Talking Video: dialogue to scene', body: 'Describe who speaks, the lines, setting, and performance direction. The output is a talking or scenario-driven video; audio depends on the selected production settings.' },
        { heading: 'Interior Design: room or plan to images or tour', body: 'Provide photos, floor plans, sketches, or elevations with style and material instructions. Choose still concepts or a walkthrough video; provide explicit measurements or a scaled plan for important proportions.' },
        { heading: 'Select the correct source', body: 'Use Product Page to Video for public ecommerce URLs, Product Photos or Product Video for uploaded real product images, and Interior Design for rooms and properties. A normal photo alone does not guarantee exact architectural dimensions.' },
      ],
      faq: [
        ['Which mode makes AI product images?', 'Product Photos takes uploaded images of the real item and creates still marketing or ecommerce visuals. Product Video makes moving product footage from product references.'],
        ['Can I create an interior design tour from room photos?', 'Yes. Choose Interior Design, upload authorized photos or plans, describe the style and materials, and select a walkthrough video. Provide dimensions when proportions matter.'],
        ['Do I need a website to generate an AI video?', 'No. AI Video accepts a creative prompt and optional visual references. Website Video uses a public website URL as the source.'],
      ],
      links: [['Website Video', '/website-video-generator'], ['AI Video', '/ai-video-generator'], ['Product Photos', '/product-photo-generator'], ['Product Video', '/product-video-generator'], ['Talking Video', '/talking-video-generator'], ['Interior Design', '/ai-interior-design-generator'], ['Interior Walkthrough', '/interior-design-walkthrough-video'], ['Floor Plan to 3D', '/floor-plan-to-3d'], ['Pricing', '/pricing']],
    },
  },
  '/how-it-works': {
    title: 'How AI Video, Product Images & Interior Design Work | AiWebVideo',
    description:
      'See the input, AI workflow, and output for website video, original AI video, product images and video, talking scenes, and interior design tours.',
    copy: {
      eyebrow: 'Workflow',
      h1: 'Start with a URL, an idea, a product, or a real space',
      intro: 'Choose the result you want, provide the source and a clear brief, review the settings and credit estimate, and follow generation in one workspace.',
      sections: [
        { heading: 'Website Video', body: 'Paste a public website and describe the campaign. The system captures visible site context and uses it to direct the generated video.' },
        { heading: 'AI Video and Talking Scenes', body: 'Write an original prompt, or specify a conversation, characters, setting, and dialogue. Add references when appearance matters.' },
        { heading: 'Product Photos and Product Video', body: 'Upload photographs of the real product, then request still images or a product-focused moving campaign.' },
        { heading: 'Interior Design', body: 'Upload room or property photos, floor plans, or sketches; describe materials, lighting, and style. Choose still design images or a walkthrough. Give measurements when geometry matters.' },
        { heading: 'Review and delivery', body: 'Paid AI generation checks available credits before starting. Review progress and finished media in the project workspace.' },
      ],
      links: [['All creation modes', '/features'], ['Website Video', '/website-video-generator'], ['Product Photos', '/product-photo-generator'], ['Interior Design', '/ai-interior-design-generator'], ['Examples', '/examples'], ['Pricing', '/pricing']],
    },
  },
  '/pricing': {
    title: 'AI Video, Product Media & Interior Design Pricing | AiWebVideo',
    description:
      'See credit-based pricing for website and AI videos, product images and videos, talking scenes, and interior design images or tours.',
    copy: {
      eyebrow: 'Pricing',
      h1: 'Know the production cost before you generate',
      intro: 'AiWebVideo uses credits for paid generation. The creator shows the estimated production cost based on the selected mode, duration, quality, and audio choices.',
      sections: [
        { heading: 'Credits before generation', body: 'See the current production estimate before starting paid generation.' },
        { heading: 'Multiple creation modes', body: 'Website video, original AI video, product photos and video, talking scenes, and interior design image or video modes use the shared credit system. Exact estimates depend on selected options.' },
      ],
      links: [['How it works', '/how-it-works'], ['All creation modes', '/features'], ['Interior Design', '/ai-interior-design-generator'], ['FAQ', '/faq']],
    },
  },
  '/about': {
    title: 'About AiWebVideo — AI Video, Product Media & Interior Design | AiWebVideo',
    description:
      'Learn about AiWebVideo\'s approach to website video, AI video, product photos and video, talking scenes, and interior design.',
    copy: { eyebrow: 'About AiWebVideo', h1: 'Create from the sources you already have', intro: 'AiWebVideo turns public websites, original ideas, real product images, and space references into directed video, images, and interior concepts.', links: [['How it works', '/how-it-works'], ['All creation modes', '/features']] },
  },
  '/faq': {
    title: 'AI Video, Product Media & Interior Design FAQ | AiWebVideo',
    description:
      'Answers to common questions about AiWebVideo\'s website video, product images and videos, interior design, generation, credits, billing, and accounts.',
    copy: {
      eyebrow: 'Frequently asked questions',
      h1: 'Frequently asked questions',
      intro: 'Straight answers about website and AI video, product references, interior design, credits, and saved projects.',
      faq: [
        ['What can I create?', 'Create website videos, original AI videos, product photos and videos, talking scenes, or interior design images and walkthroughs. Choose the mode based on your source and desired result.'],
        ['Can I make a video without talking?', 'Yes. Production settings include options for voice and music, music without talking, or silent output where supported by the creator.'],
        ['Can I attach real product references?', 'Yes. Product photo and product video modes accept reference images.'],
        ['Can I create an interior tour from room photos?', 'Yes. Interior Design accepts authorized photos and plans for still concepts or walkthroughs. Use measured dimensions or a scaled plan when proportions matter.'],
      ],
      links: [['How it works', '/how-it-works'], ['All creation modes', '/features'], ['Interior Design', '/ai-interior-design-generator'], ['Pricing', '/pricing']],
    },
  },
  '/privacy': {
    title: 'Privacy Notice | AiWebVideo',
    description:
      'Read how AiWebVideo handles account details, submitted website URLs, creative instructions, project files, and billing identifiers.',
    copy: { eyebrow: 'Privacy notice', h1: 'How AiWebVideo handles service information', intro: 'The privacy notice explains the main information processed for accounts, website capture, project files, generation, and billing.', links: [['Terms', '/terms'], ['About', '/about']] },
  },
  '/terms': {
    title: 'Terms of Service | AiWebVideo',
    description:
      'Read the AiWebVideo terms for accounts, submitted content, generated media, credits, billing, acceptable use, and availability.',
    copy: { eyebrow: 'Terms of service', h1: 'Rules for using AiWebVideo', intro: 'The terms cover account responsibilities, rights to submitted content, credits and billing, acceptable use, and service availability.', links: [['Privacy', '/privacy'], ['FAQ', '/faq']] },
  },
};

const PRIVATE_PAGES: Record<string, Omit<SeoPage, 'path' | 'index'>> = {
  '/dashboard': { title: 'Workspace | AiWebVideo', description: 'Your private AiWebVideo production workspace.' },
  '/profile': { title: 'Your Account | AiWebVideo', description: 'Manage your private AiWebVideo account, plan, and credits.' },
  '/admin': { title: 'Admin | AiWebVideo', description: 'Private AiWebVideo administration console.' },
  '/admin/reports': { title: 'Admin Reports | AiWebVideo', description: 'Private AiWebVideo financial and subscription reports.' },
  '/studio': { title: 'Studio | AiWebVideo', description: 'Your private video and image editing projects.' },
};

export const SITEMAP_PATHS = Object.freeze(Object.keys(PUBLIC_PAGES));

function normalizePath(pathname: string): string {
  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return withoutTrailingSlash || '/';
}

export function getSeoPage(pathname: string): SeoPage {
  const path = normalizePath(pathname);
  const publicPage = PUBLIC_PAGES[path];
  if (publicPage) return { title: publicPage.title, description: publicPage.description, path, index: true };
  const privatePage = PRIVATE_PAGES[path];
  if (privatePage) return { ...privatePage, path, index: false };
  if (/^\/studio\/project\/[^/]+$/.test(path)) return { path, title: 'Studio Editor | AiWebVideo', description: 'Your private video and image editing project.', index: false };
  return { path, title: 'Page Not Found | AiWebVideo', description: 'The requested AiWebVideo page could not be found.', index: false };
}

export function isKnownPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  return Boolean(PUBLIC_PAGES[path] || PRIVATE_PAGES[path] || /^\/studio\/project\/[^/]+$/.test(path));
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeText(value: string): string {
  return escapeAttribute(value).replaceAll("'", '&#39;');
}

function escapeXml(value: string): string {
  return escapeAttribute(value).replaceAll("'", '&apos;');
}

function replaceMeta(html: string, selector: 'name' | 'property', key: string, content: string): string {
  const escapedContent = escapeAttribute(content);
  const pattern = new RegExp(`<meta\\s+${selector}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${selector}="${key}" content="${escapedContent}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function buildStructuredData(page: SeoPage, publicUrl: string): string {
  const base = publicUrl.replace(/\/$/, '');
  const canonical = `${base}${page.path}`;
  const definition = PUBLIC_PAGES[page.path];
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: 'AiWebVideo', alternateName: ['AI Web Video', 'AiWebVideo.com'],
      publisher: { '@id': `${base}/#organization` },
    },
    {
      '@type': 'Organization', '@id': `${base}/#organization`, name: 'AiWebVideo', url: `${base}/`,
      logo: { '@type': 'ImageObject', url: `${base}/icon-512.png`, width: 512, height: 512 },
    },
    {
      '@type': 'SoftwareApplication', '@id': `${base}/#application`, name: 'AiWebVideo', applicationCategory: 'MultimediaApplication', operatingSystem: 'Web',
      url: `${base}/`, description: PUBLIC_PAGES['/'].description,
      featureList: [
        'Website video from a public URL', 'AI video from a prompt and optional references',
        'AI product images from real product photos', 'AI product videos from real product photos',
        'Talking and scenario-driven AI video', 'Interior design images and walkthrough videos from photos or plans',
      ],
      publisher: { '@id': `${base}/#organization` },
    },
    {
      '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: page.title, description: page.description,
      isPartOf: { '@id': `${base}/#website` }, about: { '@id': `${base}/#application` },
    },
  ];

  if (page.path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AiWebVideo', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: definition?.copy.h1 ?? page.title, item: canonical },
      ],
    });
  }

  if (definition?.copy.faq?.length) {
    graph.push({
      '@type': 'FAQPage', '@id': `${canonical}#faq`, url: canonical,
      mainEntity: definition.copy.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
}

function safePublicMediaUrl(raw: string | null, base: string): string | null {
  if (!raw) return null;
  if (raw.startsWith('/api/assets/marketing/')) return `${base}${raw}`;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function renderPublishedExamples(videos: ReadonlyArray<PublicMarketingVideo>, base: string): string {
  const figures = videos.map((video) => {
    const url = safePublicMediaUrl(video.url, base);
    if (!url) return '';
    const poster = safePublicMediaUrl(video.posterUrl, base);
    const caption = escapeText(video.caption?.trim() || video.eyebrow?.trim() || 'AiWebVideo campaign film');
    const title = escapeText(video.eyebrow?.trim() || 'Published campaign film');
    const image = poster ? `<img src="${escapeAttribute(poster)}" alt="${caption}" loading="lazy" />` : '';
    const directVideo = /\.(?:mp4|webm|mov|m4v)$/i.test(new URL(url).pathname);
    const player = directVideo
      ? `<video src="${escapeAttribute(url)}"${poster ? ` poster="${escapeAttribute(poster)}"` : ''} controls playsinline preload="none" aria-label="${caption}"></video>`
      : '';
    return `<figure>${player}<a href="${escapeAttribute(url)}">${image}<h3>${title}</h3></a><figcaption>${caption}</figcaption></figure>`;
  }).filter(Boolean).join('');
  return figures ? `<section><h2>Published campaign films</h2><p>These films are selected in AiWebVideo's public showcase. The use cases below describe workflows and are not claimed customer results.</p>${figures}</section>` : '';
}

function renderSeoSnapshot(page: SeoPage, publicUrl: string, examples: ReadonlyArray<PublicMarketingVideo>): string {
  if (!page.index) return '';
  const definition = PUBLIC_PAGES[page.path];
  if (!definition) return '';
  const copy = definition.copy;
  const sections = (copy.sections ?? []).map((section) => `<section><h2>${escapeText(section.heading)}</h2><p>${escapeText(section.body)}</p></section>`).join('');
  const publishedExamples = page.path === '/examples' ? renderPublishedExamples(examples, publicUrl.replace(/\/$/, '')) : '';
  const faq = copy.faq?.length
    ? `<section><h2>Frequently asked questions</h2>${copy.faq.map(([question, answer]) => `<article><h3>${escapeText(question)}</h3><p>${escapeText(answer)}</p></article>`).join('')}</section>`
    : '';
  const related = [...(copy.links ?? [])];
  if (FEATURE_PATHS.has(page.path)) {
    for (const [label, href] of MODE_LINKS) {
      if (href !== page.path && !related.some(([, existing]) => existing === href)) related.push([label, href]);
    }
  }
  const links = related.length
    ? `<nav aria-label="Related AiWebVideo pages"><h2>Explore AiWebVideo</h2><ul>${related.map(([label, href]) => `<li><a href="${escapeAttribute(href)}">${escapeText(label)}</a></li>`).join('')}</ul></nav>`
    : '';
  return `<div class="seo-initial" data-seo-initial="true"><div class="seo-initial__inner"><p class="seo-initial__eyebrow">${escapeText(copy.eyebrow)}</p><h1>${escapeText(copy.h1)}</h1><p class="seo-initial__intro">${escapeText(copy.intro)}</p>${sections}${publishedExamples}${faq}${links}<p class="seo-initial__cta"><a href="${definition.copy.createHref ?? "/?create=website#generate"}">Start creating with AiWebVideo</a></p></div></div>`;
}

export function renderSeoDocument(html: string, page: SeoPage, publicUrl: string, examples: ReadonlyArray<PublicMarketingVideo> = []): string {
  const canonical = `${publicUrl.replace(/\/$/, '')}${page.path}`;
  const title = escapeAttribute(page.title);
  const robots = page.index ? 'index, follow' : 'noindex, nofollow';
  const googlebot = page.index ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow';

  let rendered = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  rendered = replaceMeta(rendered, 'name', 'description', page.description);
  rendered = replaceMeta(rendered, 'name', 'robots', robots);
  rendered = replaceMeta(rendered, 'name', 'googlebot', googlebot);
  rendered = replaceMeta(rendered, 'property', 'og:title', page.title);
  rendered = replaceMeta(rendered, 'property', 'og:description', page.description);
  rendered = replaceMeta(rendered, 'property', 'og:url', canonical);
  rendered = replaceMeta(rendered, 'name', 'twitter:title', page.title);
  rendered = replaceMeta(rendered, 'name', 'twitter:description', page.description);

  if (page.path === '/examples') {
    const poster = examples.map((video) => safePublicMediaUrl(video.posterUrl, publicUrl.replace(/\/$/, ''))).find(Boolean);
    if (poster) {
      rendered = replaceMeta(rendered, 'property', 'og:image', poster);
      rendered = replaceMeta(rendered, 'name', 'twitter:image', poster);
    }
  }

  const canonicalTag = `<link rel="canonical" href="${escapeAttribute(canonical)}" />`;
  const canonicalPattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  rendered = canonicalPattern.test(rendered) ? rendered.replace(canonicalPattern, canonicalTag) : rendered.replace('</head>', `    ${canonicalTag}\n  </head>`);

  if (page.index) {
    const jsonLd = buildStructuredData(page, publicUrl);
    const structuredPattern = /<script\s+id=["']site-structured-data["'][\s\S]*?<\/script>/i;
    const structuredTag = `<script id="site-structured-data" type="application/ld+json">${jsonLd}</script>`;
    rendered = structuredPattern.test(rendered) ? rendered.replace(structuredPattern, structuredTag) : rendered.replace('</head>', `    ${structuredTag}\n  </head>`);
    const snapshot = renderSeoSnapshot(page, publicUrl, examples);
    rendered = rendered.replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`);
  } else {
    rendered = rendered.replace(/\s*<script\s+id=["']site-structured-data["'][\s\S]*?<\/script>/i, '');
  }

  return rendered;
}

export function buildRobotsTxt(publicUrl: string): string {
  const base = publicUrl.replace(/\/$/, '');
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
}

export function buildSitemapXml(publicUrl: string): string {
  const base = publicUrl.replace(/\/$/, '');
  const urls = SITEMAP_PATHS.map((pagePath) => `  <url><loc>${escapeXml(`${base}${pagePath}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function buildAiSummary(publicUrl: string): string {
  const base = publicUrl.replace(/\/$/, '');
  return `# AiWebVideo\n\nAiWebVideo creates AI videos, product images, and interior design concepts from user-provided sources. Choose the mode that matches your input and desired output. The official feature directory is ${base}/features.\n\n## Creation modes\n- Website Video: public website URL plus campaign goal to AI-directed marketing video. ${base}/website-video-generator\n- URL to Video: a public webpage or landing page as source context. ${base}/url-to-video\n- SaaS Demo Video: public SaaS site and a specific product or launch angle. ${base}/saas-demo-video-generator\n- Product Page to Video: public ecommerce page to campaign video. ${base}/product-page-to-video\n- AI Video: original prompt, optionally with image references, to generated video. ${base}/ai-video-generator\n- Product Photos: upload real product photos to create still campaign or ecommerce images. ${base}/product-photo-generator\n- Product Video: upload real product photos to create a product-focused moving film. ${base}/product-video-generator\n- Talking Video: describe characters, dialogue, setting, and camera direction to create a talking scene. ${base}/talking-video-generator\n- Interior Design: upload room or property photos, plans, sketches, or elevations and request design images or a walkthrough video. ${base}/ai-interior-design-generator\n\n## Interior design and property workflows\n- Interior Design Walkthrough: ${base}/interior-design-walkthrough-video\n- Real Estate Walkthrough: ${base}/real-estate-walkthrough-video\n- 3D-Style House Walkthrough: ${base}/3d-house-walkthrough\n- Architectural Visualization: ${base}/ai-architectural-visualization\n- Floor Plan to 3D-Style Concepts: ${base}/floor-plan-to-3d\n- Room Redesign From a Photo: ${base}/room-redesign-ai\n\n## Important distinctions\n- Use Product Page to Video for a public product URL; use Product Photos or Product Video when uploading real product images for reference.\n- Use AI Video for an original film without a website; use Talking Video when dialogue or a scenario leads the scene.\n- Interior Design can produce still concepts or a presentation walkthrough. A single photo does not establish exact dimensions; provide explicit measurements or a scaled plan when geometry matters. Generated concepts are not construction documents.\n- Credits are estimated from selected settings before paid generation. Production results depend on provided references and supported model capabilities.\n\n## More information\n- Official site: ${base}/\n- All creation modes: ${base}/features\n- How it works: ${base}/how-it-works\n- Examples and use cases: ${base}/examples\n- Pricing: ${base}/pricing\n- Frequently asked questions: ${base}/faq\n- Website video guide: ${base}/guides/turn-website-into-video\n- SaaS video guide: ${base}/guides/saas-product-demo-video\n- Product page video guide: ${base}/guides/product-page-video-ads\n- AI video prompt and dialogue guide: ${base}/guides/create-ai-video-from-prompt\n- Product photo and video reference guide: ${base}/guides/product-photos-and-videos-from-images\n- Interior design from photos and plans guide: ${base}/guides/interior-design-from-photos-and-plans\n`;
}
