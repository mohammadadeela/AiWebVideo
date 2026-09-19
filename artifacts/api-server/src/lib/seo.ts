export interface SeoPage {
  path: string;
  title: string;
  description: string;
  index: boolean;
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

const PUBLIC_PAGES: Record<string, PublicPageDefinition> = {
  '/': {
    title: 'AI Website Video Generator — Turn Any Website Into Video | AiWebVideo',
    description:
      'Turn a website URL into a brand-aware AI marketing video. AiWebVideo reads the site, plans the campaign, generates the film, and keeps production in one workspace.',
    copy: {
      eyebrow: 'AI website video generator',
      h1: 'Turn your website into an AI-directed marketing video',
      intro:
        'Paste a public website URL, describe the campaign, and use the real site as context for an AI-generated film. AiWebVideo keeps source analysis, creative direction, live production, and final media in one workspace.',
      sections: [
        { heading: 'Website to campaign', body: 'Use public website pages, products, interface context, brand cues, and calls to action as creative grounding for the campaign.' },
        { heading: 'AI creative direction', body: 'Define the goal in normal language while the workflow plans the hook, story, shots, pacing, duration, format, and audio direction.' },
        { heading: 'One production workspace', body: 'Keep the brief, captured context, live generation state, project history, credits, and downloadable results together.' },
      ],
      faq: [
        ['Can I start from a website URL?', 'Yes. Website-to-video is the primary workflow: submit a public site and describe what the campaign should promote.'],
        ['Is AiWebVideo only a website video tool?', 'No. The same creator also supports original AI video, product media, and talking or scenario-driven video.'],
      ],
      links: [['URL to Video', '/url-to-video'], ['Website Video Generator', '/website-video-generator'], ['Examples', '/examples'], ['How it works', '/how-it-works']],
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
      links: [['URL to Video', '/url-to-video'], ['Product video guide', '/guides/product-page-video-ads'], ['Product Studio', '/studio/product'], ['Examples', '/examples']],
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
        { heading: 'Generate a coherent video', body: 'The creator turns the brief into a planned production with camera, motion, pacing, and visual direction.' },
      ],
      faq: [
        ['What is an AI video generator?', 'It is a tool that uses an instruction and optional references to generate video content. AiWebVideo adds creative planning so the request becomes a coherent production.'],
        ['Can I use an image as a reference?', 'Yes. Optional reference images can help anchor subjects, products, identity, or visual direction.'],
        ['Can I choose portrait video?', 'Yes. The creator supports common landscape, portrait, and square formats.'],
      ],
      links: [['Product Video Generator', '/product-video-generator'], ['Product Photo Generator', '/product-photo-generator'], ['Talking Video Generator', '/talking-video-generator'], ['Interior Design Generator', '/ai-interior-design-generator']],
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
        { heading: 'Generate variations', body: 'Create multiple visual directions from the same product reference for ecommerce, social, and marketing use.' },
      ],
      faq: [
        ['Do I need to upload a product image?', 'Yes. Product-photo generation is designed around supplied references when the exact product should remain central.'],
        ['Can I request a specific background?', 'Yes. Describe the environment, surface, lighting, composition, and campaign mood you want.'],
        ['Can I make a product video from the same product?', 'Yes. Product Video is a separate mode designed for reference-grounded motion.'],
      ],
      links: [['Product Video Generator', '/product-video-generator'], ['Product Page to Video', '/product-page-to-video'], ['AI Video Generator', '/ai-video-generator'], ['Interior Design Generator', '/ai-interior-design-generator']],
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
        { heading: 'Generate one coherent film', body: 'The workflow is designed around a complete product film rather than unrelated clips.' },
      ],
      faq: [
        ['Does it use my real product image?', 'Yes. Product Video is designed around supplied product references so the real item remains the primary visual anchor.'],
        ['Can I control the video style?', 'Yes. Describe the camera, environment, mood, pacing, audience, and campaign goal in the brief.'],
        ['Can I make product photos too?', 'Yes. Use Product Photos when you need still campaign imagery.'],
      ],
      links: [['Product Photo Generator', '/product-photo-generator'], ['Product Page to Video', '/product-page-to-video'], ['AI Video Generator', '/ai-video-generator'], ['Talking Video Generator', '/talking-video-generator']],
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
        { heading: 'Generate the scene', body: 'Create a coherent talking or scenario-driven video with the selected audio direction.' },
      ],
      faq: [
        ['Can I provide exact dialogue?', 'Yes. When exact wording is supplied, the production direction is designed to keep the spoken content faithful.'],
        ['Can I add character references?', 'Yes. Reference images can help anchor identity and visual direction where supported.'],
        ['Can I make a normal AI video instead?', 'Yes. Use the AI Video Generator for non-dialogue original concepts.'],
      ],
      links: [['AI Video Generator', '/ai-video-generator'], ['Product Video Generator', '/product-video-generator'], ['Website Video Generator', '/website-video-generator']],
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
        { heading: 'Choose images or a walkthrough', body: 'Generate still design concepts or a presentation-style walkthrough while keeping the reference space as the starting point.' },
      ],
      faq: [
        ['Can I upload a floor plan?', 'Yes. Plans and sketches can be used as references, and explicit measurements should be supplied when accurate proportions matter.'],
        ['Can it make a walkthrough video?', 'Yes. Interior Design supports design-image and walkthrough-video outputs.'],
        ['Will a normal room photo give exact dimensions?', 'No. A photo alone cannot guarantee exact measurements. Use a scaled plan or explicit dimensions when geometry must be reliable.'],
        ['Can I use it for real estate?', 'Yes. Real estate presentation is a practical use case for concept images and walkthrough-style media, but generated visuals should not be presented as construction-ready drawings unless separately verified by a qualified professional.'],
      ],
      links: [['AI Video Generator', '/ai-video-generator'], ['Product Photo Generator', '/product-photo-generator'], ['How it works', '/how-it-works']],
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
    title: 'AI Website Video Examples and Use Cases | AiWebVideo',
    description:
      'Explore AiWebVideo campaign examples and practical use cases for website-to-video, SaaS launches, ecommerce products, local businesses, and original AI video.',
    copy: {
      eyebrow: 'Examples and use cases',
      h1: 'See what a website can become',
      intro: 'Explore campaign films configured by the site owner and practical starting points for SaaS, ecommerce, business promotion, and original AI video.',
      sections: [
        { heading: 'SaaS launch', body: 'Use product positioning and feature context to create a concise launch or feature story.' },
        { heading: 'Product campaign', body: 'Use ecommerce context or real product references to direct product-focused campaign media.' },
        { heading: 'Business promotion', body: 'Turn service positioning, offers, and calls to action into a short marketing campaign.' },
      ],
      links: [['URL to Video', '/url-to-video'], ['SaaS Demo Video', '/saas-demo-video-generator'], ['Product Page to Video', '/product-page-to-video']],
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
      links: [['Product Page to Video', '/product-page-to-video'], ['Product Studio', '/studio/product'], ['URL to Video', '/url-to-video']],
    },
  },
  '/features': {
    title: 'Website-to-Video AI Features | AiWebVideo',
    description:
      'Explore website intelligence, AI creative direction, continuous AI video generation, live progress, smart formats, AI video, and AI photo tools.',
    copy: {
      eyebrow: 'Product features',
      h1: 'A creative director, not a control panel',
      intro: 'AiWebVideo combines website context, creative direction, generation progress, and final delivery in one workspace.',
      sections: [
        { heading: 'Website intelligence', body: 'Reads useful public pages, products, calls to action, colors, and brand identity.' },
        { heading: 'AI creative direction', body: 'Plans the hook, story beats, pacing, audio, and ending around the campaign goal.' },
        { heading: 'Professional delivery', body: 'Keeps project history, final media, downloads, and applicable failed-render credit restoration together.' },
      ],
      links: [['URL to Video', '/url-to-video'], ['How it works', '/how-it-works'], ['Pricing', '/pricing']],
    },
  },
  '/how-it-works': {
    title: 'How to Turn a Website Into an AI Video | AiWebVideo',
    description:
      'Paste a website URL, describe the promotion, let AI direct the story and duration, then download a fully AI-generated marketing video.',
    copy: {
      eyebrow: 'Workflow',
      h1: 'From one link to a finished film',
      intro: 'Paste a public website, describe the goal, let AI study the business and plan the campaign, then follow production in the same workspace.',
      sections: [
        { heading: 'Paste the website', body: 'AiWebVideo reads useful public pages, products, brand context, and calls to action.' },
        { heading: 'Review the campaign plan', body: 'AI prepares story beats, scene order, pacing, and audio direction.' },
        { heading: 'Receive the result', body: 'Review the final media, download it, or continue creating in the same conversation.' },
      ],
      links: [['URL to Video', '/url-to-video'], ['Examples', '/examples'], ['Pricing', '/pricing']],
    },
  },
  '/pricing': {
    title: 'AI Website Video Generator Pricing | AiWebVideo',
    description:
      'See credit-based pricing for AI website videos, original AI videos, and product photos, with available production quality and duration options.',
    copy: {
      eyebrow: 'Pricing',
      h1: 'Know the production cost before you generate',
      intro: 'AiWebVideo uses credits for paid generation. The creator shows the estimated production cost based on the selected mode, duration, quality, and audio choices.',
      sections: [
        { heading: 'Credits before generation', body: 'See the current production estimate before starting paid generation.' },
        { heading: 'Multiple creation modes', body: 'Website video, original AI video, product photos, product video, and scenario modes use the shared credit system.' },
      ],
      links: [['How it works', '/how-it-works'], ['URL to Video', '/url-to-video'], ['FAQ', '/faq']],
    },
  },
  '/studio': {
    title: 'AI Video and Photo Generator | AiWebVideo',
    description:
      'Create fully AI-generated videos from a prompt, realistic product photos from references, and website marketing videos from a URL.',
    copy: { eyebrow: 'AI creator', h1: 'AI video and product media in one workspace', intro: 'Start from a website, original idea, product reference, or talking-scene brief without leaving the same creative system.', links: [['AI Video', '/studio/idea'], ['Product Studio', '/studio/product'], ['Talking Scenes', '/studio/scenario']] },
  },
  '/studio/idea': {
    title: 'AI Video Generator From a Prompt | AiWebVideo',
    description:
      'Describe an original idea and generate a complete AI video with planned shots, cinematic motion, sound, and optional image references.',
    copy: { eyebrow: 'AI video generator', h1: 'Create an original AI video from an idea', intro: 'Describe the film you want, add optional references, and direct the result inside the same creative workspace.', links: [['Website Video Generator', '/website-video-generator'], ['Product Studio', '/studio/product']] },
  },
  '/studio/product': {
    title: 'AI Product Photo and Video Generator | AiWebVideo',
    description:
      'Upload real product photos and generate polished AI campaign images and product videos grounded in your references.',
    copy: { eyebrow: 'Product media', h1: 'Create product photos and product video from references', intro: 'Use supplied product images to ground campaign media when the real product needs to remain central to the creative.', links: [['Product Page to Video', '/product-page-to-video'], ['Product campaign guide', '/guides/product-page-video-ads']] },
  },
  '/studio/scenario': {
    title: 'AI Scenario Video Generator | AiWebVideo',
    description:
      'Describe a scene, dialogue, testimonial, or story and generate a complete AI video with natural pacing and scene audio.',
    copy: { eyebrow: 'Scenario video', h1: 'Direct a talking or scenario-driven AI video', intro: 'Describe the scene, dialogue, characters, and camera direction while the production remains in the same project workspace.', links: [['AI Video Generator', '/studio/idea'], ['Examples', '/examples']] },
  },
  '/about': {
    title: 'Website-to-Video AI Company | AiWebVideo',
    description:
      'Learn how AiWebVideo turns a real website and promotion goal into a brand-aware, fully AI-generated marketing video.',
    copy: { eyebrow: 'About AiWebVideo', h1: 'The website already has the story', intro: 'AiWebVideo is built to turn real public website context and a campaign goal into original AI-directed media without requiring a traditional editing workflow.', links: [['How it works', '/how-it-works'], ['Features', '/features']] },
  },
  '/faq': {
    title: 'AI Website Video Generator FAQ | AiWebVideo',
    description:
      'Answers about turning websites into videos, generating AI videos and photos, production time, formats, credits, and privacy.',
    copy: {
      eyebrow: 'Frequently asked questions',
      h1: 'Answers about website-to-video and AI production',
      intro: 'Learn how public website capture, campaign direction, generation, product references, credits, and saved projects work.',
      faq: [
        ['What is the main product?', 'Website-to-video: paste a public website and describe the promotion. AiWebVideo reads useful context, directs the story, and generates the final video.'],
        ['Can I make a video without talking?', 'Yes. Production settings include options for voice and music, music without talking, or silent output where supported by the creator.'],
        ['Can I attach real product references?', 'Yes. Product photo and product video modes accept reference images.'],
      ],
      links: [['How it works', '/how-it-works'], ['Pricing', '/pricing'], ['URL to Video', '/url-to-video']],
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
  return { path, title: 'Page Not Found | AiWebVideo', description: 'The requested AiWebVideo page could not be found.', index: false };
}

export function isKnownPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  return Boolean(PUBLIC_PAGES[path] || PRIVATE_PAGES[path]);
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
      featureList: ['Website-to-video generation from a URL', 'Website and brand context analysis', 'AI creative direction', 'AI video generation', 'Product photo and product video generation', 'Landscape, portrait, and square formats'],
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

function renderSeoSnapshot(page: SeoPage): string {
  if (!page.index) return '';
  const definition = PUBLIC_PAGES[page.path];
  if (!definition) return '';
  const copy = definition.copy;
  const sections = (copy.sections ?? []).map((section) => `<section><h2>${escapeText(section.heading)}</h2><p>${escapeText(section.body)}</p></section>`).join('');
  const faq = copy.faq?.length
    ? `<section><h2>Frequently asked questions</h2>${copy.faq.map(([question, answer]) => `<article><h3>${escapeText(question)}</h3><p>${escapeText(answer)}</p></article>`).join('')}</section>`
    : '';
  const links = copy.links?.length
    ? `<nav aria-label="Related AiWebVideo pages"><h2>Explore AiWebVideo</h2><ul>${copy.links.map(([label, href]) => `<li><a href="${escapeAttribute(href)}">${escapeText(label)}</a></li>`).join('')}</ul></nav>`
    : '';
  return `<div class="seo-initial" data-seo-initial="true"><div class="seo-initial__inner"><p class="seo-initial__eyebrow">${escapeText(copy.eyebrow)}</p><h1>${escapeText(copy.h1)}</h1><p class="seo-initial__intro">${escapeText(copy.intro)}</p>${sections}${faq}${links}<p class="seo-initial__cta"><a href="${definition.copy.createHref ?? "/?create=website#generate"}">Start creating with AiWebVideo</a></p></div></div>`;
}

export function renderSeoDocument(html: string, page: SeoPage, publicUrl: string): string {
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

  const canonicalTag = `<link rel="canonical" href="${escapeAttribute(canonical)}" />`;
  const canonicalPattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  rendered = canonicalPattern.test(rendered) ? rendered.replace(canonicalPattern, canonicalTag) : rendered.replace('</head>', `    ${canonicalTag}\n  </head>`);

  if (page.index) {
    const jsonLd = buildStructuredData(page, publicUrl);
    const structuredPattern = /<script\s+id=["']site-structured-data["'][\s\S]*?<\/script>/i;
    const structuredTag = `<script id="site-structured-data" type="application/ld+json">${jsonLd}</script>`;
    rendered = structuredPattern.test(rendered) ? rendered.replace(structuredPattern, structuredTag) : rendered.replace('</head>', `    ${structuredTag}\n  </head>`);
    const snapshot = renderSeoSnapshot(page);
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
  return `# AiWebVideo\n\nAiWebVideo is an AI website video generator. Its main workflow turns a public website URL and a campaign goal into a brand-aware AI-generated marketing video.\n\n## Core website-to-video pages\n- URL to Video: ${base}/url-to-video\n- Website Video Generator: ${base}/website-video-generator\n- SaaS Demo Video Generator: ${base}/saas-demo-video-generator\n- Product Page to Video: ${base}/product-page-to-video\n- Examples and use cases: ${base}/examples\n\n## How the website workflow works\n- Paste a public website URL.\n- Describe the product, offer, audience, or campaign to promote.\n- AiWebVideo studies useful public pages and visible brand context.\n- AI plans the story, shots, duration, pacing, sound, and format.\n- The creator generates the video and keeps production state in the project workspace.\n\n## Other creation tools\n- AI Video Generator: ${base}/ai-video-generator\n- AI Product Photo Generator: ${base}/product-photo-generator\n- AI Product Video Generator: ${base}/product-video-generator\n- AI Talking Video Generator: ${base}/talking-video-generator\n- AI Interior Design Generator: ${base}/ai-interior-design-generator\n\n## Practical guides\n- Turn a website into video: ${base}/guides/turn-website-into-video\n- SaaS product video: ${base}/guides/saas-product-demo-video\n- Product-page video campaigns: ${base}/guides/product-page-video-ads\n\nCanonical website: ${base}/\nHow it works: ${base}/how-it-works\nPricing: ${base}/pricing\n`;
}
