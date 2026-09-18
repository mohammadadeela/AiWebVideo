export const MARKETING_COPY = {
  hero: { eyebrow: 'WEBSITE → CAMPAIGN VIDEO', headline: 'Your website already tells the story. Turn it into a campaign.', supporting: 'Paste your URL, tell AI what you want to promote, and get a complete marketing video built around your real business.', primaryCta: 'Create my video', secondaryCta: 'See real examples' },
  analysis: { title: 'We found the story behind your website.', cta: 'Build my campaign' },
  planning: { title: 'Your campaign direction is ready.', cta: 'Generate my video' },
  paywall: { title: 'Your video is ready to create.', action: 'Get the credits I need' },
  success: { title: 'Your campaign is ready.', repeat: 'Create another version' },
} as const;

export const SMART_PROMPTS = [
  ['Product launch', 'Create a premium product launch campaign focused on the strongest product benefit and ending with a clear CTA.'],
  ['New collection', 'Create a polished campaign for the new collection, highlighting the strongest visual details and a confident CTA.'],
  ['Limited-time offer', 'Create a promotional campaign focused on the offer, urgency that is actually supported by the business, and a clear CTA.'],
  ['Brand story', 'Create a brand-focused campaign that communicates what makes this business distinct and memorable.'],
  ['SaaS demo', 'Create a professional SaaS demo video explaining the main value proposition, strongest features, and a clear CTA.'],
  ['Feature launch', 'Create a concise feature-launch campaign showing the problem, the feature, the value, and the next action.'],
  ['Social media ad', 'Create a fast, visually strong social campaign with a clear hook, product value, and direct CTA.'],
  ['How to buy', 'Create a simple product campaign that shows what the customer gets and how to take the next step.'],
  ['Restaurant promotion', 'Create a polished restaurant promotion focused on the strongest offer and customer experience.'],
  ['Real estate listing', 'Create a premium property campaign highlighting the strongest spaces, lifestyle context, and inquiry CTA.'],
  ['App promotion', 'Create a mobile app promotion showing the strongest user benefit and ending with a direct download CTA.'],
  ['LinkedIn video', 'Create a professional LinkedIn campaign with a clear business message, proof, and concise CTA.'],
] as const;