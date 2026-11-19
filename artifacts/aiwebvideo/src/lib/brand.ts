/**
 * The one place the product's public identity lives. Storage keys, cookies and API paths keep their
 * historical "aiwebvideo" names on purpose: renaming them would sign people out and lose their drafts.
 */
export const BRAND = {
  name: "Linkreel",
  tagline: "Paste a link. Get a video.",
  /** The name the product launched under, kept for search engines and returning customers. */
  formerName: "AiWebVideo",
  description:
    "Linkreel turns a website link, a product page, a map location or a few photos into finished videos and images. Paste a link, say what you want, and download the result.",
} as const;
