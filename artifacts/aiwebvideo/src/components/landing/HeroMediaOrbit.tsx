import { useMemo } from "react";
import { Box, Building2, Film, Globe2, House, Image as ImageIcon, MessageCircle, type LucideIcon } from "lucide-react";
import type { ShowcaseFeature } from "@/lib/api-client";
import { useGalleryItems, type GalleryItem } from "@/lib/showcase";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { AutoplayVideo } from "./AutoplayVideo";

/**
 * Floating cards in the margins either side of the creator. Each shows what the admin uploaded for that feature
 * (Admin > Homepage); a feature with nothing uploaded yet shows the "Your campaign belongs here." placeholder, so
 * the page is always full. They sit in their own columns, so they never cover the headline, the chat box or the
 * examples. They are decorative: no clicks, no controls, no play button or media icon, and videos loop silently.
 */
interface Slot { feature: ShowcaseFeature; side: "left" | "right"; title: string; sub: string; Icon: LucideIcon }

const SLOTS: readonly Slot[] = [
  { feature: "website", side: "left", title: "Website to Video", sub: "Turn any website into a stunning video", Icon: Globe2 },
  { feature: "interior", side: "left", title: "Interior Design", sub: "Visualize spaces with AI", Icon: House },
  { feature: "architecture", side: "left", title: "Architecture", sub: "Turn designs into cinematic videos", Icon: Building2 },
  { feature: "photo", side: "left", title: "Product Photos", sub: "Studio images from one photo", Icon: ImageIcon },
  { feature: "product-video", side: "right", title: "Product Video", sub: "Showcase products with AI", Icon: Box },
  { feature: "scenario", side: "right", title: "Talking Scene", sub: "Bring ideas to life with AI", Icon: MessageCircle },
  { feature: "video", side: "right", title: "AI Video", sub: "Cinematic clips from a prompt", Icon: Film },
];

/** Every slot with the first published item of its feature, or null (which shows the placeholder). */
export function orbitCards(items: readonly GalleryItem[]) {
  return SLOTS.map((slot) => ({ ...slot, item: items.find((candidate) => candidate.feature === slot.feature && Boolean(candidate.url)) ?? null }));
}

function Media({ item, eager }: { item: GalleryItem; eager: boolean }) {
  if (item.kind === "image") return <img src={item.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />;
  const embed = resolveVideoEmbed(item.url);
  if (embed.kind === "file") {
    return <AutoplayVideo src={embed.src} poster={item.posterUrl} eager={eager} showBlockedControl={false} respectReducedMotion className="h-full w-full" />;
  }
  // An external embed cannot play silently without controls: show its still picture, never a player.
  if (item.posterUrl) return <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />;
  return <Placeholder />;
}

/** The "Your campaign belongs here." screen shown until an admin uploads media for the feature. */
function Placeholder() {
  return (
    <div className="hero-orbit-placeholder">
      <div className="hero-orbit-placeholder-screen"><span>Your campaign belongs here.</span></div>
    </div>
  );
}

export function HeroSideCards({ side }: { side: "left" | "right" }) {
  const { items } = useGalleryItems();
  const cards = useMemo(() => orbitCards(items).filter((card) => card.side === side), [items, side]);
  return (
    <div className={`hero-side hero-side-${side} pointer-events-none`} aria-hidden="true">
      {cards.map(({ feature, item, title, sub, Icon }, index) => (
        <div key={feature} className={`hero-orbit-card hero-orbit-card-${side}-${index}`}>
          <div className="hero-orbit-media">{item ? <Media item={item} eager={index < 2} /> : <Placeholder />}</div>
          <div className="hero-orbit-caption">
            <span className="hero-orbit-caption-icon"><Icon size={15} /></span>
            <span>
              <span className="hero-orbit-caption-title">{title}</span>
              <span className="hero-orbit-caption-sub">{sub}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
