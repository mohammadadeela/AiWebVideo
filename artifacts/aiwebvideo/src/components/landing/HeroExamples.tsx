import { useMemo } from "react";
import { pickVariety } from "@/lib/heroMedia";
import { isSample, scrollToGenerator, startFromSample, useGalleryItems, type GalleryItem } from "@/lib/showcase";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { AutoplayVideo } from "./AutoplayVideo";

/**
 * A row of examples right under the creator, visible on the first screen. Tap one to make one like it (it opens that
 * feature with the example attached; an account is only needed when Generate is pressed). Tiles carry no text, no
 * play button and no media icon. How many show depends on the width: the rest are a scroll away in the gallery below.
 */
const MAX_TILES = 8;

function Tile({ item, eager }: { item: GalleryItem; eager: boolean }) {
  if (item.kind === "image") return <img src={item.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full object-cover" />;
  const embed = resolveVideoEmbed(item.url);
  if (embed.kind === "file") return <AutoplayVideo src={embed.src} poster={item.posterUrl} eager={eager} showBlockedControl={false} respectReducedMotion className="h-full w-full" />;
  return item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/[.06]" />;
}

export function HeroExamples() {
  const { items, loaded } = useGalleryItems();
  const tiles = useMemo(() => pickVariety(items, MAX_TILES), [items]);
  if (loaded && !tiles.length) return null;

  return (
    <div className="hero-examples chat-scroll" role="list" aria-label="Examples: tap one to make one like it">
      {tiles.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          aria-label={isSample(item) ? "Make one like this" : "Create your own"}
          onClick={() => (isSample(item) ? startFromSample(item) : scrollToGenerator())}
          className={`hero-example-tile hero-example-tile-${index}`}
        >
          <Tile item={item} eager={index < 4} />
        </button>
      ))}
    </div>
  );
}
