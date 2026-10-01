import { useMemo } from "react";
import { SHOWCASE_FEATURE_LABELS, type ShowcaseFeature } from "@/lib/api-client";
import { useGalleryItems, type GalleryItem } from "@/lib/showcase";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { AutoplayVideo } from "./AutoplayVideo";

const POSITIONS = [
  "hero-orbit-card hero-orbit-card-a",
  "hero-orbit-card hero-orbit-card-b",
  "hero-orbit-card hero-orbit-card-c",
  "hero-orbit-card hero-orbit-card-d",
  "hero-orbit-card hero-orbit-card-e",
] as const;

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

  if (item.posterUrl) {
    return <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />;
  }

  return <div className="h-full w-full bg-[radial-gradient(circle_at_35%_25%,rgba(139,92,246,.42),transparent_42%),linear-gradient(145deg,#17102f,#070510)]" />;
}

function labelFor(item: GalleryItem) {
  if (item.feature && item.feature in SHOWCASE_FEATURE_LABELS) {
    return SHOWCASE_FEATURE_LABELS[item.feature as ShowcaseFeature];
  }
  return item.caption?.trim() || "AiWebVideo creation";
}

export function HeroMediaOrbit() {
  const { items } = useGalleryItems();
  const media = useMemo(() => items.filter((item) => Boolean(item.url)).slice(0, POSITIONS.length), [items]);

  if (!media.length) return null;

  return (
    <div className="hero-media-orbit pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {media.map((item, index) => (
        <div key={item.id} className={POSITIONS[index]}>
          <div className="hero-orbit-media">
            <Media item={item} eager={index < 2} />
          </div>
          <div className="hero-orbit-caption">
            <span>{labelFor(item)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
