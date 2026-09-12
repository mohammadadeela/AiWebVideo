import type { AudioMode, JobMode } from '@/components/chat/types';

export type StudioKind = 'product' | 'idea' | 'scenario';

export interface StudioConfig {
  kind: StudioKind;
  path: string;
  navLabel: string;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  ideaLabel: string;
  ideaPlaceholder: string;
  ideaHelper: string;
  ideaRequired: boolean;
  photosLabel: string;
  photosHelper: string;
  photosRequired: boolean;
  /** Mode choices offered to the user. First entry is the default. */
  modeOptions: Array<{ label: string; mode: JobMode }>;
  defaultAudioMode: AudioMode;
  howItWorks: string[];
  examplePrompts: string[];
  startingCreditsNote: string;
}

export const STUDIO_CONFIGS: Record<StudioKind, StudioConfig> = {
  product: {
    kind: 'product',
    path: '/studio/product',
    navLabel: 'Product Photos & Video',
    seoTitle: 'AI Product Photo and Video Generator',
    seoDescription: 'Upload your product photos and get premium AI-generated marketing photos and a professional product video — no shoot, no studio, no editor.',
    eyebrow: 'New — AI Product Studio',
    heading: 'Turn product photos into a premium campaign',
    subheading: 'Upload your real product photos, tell us the vibe, and get back a polished marketing photo set and/or an AI-generated product video — grounded in your actual product, not generic stock.',
    ideaLabel: 'Describe the campaign you want (optional but recommended)',
    ideaPlaceholder: 'e.g. "Clean studio look on a warm beige background, confident and premium, close-up on the texture and details"',
    ideaHelper: 'Leave blank and we’ll pick a strong professional direction for you.',
    ideaRequired: false,
    photosLabel: 'Upload your product photos',
    photosHelper: 'Add 1–10 real photos of your product from different angles — these become the ground truth for every generated image and video frame.',
    photosRequired: true,
    modeOptions: [
      { label: 'Photos + video', mode: 'both' },
      { label: 'Video only', mode: 'video' },
      { label: 'Photos only', mode: 'photos' },
    ],
    defaultAudioMode: 'native_audio',
    howItWorks: [
      'Upload real photos of your product from a few angles.',
      'Tell us the mood — studio, lifestyle, seasonal, premium — or let AI decide.',
      'Get a marketing photo set and/or an AI-generated product video, ready to download.',
    ],
    examplePrompts: [
      'Premium studio shot on a dark reflective surface with soft rim lighting',
      'Warm lifestyle scene, product in use outdoors at golden hour',
      'Bold seasonal campaign with festive props and rich color grading',
    ],
    startingCreditsNote: 'Photo set from 40 credits · video from 160 credits for an 8-second premium clip',
  },
  idea: {
    kind: 'idea',
    path: '/studio/idea',
    navLabel: 'Custom Idea Video',
    seoTitle: 'AI Video Generator From a Prompt',
    seoDescription: 'Write your idea and our AI directs, storyboards, and generates a professional video from scratch — photos are optional.',
    eyebrow: 'New — AI Idea Studio',
    heading: 'Type an idea. Get a video.',
    subheading: 'No website and no screenshots required. Describe exactly what you want to see and AI generates the video directly from your idea, or add your own photos as optional visual references.',
    ideaLabel: 'Describe your video idea',
    ideaPlaceholder: 'e.g. "A sleek smartwatch floating and rotating slowly above a marble pedestal, cinematic lighting, ending on a clean brand card"',
    ideaHelper: 'Be as specific as you like — mood, setting, motion, pacing. The more detail, the more precise the result.',
    ideaRequired: true,
    photosLabel: 'Add reference photos (optional)',
    photosHelper: 'Upload photos only when you want the result to preserve a real product, place, person, or visual style. Leave this empty for direct text-to-video generation.',
    photosRequired: false,
    modeOptions: [
      { label: 'Custom idea video', mode: 'custom' },
    ],
    defaultAudioMode: 'native_audio',
    howItWorks: [
      'Write your idea in your own words — as detailed as you like.',
      'Optionally add reference photos when identity or product consistency matters.',
      'AI plans the shots and generates a true text-to-video or image-guided production.',
    ],
    examplePrompts: [
      'A pair of sneakers dropped into slow-motion splashing paint, bright studio background',
      'A cozy coffee shop morning, steam rising from a cup, soft acoustic mood',
      'A futuristic app dashboard coming to life with glowing data visualizations',
    ],
    startingCreditsNote: 'From 160 credits for an 8-second premium 1080p clip · AI narration adds 30 credits',
  },
  scenario: {
    kind: 'scenario',
    path: '/studio/scenario',
    navLabel: 'Scenario / Talking Video',
    seoTitle: 'AI Scenario Video Generator',
    seoDescription: 'Describe a scenario — two people talking, a customer testimonial, a scripted scene — and generate a real AI video with narration and dialogue.',
    eyebrow: 'New — AI Scenario Studio',
    heading: 'Describe a scene. AI brings it to life.',
    subheading: 'Two people having a conversation, a customer giving a testimonial, a narrator walking through a story — describe the scenario and AI directs the performance, dialogue, and pacing into a real generated video.',
    ideaLabel: 'Describe your scenario',
    ideaPlaceholder: 'e.g. "Two friends in a bright kitchen, one excitedly showing the other a new gadget and explaining why they love it, casual and warm conversation"',
    ideaHelper: 'Describe who is in the scene, what they’re doing or saying, and the setting. AI narration and voice are enabled by default.',
    ideaRequired: true,
    photosLabel: 'Add reference photos (optional)',
    photosHelper: 'Upload photos only when a specific person, product, or place should stay visually consistent. They are optional.',
    photosRequired: false,
    modeOptions: [
      { label: 'Scenario video', mode: 'custom' },
    ],
    defaultAudioMode: 'native_audio',
    howItWorks: [
      'Describe the scenario — who’s in it, what happens, the setting and tone.',
      'Optionally add photos of people, products, or places to ground the scene.',
      'AI generates the performance with native scene audio and natural pacing, ready to download.',
    ],
    examplePrompts: [
      'A customer unboxing a package on camera, genuinely surprised and delighted, talking to the viewer',
      'Two coworkers chatting by a window about a new productivity app, friendly and natural',
      'A narrator walking through a product’s three best features directly to camera',
    ],
    startingCreditsNote: 'From 160 credits for an 8-second premium 1080p scenario · optional AI narration adds 30 credits',
  },
};

export const STUDIO_ORDER: StudioKind[] = ['product', 'idea', 'scenario'];
