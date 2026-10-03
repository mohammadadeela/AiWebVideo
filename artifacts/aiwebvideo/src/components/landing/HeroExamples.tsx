import { isSample, scrollToGenerator, startFromSample, useLandingExamples, type GalleryItem } from "@/lib/showcase";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { AutoplayVideo } from "./AutoplayVideo";

/**
 * The examples right under the creator. They are the photos and videos an admin uploaded FOR this spot (Admin >
 * Homepage > Landing examples); nothing is borrowed from the gallery, so with none uploaded nothing is shown.
 * Tap one to make one like it: its feature opens in the box with the example attached, and an account is only
 * needed when Generate is pressed. Tiles carry no text, no play button and no media icon.
 */
function Tile({ item, eager }: { item: GalleryItem; eager: boolean }) {
  if (item.kind === "image") return <img src={item.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full object-cover" />;
  const embed = resolveVideoEmbed(item.url);
  if (embed.kind === "file") return <AutoplayVideo src={embed.src} poster={item.posterUrl} eager={eager} showBlockedControl={false} respectReducedMotion className="h-full w-full" />;
  return item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/[.06]" />;
}

export function HeroExamples() {
  const { examples } = useLandingExamples();
  if (!examples.length) return null;

  return (
    <div className="hero-examples chat-scroll" role="list" aria-label="Examples: tap one to make one like it" data-count={examples.length}>
      {examples.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          aria-label="Make one like this"
          onClick={() => (isSample(item) ? startFromSample(item) : scrollToGenerator())}
          className="hero-example-tile"
        >
          <Tile item={item} eager={index < 4} />
        </button>
      ))}
    </div>
  );
}
