import { useMemo } from "react";
import { Box, Building2, Globe2, House, MessageCircle, type LucideIcon } from "lucide-react";
import type { ShowcaseFeature } from "@/lib/api-client";
import { useGalleryItems, type GalleryItem } from "@/lib/showcase";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { AutoplayVideo } from "./AutoplayVideo";

/**
 * Floating cards around the creator. They show what the admin uploaded for each feature (Admin > Homepage), so
 * there is nothing separate to manage: the first published item of a feature becomes that feature's card.
 * They are decorative: they never take a click, never show controls, and a video here is muted and loops
 * silently with no play button and no media icon.
 */
const SLOTS: Array<{ feature: ShowcaseFeature; slot: "a" | "b" | "c" | "d" | "e"; title: string; sub: string; Icon: LucideIcon }> = [
  { feature: "website", slot: "a", title: "Website to Video", sub: "Turn any website into a stunning video", Icon: Globe2 },
  { feature: "product-video", slot: "b", title: "Product Video", sub: "Showcase products with AI", Icon: Box },
  { feature: "interior", slot: "c", title: "Interior Design", sub: "Visualize spaces with AI", Icon: House },
  { feature: "scenario", slot: "d", title: "Talking Scene", sub: "Bring ideas to life with AI", Icon: MessageCircle },
  { feature: "architecture", slot: "e", title: "Architecture", sub: "Turn designs into cinematic videos", Icon: Building2 },
];

/** The first published item for each feature, in card order. A feature without media simply has no card. */
export function pickOrbitItems(items: GalleryItem[]) {
  return SLOTS.flatMap((slot) => {
    const item = items.find((candidate) => candidate.feature === slot.feature && Boolean(candidate.url));
    return item ? [{ ...slot, item }] : [];
  });
}

function Media({ item, eager }: { item: GalleryItem; eager: boolean }) {
  if (item.kind === "image") {
    return <img src={item.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />;
  }
  const embed = resolveVideoEmbed(item.url);
  if (embed.kind === "file") {
    return (
      <AutoplayVideo
        src={embed.src}
        poster={item.posterUrl}
        eager={eager}
        showBlockedControl={false}
        respectReducedMotion
        className="h-full w-full"
      />
    );
  }
  // An external embed cannot play silently without controls: show its still picture, never a player.
  if (item.posterUrl) return <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />;
  return <div className="h-full w-full bg-[radial-gradient(circle_at_35%_25%,rgba(139,92,246,.42),transparent_42%),linear-gradient(145deg,#17102f,#070510)]" />;
}

export function HeroMediaOrbit() {
  const { items } = useGalleryItems();
  const cards = useMemo(() => pickOrbitItems(items), [items]);
  if (!cards.length) return null;

  return (
    <div className="hero-media-orbit pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {cards.map(({ slot, item, title, sub, Icon }, index) => (
        <div key={slot} className={`hero-orbit-card hero-orbit-card-${slot}`}>
          <div className="hero-orbit-media">
            <Media item={item} eager={index < 2} />
          </div>
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
