// Route real image generation through the proven legacy creative implementation
// while keeping current import compatibility for the rest of the application.
export * from "./imagen-legacy.js";

export function imageModelName() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
}
