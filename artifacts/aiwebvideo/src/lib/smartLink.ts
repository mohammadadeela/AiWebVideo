/**
 * The composer has ONE text box. These helpers find a link inside what was typed or pasted and decide what it
 * is, so nobody has to choose a feature or fill a separate address field first.
 */
export type LinkKind = "map" | "product" | "website";

// Bare domains ("mystore.com") are only treated as links when they end in a common ending; anything with
// http(s):// or www. always counts. This keeps "v2.final" or "logo.png" in the text where they belong.
const COMMON_ENDINGS =
  "com|net|org|io|co|ai|app|dev|shop|store|me|info|biz|xyz|online|site|tech|studio|agency|design|tv|uk|us|ca|au|de|fr|es|it|nl|se|no|dk|pl|tr|ae|sa|qa|kw|bh|om|eg|jo|ps|lb|ma|in|pk|id|my|sg|jp|kr|cn|br|mx|ru|ua|ch|at|be|pt|ie|nz|za|gr";

const LINK_IN_TEXT = new RegExp(
  `(?:^|\\s)((?:https?:\\/\\/|www\\.)[^\\s]+|(?:[a-z0-9-]+\\.)+(?:${COMMON_ENDINGS})(?:\\/[^\\s]*)?)(?=\\s|$)`,
  "i",
);

export interface FoundLink {
  link: string;
  /** The text with the link taken out. */
  rest: string;
}

/**
 * The first link in the text. While someone is still typing, pass `allowAtEnd = false`: a link that is the
 * very last thing in the box may not be finished yet, so it is left alone until a space follows it.
 */
export function findLinkInText(text: string, allowAtEnd: boolean): FoundLink | null {
  const match = LINK_IN_TEXT.exec(text);
  if (!match) return null;
  const raw = match[1];
  const start = match.index + match[0].indexOf(raw);
  const end = start + raw.length;
  if (!allowAtEnd && end >= text.length) return null;
  const link = raw.replace(/[),.;!?]+$/, "");
  if (!link) return null;
  const rest = `${text.slice(0, start)} ${text.slice(end)}`.replace(/[ \t]{2,}/g, " ").trim();
  return { link, rest };
}

const MAP_HOSTS = /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|openstreetmap\.org|bing\.com\/maps)/;
const SHOP_HOSTS = /(?:^|\/\/|\.)(amazon|ebay|etsy|aliexpress|alibaba|walmart|temu|shein|noon|bestbuy|zalando|trendyol)\.[a-z.]+\/./;
const PRODUCT_PATH = /\/(products?|dp|gp\/product|itm|item|listing)\/[^/?#]+/;
const PRODUCT_QUERY = /[?&](product_id|productid|sku|variant)=/;

/** A map location, one product's page, or (everything else) a website. */
export function classifyLink(link: string): LinkKind {
  const value = link.trim().toLowerCase();
  if (MAP_HOSTS.test(value)) return "map";
  if (SHOP_HOSTS.test(value) || PRODUCT_PATH.test(value) || PRODUCT_QUERY.test(value)) return "product";
  return "website";
}

/** "https://www.shop.example.com/a/b" -> "shop.example.com" (what the chip shows). */
export function linkHost(link: string): string {
  try {
    return new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.replace(/^www\./i, "");
  } catch {
    return link.replace(/^https?:\/\//i, "").split("/")[0] ?? link;
  }
}
