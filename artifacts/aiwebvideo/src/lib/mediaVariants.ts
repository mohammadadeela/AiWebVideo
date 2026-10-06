/**
 * Small copies of server pictures (see api-server/src/lib/media-variants.ts). Only our own asset links have them;
 * any other address (a blob, a data URL, another site) is returned as null so callers fall back to the original.
 */
const OWN_ASSET = /^\/api\/assets\/[^/?#]+\/[^/?#]+/;

export const PREVIEW_WIDTHS = [480, 960] as const;

function withParam(url: string, param: string): string {
  const [base, hash = ""] = url.split("#", 2);
  return `${base}${base.includes("?") ? "&" : "?"}${param}${hash ? `#${hash}` : ""}`;
}

export const hasVariants = (url: string | null | undefined): url is string => typeof url === "string" && OWN_ASSET.test(url);

/** The same picture, this many pixels wide (32 = a few hundred bytes for a blurred placeholder). */
export function imageVariant(url: string | null | undefined, width: 32 | 480 | 960): string | null {
  return hasVariants(url) ? withParam(url, `w=${width}`) : null;
}

/** The first frame of a video, as a picture the player shows before any video has arrived. */
export function videoPoster(url: string | null | undefined): string | null {
  return hasVariants(url) ? withParam(url.split("#", 1)[0], "poster=1") : null;
}

/** srcset for a grid tile: the browser picks the smallest copy that is sharp on this screen. The original is the largest. */
export function imageSrcSet(url: string | null | undefined, originalWidth = 2048): string | undefined {
  if (!hasVariants(url)) return undefined;
  return [`${imageVariant(url, 480)} 480w`, `${imageVariant(url, 960)} 960w`, `${url} ${originalWidth}w`].join(", ");
}
