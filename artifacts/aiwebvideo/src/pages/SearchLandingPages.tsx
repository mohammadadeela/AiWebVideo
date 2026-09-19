import { ArrowRight, CheckCircle2, Film, Globe2, Layers3, Link2, Megaphone, PackageOpen, ScanSearch, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { Button } from "@/components/ui/app-button";
import { useSeo } from "@/lib/useSeo";

type SeoLanding = {
  path: string;
  eyebrow: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  primaryLabel: string;
  highlights: string[];
  problemTitle: string;
  problemBody: string;
  workflow: Array<[string, string]>;
  benefits: Array<[string, string]>;
  useCases: Array<[string, string]>;
  faq: Array<[string, string]>;
  related: Array<[string, string, string]>;
  createHref: string;
};

const pages: Record<string, SeoLanding> = {
  urlToVideo: {
    path: "/url-to-video",
    createHref: "/?create=website#generate",
    eyebrow: "URL to video AI",
    title: "Turn any website URL into an AI video",
    seoTitle: "URL to Video AI Generator — Turn a Website Into Video",
    description:
      "Paste a public website URL and turn it into a brand-aware AI marketing video. AiWebVideo reads the page, plans the story, generates the film, and keeps production in one workspace.",
    intro:
      "Paste a public URL, describe what you want to promote, and let AiWebVideo use the real page as creative context for a finished campaign video.",
    primaryLabel: "Turn a URL into video",
    highlights: ["Public URL as source", "Brand-aware creative direction", "AI-generated final film", "Landscape, portrait and square"],
    problemTitle: "A link already contains the raw material for a campaign",
    problemBody:
      "Product pages, SaaS homepages, launch pages and business websites already contain positioning, visuals, calls to action and brand cues. AiWebVideo turns that source into a production brief instead of making you rebuild it manually in a timeline editor.",
    workflow: [
      ["Paste the URL", "Use a public website, landing page, product page or homepage as the source."],
      ["Add the campaign goal", "Tell the AI what to promote, who the audience is, and what action the video should drive."],
      ["AI studies the page", "The workflow captures useful pages and visible brand context so the production is grounded in the real business."],
      ["AI directs the video", "Story, shots, pacing, duration, audio direction and format are planned around the campaign goal."],
      ["Generate and deliver", "Follow the production in the same chat, then review and download the finished media."],
    ],
    benefits: [
      ["Less manual setup", "Start from the page you already have instead of copying every headline and image into a video editor."],
      ["Closer to the brand", "The website becomes creative grounding for colors, products, interface, messaging and calls to action."],
      ["Built for campaigns", "Use the result for launches, social posts, product promotion, sales outreach and website marketing."],
      ["One production workspace", "Keep the brief, captures, plan, live progress and final media together rather than jumping between tools."],
    ],
    useCases: [
      ["SaaS landing pages", "Turn product positioning and interface context into a concise launch or demo-style campaign."],
      ["E-commerce product pages", "Use product benefits, merchandising and brand cues to direct a product-focused film."],
      ["Business websites", "Create a short promotional story for services, offers, locations and calls to action."],
      ["Launch pages", "Convert a new feature or campaign page into video content for social and paid distribution."],
    ],
    faq: [
      ["What is a URL to video generator?", "It is a workflow that uses a webpage link as source context for creating a video. AiWebVideo reads the public website, combines it with your goal, plans the campaign and generates the video."],
      ["What URLs work best?", "Public pages with clear products, services, features, visuals and calls to action work best. Private pages or pages that require login should not be submitted."],
      ["Is the result only a slideshow of screenshots?", "No. Website captures are used as creative grounding. The paid generation flow creates AI-generated video scenes for the campaign rather than presenting a simple screenshot slideshow as the final film."],
      ["Can I choose vertical or square video?", "Yes. The creator supports common landscape, portrait and square formats, with smart defaults available when you do not want to configure every setting."],
    ],
    related: [
      ["Website Video Generator", "/website-video-generator", "Build a campaign from a broader website story."],
      ["SaaS Demo Video", "/saas-demo-video-generator", "Create product and launch stories for software."],
      ["Product Page to Video", "/product-page-to-video", "Turn ecommerce and product pages into campaign video."],
    ],
  },
  websiteVideoGenerator: {
    path: "/website-video-generator",
    createHref: "/?create=website#generate",
    eyebrow: "Website video generator",
    title: "Create a marketing video from your website",
    seoTitle: "AI Website Video Generator — Website to Marketing Video",
    description:
      "Create an AI marketing video from your website. AiWebVideo studies useful pages and brand context, builds the campaign direction, and generates the final film in one workspace.",
    intro:
      "Use the website as the source of truth for the business—not just a single block of copied text—and turn it into campaign-ready video.",
    primaryLabel: "Create from my website",
    highlights: ["Website-first workflow", "Multi-page brand context", "Campaign planning", "Saved production history"],
    problemTitle: "Your website explains the business better than a blank prompt",
    problemBody:
      "A homepage rarely tells the whole story. Features, products, pricing, use cases and calls to action often live across multiple pages. The website workflow is designed to use the useful public context before the creative plan is produced.",
    workflow: [
      ["Start with the website", "Paste the public site you want AiWebVideo to understand."],
      ["Capture useful context", "The workflow gathers relevant visible pages and avoids treating every page as equally important."],
      ["Choose the campaign direction", "Describe the offer, launch, product or business story you want the video to communicate."],
      ["Generate a coherent plan", "AI builds the story beats, visual direction, duration and audio choices around that goal."],
      ["Produce the final master", "Generation progress stays visible in the project until the result is ready to review and download."],
    ],
    benefits: [
      ["More context than a prompt", "The website can ground the production in real products, interface, brand language and positioning."],
      ["Fewer production decisions", "Smart defaults keep duration, format and creative decisions from becoming a long setup form."],
      ["Useful for repeat campaigns", "Return to the workspace and create another angle from the same business context."],
      ["Clear project history", "Active and completed productions stay attached to the signed-in workspace."],
    ],
    useCases: [
      ["Launch campaign", "Turn a new website or product launch into a short branded film."],
      ["Feature promotion", "Focus the story on one feature or benefit even when the source website contains many."],
      ["Brand introduction", "Create an overview film that communicates what the business does and why it matters."],
      ["Social campaign", "Generate a format suited to channels where vertical or square video is more useful."],
    ],
    faq: [
      ["How is this different from URL to video?", "URL to video is the broad input pattern. The website-video workflow is designed specifically for turning a business website and its useful public pages into a campaign story."],
      ["Does AiWebVideo need access to private pages?", "No. Use public pages only. Do not submit private dashboards, customer data, or pages you are not authorized to use."],
      ["Can I tell it what part of the website matters?", "Yes. Your prompt can focus the production on a product, offer, feature, audience or call to action."],
      ["Can I return while generation is running?", "Yes. Signed-in project history is designed to keep active production state available when you leave and return to the workspace."],
    ],
    related: [
      ["URL to Video", "/url-to-video", "Use any public webpage as video source context."],
      ["Examples", "/examples", "See the types of campaign starts supported by the creator."],
      ["How it works", "/how-it-works", "Walk through the production flow step by step."],
    ],
  },
  saasDemo: {
    path: "/saas-demo-video-generator",
    createHref: "/?create=website#generate",
    eyebrow: "SaaS video generator",
    title: "Turn your SaaS website into a product story",
    seoTitle: "SaaS Demo Video Generator — Create Product Videos With AI",
    description:
      "Create AI SaaS demo and launch videos from your product website. Ground the story in real product positioning and interface context, then generate the campaign in one workspace.",
    intro:
      "Use your SaaS homepage, feature pages and launch messaging as context for a product-focused video without starting from a blank script.",
    primaryLabel: "Create a SaaS video",
    highlights: ["Product positioning", "Feature-page context", "Launch storytelling", "Social-ready formats"],
    problemTitle: "Software needs a story, not a screen-recording dump",
    problemBody:
      "A useful SaaS campaign has to decide what the viewer should understand first, which feature matters, and what action should follow. AiWebVideo lets the website provide product context while the prompt defines the campaign angle.",
    workflow: [
      ["Paste the SaaS website", "Start with the public product website or launch page."],
      ["Choose the audience", "Describe who the video is for: prospects, existing users, teams, founders or a specific industry."],
      ["Choose the product angle", "Focus on a launch, workflow, feature, pain point, differentiator or call to action."],
      ["AI builds the narrative", "The plan turns product context into a concise sequence rather than showing every feature at once."],
      ["Generate campaign media", "Create the final video and keep the result in the same project conversation."],
    ],
    benefits: [
      ["Launch faster", "Create a campaign direction from the site you already prepared for the release."],
      ["Keep messaging aligned", "Ground the video in the same product positioning customers see on the website."],
      ["Create multiple angles", "Use different prompts for feature launches, paid campaigns, announcements and sales outreach."],
      ["Avoid editing timelines", "Direct the result with intent and language instead of managing a traditional track-based editor."],
    ],
    useCases: [
      ["Feature launch", "Create a focused story around one new product capability."],
      ["Homepage overview", "Introduce the problem, product value and CTA in a concise campaign."],
      ["Sales outreach", "Produce a short product story that can support outbound or follow-up communication."],
      ["Social announcement", "Create a portrait or square launch asset from the same product context."],
    ],
    faq: [
      ["Is this a screen recorder?", "No. The website can provide visual and product context, but the video workflow is built around AI creative direction and generated campaign media rather than simply recording a cursor moving through the site."],
      ["Can I focus on one SaaS feature?", "Yes. Tell the creator which feature, audience, pain point or launch message matters most."],
      ["Can I use screenshots of the interface?", "The website workflow captures useful public pages as references. You can also use the creator modes that accept image references where appropriate."],
      ["Can I make another version later?", "Yes. Project history and the unified creator are designed for continued generation and new campaign directions."],
    ],
    related: [
      ["Website Video Generator", "/website-video-generator", "Use the broader website as campaign context."],
      ["URL to Video", "/url-to-video", "Turn a public link into an AI-directed video."],
      ["SaaS guide", "/guides/saas-product-demo-video", "Plan a stronger SaaS product video before generating."],
    ],
  },
  productPage: {
    path: "/product-page-to-video",
    createHref: "/?create=website#generate",
    eyebrow: "Product page to video",
    title: "Turn a product page into campaign video",
    seoTitle: "Product Page to Video AI — Ecommerce Video Generator",
    description:
      "Turn a public ecommerce product page into an AI campaign video. Use product benefits, merchandising and brand context to direct social, launch and promotional video.",
    intro:
      "Start from the product page customers already see, then direct a product-focused film around the offer, audience and campaign goal.",
    primaryLabel: "Create a product video",
    highlights: ["Product-page context", "Benefit-led story", "Product reference modes", "Campaign formats"],
    problemTitle: "Product pages contain the facts; campaigns need the angle",
    problemBody:
      "A product page may contain specifications, images, price, benefits and brand language, but a useful video still needs a hook and sequence. AiWebVideo uses the page as context and the campaign prompt to decide what should lead the story.",
    workflow: [
      ["Paste the product page", "Use a public product or collection page as the starting context."],
      ["Describe the campaign", "Choose the offer, product benefit, audience and channel you want the result to serve."],
      ["AI studies product context", "The workflow uses visible product and brand information as grounding for creative direction."],
      ["Choose the strongest sequence", "The plan prioritizes the hook, product value, proof points and final call to action."],
      ["Generate the film", "Follow production and download the finished result from the same project."],
    ],
    benefits: [
      ["Faster product campaigns", "Start from existing merchandising instead of rewriting the entire product brief."],
      ["Multiple creative angles", "Create separate versions around benefits, launches, offers, audiences or seasonal campaigns."],
      ["Reference-based product tools", "Product photo and product-video modes can use supplied real product images when you need direct reference grounding."],
      ["Channel-ready formats", "Choose landscape, portrait or square depending on where the campaign will run."],
    ],
    useCases: [
      ["New product launch", "Turn launch merchandising into a concise campaign story."],
      ["Social product ad", "Create a short benefit-led video for vertical or square distribution."],
      ["Seasonal offer", "Focus on the offer while keeping product and brand context visible to the production."],
      ["Collection promotion", "Use a collection or storefront page to direct a broader merchandising campaign."],
    ],
    faq: [
      ["Can I use a Shopify or other ecommerce page?", "You can submit a public product page that the website capture workflow can access. Results depend on the page being publicly reachable and renderable."],
      ["Does AiWebVideo preserve my exact product automatically?", "Website context helps ground the campaign, while product-reference modes are the better choice when exact supplied product imagery needs to remain central to the generation."],
      ["Can I make product photos too?", "Yes. The unified creator includes product-photo generation from supplied reference images in addition to website and product-video workflows."],
      ["Can I create several ads from one product?", "Yes. Use different prompts and formats to create new campaign angles from the same product context."],
    ],
    related: [
      ["URL to Video", "/url-to-video", "Use any public product or landing-page URL."],
      ["Product campaign guide", "/guides/product-page-video-ads", "Plan better product-page video campaigns."],
    ],
  },
  aiVideo: {
    path: "/ai-video-generator",
    createHref: "/?create=video#generate",
    eyebrow: "AI video generator",
    title: "AI Video Generator — Create Videos From Text and Images",
    seoTitle: "AI Video Generator — Create AI Videos From Prompts | AiWebVideo",
    description: "Create original AI videos from a prompt and optional image references. Direct the story, camera, style, pacing and format with AiWebVideo.",
    intro: "Describe the video you want in normal language, add references when useful, and let AiWebVideo turn the idea into a complete AI-directed video.",
    primaryLabel: "Create an AI video",
    highlights: ["Text-to-video creative direction", "Optional image references", "Landscape, portrait and square", "Campaign-ready output"],
    problemTitle: "Start with an idea instead of a blank timeline",
    problemBody: "AI video generation should understand the creative intent behind a request. Describe the subject, setting, action, mood, camera language or story and let the creator organize those decisions into a coherent production.",
    workflow: [["Describe the idea", "Explain the subject, setting, action, style, audience or story in your own words."], ["Add references", "Supply images when identity, appearance, product details or visual direction should stay grounded."], ["Direct the result", "Use duration, aspect ratio, quality and audio choices when they matter for the campaign."], ["AI plans the production", "The creator turns the brief into a coherent sequence with camera, motion, pacing and visual direction."], ["Generate the video", "Follow production in the workspace and review the finished AI video when it is ready."]],
    benefits: [["Natural-language control", "Describe the outcome instead of learning a complex timeline or prompt syntax."], ["Reference-aware", "Optional images can anchor the visual direction when the result needs a specific subject or look."], ["Multiple formats", "Create landscape, portrait or square media for different destinations."], ["Built for complete videos", "The workflow is designed around one coherent final production rather than unrelated clips."]],
    useCases: [["Social campaigns", "Create original visual concepts for vertical and square social content."], ["Brand concepts", "Explore cinematic concepts, product stories and campaign directions before production."], ["Explainer visuals", "Turn a concept or scenario into visual storytelling without recording a traditional shoot."], ["Creative testing", "Generate different visual directions around the same campaign idea."]],
    faq: [["What is an AI video generator?", "It is a tool that uses an instruction and optional references to generate video content. AiWebVideo adds creative planning so the request becomes a coherent production."], ["Can I use an image as a reference?", "Yes. Optional reference images can help anchor subjects, products, identity or visual direction."], ["Can I choose portrait video?", "Yes. The creator supports common landscape, portrait and square formats."], ["Can I make a product video instead?", "Yes. Use the dedicated Product Video page when the real product should remain the central reference."]],
    related: [["Product Video Generator", "/product-video-generator", "Create a reference-grounded product film."], ["Product Photo Generator", "/product-photo-generator", "Create campaign images from real product references."], ["Talking Video Generator", "/talking-video-generator", "Create dialogue and scenario-driven video."]],
  },
  productPhoto: {
    path: "/product-photo-generator",
    createHref: "/?create=photo#generate",
    eyebrow: "AI product photo generator",
    title: "AI Product Photo Generator — Create Product Images From References",
    seoTitle: "AI Product Photo Generator — Create Product Images | AiWebVideo",
    description: "Upload real product references and create polished AI product photos for ecommerce, campaigns, social media and marketing.",
    intro: "Give AiWebVideo your real product images and describe the scene, styling, background or campaign you want. The product remains the visual anchor.",
    primaryLabel: "Create product photos",
    highlights: ["Real product references", "Campaign image directions", "Ecommerce-ready concepts", "Multiple visual styles"],
    problemTitle: "Create new product imagery without reshooting every concept",
    problemBody: "Product marketing often needs many visual contexts: clean studio shots, lifestyle scenes, seasonal campaigns and social variations. Reference-based generation lets you start from the real product while directing the creative setting.",
    workflow: [["Upload the real product", "Add clear product images that show the shape, materials, colors and important details."], ["Describe the scene", "Ask for a studio setup, lifestyle environment, seasonal concept, campaign mood or specific composition."], ["Keep the product grounded", "The supplied reference remains the primary visual anchor rather than becoming an unrelated inspiration image."], ["Generate the image", "AiWebVideo creates the requested product-focused visual direction."], ["Create variations", "Use different prompts and compositions to build a consistent campaign set."]],
    benefits: [["Reference-first", "Start from the actual product rather than a generic text-only object."], ["More campaign variations", "Explore multiple scenes and art directions from the same source product."], ["Useful across channels", "Create visuals for ecommerce, social, ads and promotional campaigns."], ["Creative consistency", "Keep the product and visual language central while changing the environment."]],
    useCases: [["Ecommerce hero images", "Create new merchandising concepts around the same real product."], ["Lifestyle campaigns", "Place the product in a directed environment that matches the campaign."], ["Seasonal promotions", "Create visual concepts for launches, holidays and promotional periods."], ["Social content", "Generate fresh product compositions for recurring social campaigns."]],
    faq: [["Do I need to upload a product image?", "Yes. Product-photo generation is designed around supplied references when the exact product should remain central."], ["Can I request a specific background?", "Yes. Describe the environment, surface, lighting, composition and campaign mood you want."], ["Can I make a product video from the same product?", "Yes. Product Video is a separate mode designed for reference-grounded motion."], ["Are these just background replacements?", "No. The workflow can create a new campaign composition around the referenced product, subject to the capabilities of the underlying image model."]],
    related: [["Product Video Generator", "/product-video-generator", "Turn the real product into a moving commercial."], ["AI Video Generator", "/ai-video-generator", "Create original AI video from an idea."], ["Product Page to Video", "/product-page-to-video", "Start a product campaign from a public product page."]],
  },
  productVideo: {
    path: "/product-video-generator",
    createHref: "/?create=product-video#generate",
    eyebrow: "AI product video generator",
    title: "AI Product Video Generator — Create Product Videos From Real References",
    seoTitle: "AI Product Video Generator — Create Product Videos | AiWebVideo",
    description: "Create AI product videos from real product images. Preserve the product as the reference while generating commercial motion, camera movement and environments.",
    intro: "Upload the real product, describe the commercial direction, and let AiWebVideo build a continuous product-focused film around it.",
    primaryLabel: "Create a product video",
    highlights: ["Real product image references", "Commercial camera motion", "Continuous product storytelling", "Portrait, landscape and square"],
    problemTitle: "Turn a real product image into a campaign film",
    problemBody: "A product video needs to keep the item recognizable while adding useful motion, camera language, lighting and context. Reference-first production is designed to keep the supplied product central to the result.",
    workflow: [["Upload product references", "Provide clear images that show the real product and important details."], ["Describe the commercial", "Specify the audience, environment, mood, motion, benefit or campaign angle."], ["AI plans the film", "The production direction organizes camera movement, product reveals, pacing and visual continuity."], ["Generate one coherent video", "The goal is a complete product film rather than a random collection of unrelated shots."], ["Review and download", "Keep the finished media in the same workspace for review and delivery."]],
    benefits: [["Product-faithful direction", "Real references are treated as the visual anchor for the production."], ["Commercial motion", "Use camera movement, hero reveals, macro details and environments to make the product feel alive."], ["Multiple campaign angles", "Create launch, benefit, lifestyle and promotional variants from the same product."], ["Flexible formats", "Choose the format that matches your destination."]],
    useCases: [["Product launch", "Introduce a new product with a concise commercial film."], ["Paid social", "Create vertical-first product creative for social advertising."], ["Ecommerce promotion", "Show the product through motion and detail rather than a static listing image."], ["Lifestyle campaign", "Place the product in a directed environment while keeping it central."]],
    faq: [["Does it use my real product image?", "Yes. Product Video is designed around supplied product references so the real item remains the primary visual anchor."], ["Can I control the video style?", "Yes. Describe the camera, environment, mood, pacing, audience and campaign goal in the brief."], ["Can I make product photos too?", "Yes. Use Product Photos when you need still campaign imagery."], ["Can I start from a product page instead?", "Yes. Product Page to Video is the URL-based workflow for public ecommerce pages."]],
    related: [["Product Photo Generator", "/product-photo-generator", "Create still campaign images from the same kind of reference."], ["Product Page to Video", "/product-page-to-video", "Turn a public product page into campaign video."], ["AI Video Generator", "/ai-video-generator", "Create original video from a broader creative idea."]],
  },
  talkingVideo: {
    path: "/talking-video-generator",
    createHref: "/?create=scenario#generate",
    eyebrow: "AI talking video generator",
    title: "AI Talking Video Generator — Create Dialogue, Testimonials and Scenes",
    seoTitle: "AI Talking Video Generator — Create Dialogue & Scenario Videos | AiWebVideo",
    description: "Create AI talking and scenario videos from a description of the characters, dialogue, setting, camera and performance you want.",
    intro: "Describe the people, conversation, testimonial or scripted scenario and let AiWebVideo direct the performance, camera blocking, pacing and scene audio.",
    primaryLabel: "Create a talking video",
    highlights: ["Dialogue and scenarios", "Character direction", "Camera and performance", "Scene audio"],
    problemTitle: "Direct a complete scene without organizing a traditional shoot",
    problemBody: "Talking videos depend on more than words: identity, eyelines, gestures, reactions, pauses, camera blocking and audio continuity all affect whether a scene feels coherent. The scenario workflow keeps those decisions together.",
    workflow: [["Describe the scene", "Explain who is present, where they are, what happens and what the viewer should understand."], ["Write the dialogue", "Provide exact lines when wording matters, or describe the conversation when you want the system to direct it."], ["Set performance direction", "Specify tone, reactions, camera style, pacing and visual references where needed."], ["Generate the scene", "AI produces a coherent talking or scenario-driven video with the selected audio direction."], ["Review the result", "Keep the finished scene in the same project workflow for download or follow-up creation."]],
    benefits: [["Dialogue-first", "Designed around conversations, testimonials, scripted scenes and narrated situations."], ["Performance-aware", "Keep identity, eyelines, gestures, reactions and camera blocking connected."], ["Useful for marketing", "Create testimonial-style concepts, explainers, announcements and story-driven campaigns."], ["Natural-language control", "Describe the scene without learning a conventional video production interface."]],
    useCases: [["Testimonials", "Create a scenario around a customer or spokesperson-style story."], ["Product conversations", "Use dialogue to introduce a product, feature or use case."], ["Story scenes", "Create cinematic conversations and narrative moments."], ["Explainer scenarios", "Show a problem and solution through a directed interaction."]],
    faq: [["Can I provide exact dialogue?", "Yes. When exact wording is supplied, the production direction is designed to keep the spoken content faithful."], ["Can I add character references?", "Yes. Reference images can help anchor identity and visual direction where supported."], ["Can I make a normal AI video instead?", "Yes. Use the AI Video Generator for non-dialogue original concepts."], ["Does the result include audio?", "The scenario workflow supports scene audio according to the selected production settings and provider capabilities."]],
    related: [["AI Video Generator", "/ai-video-generator", "Create original non-dialogue AI video."], ["Product Video Generator", "/product-video-generator", "Create a product-focused commercial."], ["Website Video Generator", "/website-video-generator", "Create a campaign from a real website."]],
  },
  interiorDesign: {
    path: "/ai-interior-design-generator",
    createHref: "/?create=interior#generate",
    eyebrow: "AI interior design generator",
    title: "AI Interior Design Generator — Redesign Rooms, Homes and Spaces",
    seoTitle: "AI Interior Design Generator — Create Interior Design Images & Tours | AiWebVideo",
    description: "Upload room photos, plans or sketches and create AI interior design concepts, realistic redesign images and walkthrough videos with reference-aware controls.",
    intro: "Upload photos, floor plans, sketches or elevations, then describe the interior you want. AiWebVideo can create design images or a walkthrough while using your references as the visual and architectural starting point.",
    primaryLabel: "Create an interior design",
    highlights: ["Room photos and plans", "Design concept images", "Interior walkthrough video", "Reference-aware geometry"],
    problemTitle: "Turn a real space into a visual design concept",
    problemBody: "Interior design concepts need to respect the existing space. Reference photos, plans, sketches and explicit measurements provide the grounding needed to explore materials, furniture, lighting and layouts without treating a generic image as a construction drawing.",
    workflow: [["Upload the space", "Add room photos, plans, sketches, elevations or other references you are authorized to use."], ["Describe the design", "Explain the style, materials, furniture, colors, lighting, function and changes you want."], ["Add measurements when accuracy matters", "Explicit dimensions and scaled plans are authoritative when you need reliable proportions or geometry."], ["Choose the output", "Generate design images for still concepts or a walkthrough video for presenting the space."], ["Explore variations", "Try different styles, materials and furnishing directions while keeping the reference space as the starting point."]],
    benefits: [["Reference-first design", "Use real photos and plans rather than starting from an unrelated generic room."], ["Multiple outputs", "Create still interior concepts or a presentation-style walkthrough video."], ["Natural-language design", "Describe the desired look and function in normal language."], ["Architecture-aware guardrails", "The workflow is designed to preserve important existing geometry unless you explicitly ask for a change."]],
    useCases: [["Real estate presentation", "Show a potential furnishing or renovation direction for a property."], ["Home redesign", "Explore furniture, materials, colors and lighting for an existing room."], ["Retail and shops", "Visualize a store interior, display direction or customer experience."], ["Architectural concept", "Create visual concept material from plans, sketches and reference images."]],
    faq: [["Can I upload a floor plan?", "Yes. Plans and sketches can be used as references, and explicit measurements should be supplied when accurate proportions matter."], ["Can it make a walkthrough video?", "Yes. Interior Design supports design-image and walkthrough-video outputs."], ["Will a normal room photo give exact dimensions?", "No. A photo alone cannot guarantee exact measurements. Use a scaled plan or explicit dimensions when geometry must be reliable."], ["Can I use it for a real estate property?", "Yes. Real estate presentation is one practical use case for concept images and walkthrough-style media, but generated visuals should not be presented as construction-ready drawings unless separately verified by a qualified professional."]],
    related: [["Interior Design Walkthrough", "/interior-design-walkthrough-video", "Turn a design concept into a presentation walkthrough."], ["Real Estate Walkthrough", "/real-estate-walkthrough-video", "Create a property-focused presentation video."], ["3D House Walkthrough", "/3d-house-walkthrough", "Visualize a house concept in a 3D-style presentation."], ["AI Architectural Visualization", "/ai-architectural-visualization", "Create architecture-focused concept visuals."], ["Floor Plan to 3D", "/floor-plan-to-3d", "Use a floor plan as the starting reference."], ["Room Redesign AI", "/room-redesign-ai", "Redesign a room from a real photo."]],
  },
  interiorDesignWalkthrough: {
    path: "/interior-design-walkthrough-video",
    createHref: "/?create=interior#generate",
    eyebrow: "Interior design walkthrough video",
    title: "Create an AI Interior Design Walkthrough Video",
    seoTitle: "AI Interior Design Walkthrough Video Generator | AiWebVideo",
    description: "Turn room photos, plans, sketches, or design concepts into an AI interior design walkthrough video for homes, shops, and property presentations.",
    intro: "Upload the space and describe the design direction. Create a presentation-style walkthrough that follows your references instead of starting from a generic room.",
    primaryLabel: "Create a walkthrough",
    highlights: ["Room photos and plans", "Interior redesign", "Walkthrough video", "Homes, shops and properties"],
    problemTitle: "Show the proposed space, not only a still image",
    problemBody: "A walkthrough can help present a redesign direction across a room or property. Use photos, plans, sketches, and explicit dimensions when geometry matters, then describe the materials, furniture, lighting, and atmosphere you want.",
    workflow: [["Upload the space", "Add photos, plans, sketches, or elevations you are authorized to use."], ["Describe the redesign", "Tell the creator the style, materials, furniture, colors, lighting, and changes you want."], ["Ground the geometry", "Use scaled plans or explicit measurements when proportions or dimensions need to be reliable."], ["Choose walkthrough output", "Request a presentation-style tour of the designed space."], ["Review and iterate", "Use the finished result as the basis for another direction when you have credits available."]],
    benefits: [["Reference-first", "Keep the supplied space as the starting point for the design."], ["Presentation-ready", "Create a visual walkthrough for explaining a concept to clients or viewers."], ["Multiple space types", "Use the workflow for rooms, homes, retail spaces, and property concepts."], ["Natural-language direction", "Describe the design instead of learning a complex 3D tool."]],
    useCases: [["Home redesign", "Present a proposed living room, bedroom, kitchen, or whole-home direction."], ["Shop design", "Visualize a retail layout, display concept, or customer-facing interior."], ["Real estate presentation", "Show a possible furnishing or renovation direction for a property."], ["Design concept", "Create visual material from sketches, plans, and reference imagery."]],
    faq: [["Can I use a floor plan?", "Yes. Use a scaled plan or explicit measurements when accurate proportions matter."], ["Is this a construction drawing?", "No. Generated visuals are presentation concepts and should be separately verified by qualified professionals for construction or engineering use."], ["Can I create still images instead?", "Yes. Interior Design also supports design-image output."]],
    related: [["AI Interior Design Generator", "/ai-interior-design-generator", "Create still concepts or walkthroughs."], ["3D House Walkthrough", "/3d-house-walkthrough", "Create a property-focused walkthrough concept."], ["Floor Plan to 3D", "/floor-plan-to-3d", "Use plans as the starting reference for visual concepts."]],
  },
  realEstateWalkthrough: {
    path: "/real-estate-walkthrough-video",
    createHref: "/?create=interior#generate",
    eyebrow: "Real estate walkthrough video",
    title: "Create an AI Real Estate Property Walkthrough",
    seoTitle: "AI Real Estate Walkthrough Video Generator | AiWebVideo",
    description: "Create property walkthrough and presentation videos from real estate photos, plans, sketches, and interior design references.",
    intro: "Turn property references into a guided visual tour or redesign presentation. Describe the rooms, style, audience, and story you want the walkthrough to communicate.",
    primaryLabel: "Create a property walkthrough",
    highlights: ["Property photos", "Room-to-room story", "Interior redesign", "Presentation video"],
    problemTitle: "Connect separate property photos into one visual story",
    problemBody: "Real estate media often starts as a collection of room photos. A walkthrough can organize the space into a coherent presentation while keeping supplied references as the starting point.",
    workflow: [["Add property references", "Upload the photos, plans, sketches, or other authorized references."], ["Describe the property story", "Explain the rooms, audience, style, key features, and desired pacing."], ["Add design direction if needed", "Ask for furnishing or interior redesign concepts when the property needs a visual transformation."], ["Generate the walkthrough", "Create a presentation-style property tour from the project references."], ["Review the result", "Use the finished video for presentations and marketing where appropriate."]],
    benefits: [["Property-focused", "Designed around rooms, homes, apartments, shops, and other spaces."], ["Reference-aware", "Use real property imagery as the visual starting point."], ["Design plus tour", "Combine redesign concepts with a walkthrough request."], ["Flexible output", "Create still concepts or video depending on the project."]],
    useCases: [["Listing presentation", "Create a visual property story from supplied media."], ["Renovation concept", "Show a possible interior direction before work begins."], ["Commercial property", "Present shops, offices, and other spaces."], ["Client presentation", "Explain a design proposal with a guided visual sequence."]],
    faq: [["Can I upload existing listing photos?", "Yes, when you have authorization to use the images."], ["Can it guarantee the exact property dimensions?", "Use scaled plans or explicit measurements when dimensional accuracy matters; ordinary photos alone cannot guarantee it."], ["Can I redesign rooms first?", "Yes. Interior Design can create design concepts and then a walkthrough-style output."]],
    related: [["Interior Design Walkthrough", "/interior-design-walkthrough-video", "Create a design-focused walkthrough."], ["AI Interior Design Generator", "/ai-interior-design-generator", "Create interior concepts from references."], ["3D House Walkthrough", "/3d-house-walkthrough", "Explore a house-focused walkthrough workflow."]],
  },
  houseWalkthrough3d: {
    path: "/3d-house-walkthrough",
    createHref: "/?create=interior#generate",
    eyebrow: "3D house walkthrough",
    title: "Create a 3D-Style House Walkthrough With AI",
    seoTitle: "3D House Walkthrough AI Generator | AiWebVideo",
    description: "Create a 3D-style visual walkthrough concept for a house using photos, floor plans, sketches, and interior design references.",
    intro: "Start from your house references and describe the architectural and interior direction. Generate a presentation walkthrough that communicates the space and proposed design.",
    primaryLabel: "Create a house walkthrough",
    highlights: ["House photos", "Floor plans", "3D-style presentation", "Interior concepts"],
    problemTitle: "Turn plans and references into something clients can visualize",
    problemBody: "Plans and sketches communicate structure but can be difficult for non-specialists to picture. A generated walkthrough can provide presentation-oriented visual context while preserving the supplied references as the starting point.",
    workflow: [["Upload references", "Use house photos, floor plans, sketches, elevations, or design references."], ["Describe the architecture", "Specify the intended materials, style, rooms, circulation, landscaping, or interior direction."], ["Provide measurements", "Use scaled plans and explicit dimensions when geometry needs to be reliable."], ["Generate the walkthrough", "Create a 3D-style presentation sequence around the supplied concept."], ["Explore another direction", "Request another concept from the same project when you want to compare design ideas."]],
    benefits: [["Visual communication", "Help viewers understand a proposed house concept."], ["Reference grounded", "Use plans and photos instead of inventing an unrelated building."], ["Interior and exterior concepts", "Describe the areas you want presented."], ["Natural-language workflow", "Direct the presentation in ordinary language."]],
    useCases: [["New house concept", "Present a visual direction from plans or sketches."], ["Renovation", "Show a proposed redesign of an existing home."], ["Client presentation", "Create a presentation asset for discussing a concept."], ["Property marketing", "Create a visual tour concept from authorized property references."]],
    faq: [["Is the output a true CAD or BIM model?", "No. It is a generated visual presentation, not a substitute for CAD, BIM, surveying, or construction documentation."], ["Can I use a floor plan?", "Yes, and scaled plans or explicit measurements are recommended when geometry matters."], ["Can I create images instead of a walkthrough?", "Yes. Use the Interior Design image output for still concepts."]],
    related: [["Interior Design Walkthrough", "/interior-design-walkthrough-video", "Create a room and property presentation video."], ["Floor Plan to 3D", "/floor-plan-to-3d", "Start from a floor plan reference."], ["AI Architectural Visualization", "/ai-architectural-visualization", "Create architecture-focused presentation visuals."]],
  },
  architecturalVisualization: {
    path: "/ai-architectural-visualization",
    createHref: "/?create=interior#generate",
    eyebrow: "AI architectural visualization",
    title: "Create AI Architectural Visualization From Plans and References",
    seoTitle: "AI Architectural Visualization Generator | AiWebVideo",
    description: "Create architectural concept images and walkthrough-style presentations from plans, sketches, elevations, and reference photos.",
    intro: "Upload architectural references and describe the intended design. AiWebVideo can turn the concept into presentation-oriented visual material while keeping supplied references central.",
    primaryLabel: "Create architectural visuals",
    highlights: ["Plans and sketches", "Architectural concepts", "Interior and exterior", "Presentation walkthroughs"],
    problemTitle: "Make an architectural concept easier to see",
    problemBody: "Architectural drawings are precise communication tools, while visual concepts help people understand atmosphere, materials, and spatial intent. Use the two together rather than treating a generated image as technical documentation.",
    workflow: [["Upload drawings", "Add plans, sketches, elevations, or authorized reference photos."], ["Describe the intent", "Specify architecture, materials, lighting, landscape, interiors, and presentation style."], ["Anchor important geometry", "Provide scale and measurements when dimensional fidelity matters."], ["Generate visuals", "Create concept images or a walkthrough-style presentation."], ["Compare directions", "Use different briefs to explore alternative design treatments."]],
    benefits: [["Plan-aware starting point", "Use architectural references as the basis for visual exploration."], ["Material exploration", "Describe finishes, lighting, furniture, and atmosphere."], ["Presentation outputs", "Create images or walkthrough-style media for concept communication."], ["Clear limitations", "Keep generated visuals separate from construction documentation."]],
    useCases: [["Residential architecture", "Explore house and apartment design concepts."], ["Commercial spaces", "Visualize shops, offices, hospitality, and other interiors."], ["Renovation studies", "Explore proposed material and furnishing directions."], ["Client presentations", "Create visual support for explaining a design concept."]],
    faq: [["Can it replace architectural drawings?", "No. Generated visuals are presentation concepts and do not replace professional architectural, engineering, surveying, CAD, or BIM documentation."], ["Can I use a sketch?", "Yes. Sketches and plans can be supplied as visual references."], ["Can it make a walkthrough?", "Yes. The Interior Design workflow supports walkthrough-style video output."]],
    related: [["AI Interior Design Generator", "/ai-interior-design-generator", "Create room and space design concepts."], ["3D House Walkthrough", "/3d-house-walkthrough", "Create a house-focused presentation."], ["Floor Plan to 3D", "/floor-plan-to-3d", "Use floor plans as the starting reference."]],
  },
  floorPlanTo3d: {
    path: "/floor-plan-to-3d",
    createHref: "/?create=interior#generate",
    eyebrow: "Floor plan to 3D concept",
    title: "Turn a Floor Plan Into a 3D-Style Design Concept",
    seoTitle: "Floor Plan to 3D AI Generator — Visualize Floor Plans | AiWebVideo",
    description: "Use a floor plan, sketch, or architectural reference to create AI interior design images and walkthrough-style visual concepts.",
    intro: "Upload a floor plan and describe the style, materials, furniture, rooms, and presentation you want. Use dimensions and scale when accurate geometry matters.",
    primaryLabel: "Visualize a floor plan",
    highlights: ["Floor plan input", "Room visualization", "Interior concepts", "Walkthrough output"],
    problemTitle: "Give a floor plan a visual dimension",
    problemBody: "A plan shows layout from above, while a visual concept can help communicate how the rooms might look and feel. AiWebVideo uses the plan as a reference for presentation-oriented generation.",
    workflow: [["Upload the plan", "Add a clear floor plan, sketch, or other authorized architectural reference."], ["Provide scale", "Include dimensions or a scale reference when room proportions must be reliable."], ["Describe the interior", "Specify style, furniture, finishes, colors, lighting, and room function."], ["Choose images or walkthrough", "Create still concepts or a presentation-style video."], ["Review and refine", "Continue from the project with another design direction when needed."]],
    benefits: [["Plan-first", "Start from the actual layout instead of a generic room."], ["Interior visualization", "Explore materials, furniture, lighting, and atmosphere."], ["Presentation-ready", "Create images or a walkthrough for explaining the concept."], ["Natural-language control", "Describe the design without complex 3D software controls."]],
    useCases: [["Home planning", "Visualize a house or apartment layout."], ["Renovation", "Explore a proposed room arrangement and finish direction."], ["Retail planning", "Visualize a shop layout and customer-facing design."], ["Client review", "Create visual support for discussing a plan."]],
    faq: [["Will the AI infer exact dimensions from any image?", "No. Use a scaled plan or explicit dimensions when accurate geometry matters."], ["Can I make multiple room views?", "Yes. Provide the relevant references and describe the rooms you want visualized."], ["Can I create a video tour?", "Yes. The Interior Design workflow supports walkthrough-style video output."]],
    related: [["AI Architectural Visualization", "/ai-architectural-visualization", "Create architecture-focused concept visuals."], ["Room Redesign AI", "/room-redesign-ai", "Redesign an individual room from a photo."], ["Interior Design Walkthrough", "/interior-design-walkthrough-video", "Create a walkthrough-style presentation."]],
  },
  roomRedesign: {
    path: "/room-redesign-ai",
    createHref: "/?create=interior#generate",
    eyebrow: "AI room redesign",
    title: "Redesign a Room From a Photo With AI",
    seoTitle: "AI Room Redesign Generator — Redesign Any Room From a Photo | AiWebVideo",
    description: "Upload a room photo and create interior redesign concepts with new furniture, materials, colors, lighting, and style.",
    intro: "Give AiWebVideo a room photo and describe the look you want. Explore modern, luxury, minimalist, commercial, or other interior directions while keeping the room as the visual starting point.",
    primaryLabel: "Redesign my room",
    highlights: ["Room photo input", "Furniture and materials", "Style variations", "Optional walkthrough"],
    problemTitle: "Explore a new room direction before committing to it",
    problemBody: "A real room photo provides useful context for a redesign concept. Describe what should change and what should remain, and use explicit measurements or plans when spatial accuracy matters.",
    workflow: [["Upload the room", "Add a clear room photo or additional plan/reference if available."], ["Describe the desired style", "Tell the creator the furniture, materials, colors, lighting, and atmosphere you want."], ["Protect important elements", "State which walls, openings, built-ins, columns, doors, windows, or other features must remain."], ["Generate design images", "Create one or more visual concepts for the room."], ["Continue to a walkthrough", "Use the selected design direction as the basis for a presentation-style video."]],
    benefits: [["Photo-based", "Start from the actual room rather than a generic sample."], ["Style exploration", "Try different materials, furniture, colors, and lighting."], ["Element preservation", "Explicitly identify important existing features you want retained."], ["Images or video", "Move from still concepts to a walkthrough when useful."]],
    useCases: [["Living rooms", "Explore furniture layouts and finish directions."], ["Bedrooms", "Try different materials, lighting, and furnishing styles."], ["Kitchens", "Visualize cabinets, surfaces, lighting, and appliance presentation."], ["Retail interiors", "Explore customer-facing shop design concepts."]],
    faq: [["Can a photo guarantee exact room dimensions?", "No. A photo alone cannot guarantee exact measurements. Use a scaled plan or explicit dimensions when geometry matters."], ["Can I ask it to keep the windows and doors?", "Yes. State the existing elements that must remain in the request."], ["Can I turn the redesign into a video?", "Yes. Use the same Interior Design workflow for a walkthrough-style output."]],
    related: [["AI Interior Design Generator", "/ai-interior-design-generator", "Create broader interior concepts."], ["Interior Design Walkthrough", "/interior-design-walkthrough-video", "Present a finished design direction."], ["Floor Plan to 3D", "/floor-plan-to-3d", "Visualize a plan with interior concepts."]],
  },
  }; 

function SearchLandingPage({ page }: { page: SeoLanding }) {
  useSeo({ title: page.seoTitle, description: page.description, path: page.path, faq: page.faq });

  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-violet/[.12] blur-[150px]" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/[.06] px-3 py-2 font-utility text-[9px] uppercase tracking-[.18em] text-mint">
                <Sparkles size={12} /> {page.eyebrow}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.02] tracking-[-.05em] text-white sm:text-6xl lg:text-7xl">
                {page.title}
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-text-muted sm:text-lg sm:leading-8">
                {page.intro}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild><Link href={page.createHref}>{page.primaryLabel} <ArrowRight size={14} /></Link></Button>
                <Button variant="secondary" asChild><Link href="/examples">See examples</Link></Button>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {page.highlights.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-2 text-[10px] font-medium text-text-muted">
                    <CheckCircle2 size={12} className="text-mint" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <p className="font-utility text-[9px] uppercase tracking-[.18em] text-violet">Why it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-4xl">{page.problemTitle}</h2>
              <p className="mt-5 text-sm leading-7 text-text-muted sm:text-base">{page.problemBody}</p>
            </div>
            <div className="rounded-[30px] border border-white/[.08] bg-panel/80 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                {page.benefits.map(([title, body], index) => (
                  <article key={title} className="rounded-2xl border border-white/[.07] bg-black/15 p-4">
                    <span className="font-utility text-[9px] text-violet">0{index + 1}</span>
                    <h3 className="mt-3 font-display text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-5xl px-5 py-16 lg:py-20">
            <div className="text-center">
              <p className="font-utility text-[9px] uppercase tracking-[.18em] text-mint">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-4xl">From source to finished campaign</h2>
            </div>
            <div className="mt-10 space-y-3">
              {page.workflow.map(([title, body], index) => (
                <article key={title} className="grid gap-4 rounded-[24px] border border-white/[.08] bg-white/[.02] p-5 sm:grid-cols-[54px_1fr] sm:p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet/25 bg-violet/[.08] font-utility text-xs font-semibold text-violet">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {page.useCases.map(([title, body], index) => {
                const Icon = [Globe2, Film, Megaphone, Layers3][index % 4];
                return (
                  <article key={title} className="rounded-[24px] border border-white/[.08] bg-panel p-5">
                    <Icon size={18} className="text-mint" />
                    <h3 className="mt-5 font-display text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-4xl px-5 py-16 lg:py-20">
            <p className="font-utility text-[9px] uppercase tracking-[.18em] text-violet">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-white">Questions people ask before generating</h2>
            <div className="mt-8 divide-y divide-white/[.08] border-y border-white/[.08]">
              {page.faq.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none pr-8 font-display text-sm font-semibold text-white sm:text-base">{question}<span className="float-right text-violet transition group-open:rotate-45">+</span></summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-3 md:grid-cols-3">
              {page.related.map(([title, href, body]) => (
                <Link key={href} href={href} className="group rounded-[22px] border border-white/[.08] bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-violet/30">
                  <h3 className="font-display text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet">Explore <ArrowRight size={12} className="transition group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-panel px-6 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.22),transparent_52%)]" />
            <Link2 size={20} className="relative mx-auto text-mint" />
            <h2 className="relative mt-4 font-display text-3xl font-bold tracking-[-.035em] text-white">Your next video can start with one link</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-6 text-text-muted">Paste the public source, describe the campaign, and keep the production in one creative workspace.</p>
            <Button className="relative mt-6" asChild><Link href={page.createHref}>{page.primaryLabel} <ArrowRight size={14} /></Link></Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function UrlToVideoPage() {
  return <SearchLandingPage page={pages.urlToVideo} />;
}

export function WebsiteVideoGeneratorPage() {
  return <SearchLandingPage page={pages.websiteVideoGenerator} />;
}

export function SaasDemoVideoGeneratorPage() {
  return <SearchLandingPage page={pages.saasDemo} />;
}

export function ProductPageToVideoPage() {
  return <SearchLandingPage page={pages.productPage} />;
}

export function AiVideoGeneratorPage() {
  return <SearchLandingPage page={pages.aiVideo} />;
}

export function ProductPhotoGeneratorPage() {
  return <SearchLandingPage page={pages.productPhoto} />;
}

export function ProductVideoGeneratorPage() {
  return <SearchLandingPage page={pages.productVideo} />;
}

export function TalkingVideoGeneratorPage() {
  return <SearchLandingPage page={pages.talkingVideo} />;
}

export function InteriorDesignGeneratorPage() {
  return <SearchLandingPage page={pages.interiorDesign} />;
}
export function InteriorDesignWalkthroughVideoPage() { return <SearchLandingPage page={pages.interiorDesignWalkthrough} />; }
export function RealEstateWalkthroughVideoPage() { return <SearchLandingPage page={pages.realEstateWalkthrough} />; }
export function HouseWalkthrough3dPage() { return <SearchLandingPage page={pages.houseWalkthrough3d} />; }
export function ArchitecturalVisualizationPage() { return <SearchLandingPage page={pages.architecturalVisualization} />; }
export function FloorPlanTo3dPage() { return <SearchLandingPage page={pages.floorPlanTo3d} />; }
export function RoomRedesignAiPage() { return <SearchLandingPage page={pages.roomRedesign} />; }

const exampleCards = [
  ["SaaS launch", "Use the product website to ground a concise feature or launch story.", ScanSearch],
  ["Product campaign", "Use an ecommerce page or real product references to direct product-focused media.", PackageOpen],
  ["Business promotion", "Turn service positioning, offers and calls to action into a short campaign.", Megaphone],
  ["Original AI film", "Start from an idea when there is no website source to use.", Film],
] as const;

export function ExamplesPage() {
  useSeo({
    title: "AI Website Video Examples and Use Cases",
    description: "Explore AiWebVideo campaign examples and practical use cases for website-to-video, SaaS launches, ecommerce products, local businesses and original AI video.",
    path: "/examples",
  });

  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
            <p className="font-utility text-[10px] uppercase tracking-[.22em] text-mint">Examples & use cases</p>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-[-.045em] text-white sm:text-6xl">See what a website can become</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">Campaign films configured by the site owner load below. The use-case cards explain strong starting points without pretending that a generated example belongs to a customer unless it actually does.</p>
          </div>
        </section>
        <VideoShowcase />
        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-2 lg:grid-cols-4">
            {exampleCards.map(([title, body, Icon]) => (
              <article key={title} className="rounded-[24px] border border-white/[.08] bg-panel p-5">
                <Icon size={18} className="text-violet" />
                <h2 className="mt-5 font-display text-base font-semibold text-white">{title}</h2>
                <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="px-5 py-16">
          <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
            <Link href="/url-to-video" className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-display text-base font-semibold text-white">URL to video</h2><p className="mt-2 text-xs leading-6 text-text-muted">Turn a public webpage into campaign video.</p></Link>
            <Link href="/saas-demo-video-generator" className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-display text-base font-semibold text-white">SaaS product video</h2><p className="mt-2 text-xs leading-6 text-text-muted">Create launch and feature stories from a SaaS website.</p></Link>
            <Link href="/product-page-to-video" className="rounded-[22px] border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-display text-base font-semibold text-white">Product page to video</h2><p className="mt-2 text-xs leading-6 text-text-muted">Create product campaigns from ecommerce context.</p></Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
