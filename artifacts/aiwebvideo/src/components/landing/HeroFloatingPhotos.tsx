import { featureById } from "@/lib/creationFeatures";
import { useLandingExamples, type GalleryItem } from "@/lib/showcase";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { AutoplayVideo } from "./AutoplayVideo";

/**
 * A few photos or videos floating in the background around the chat box, each tilted differently and drifting gently.
 * An admin uploads and chooses them (Admin > Homepage > Landing photos); nothing is taken from the gallery, so with
 * none uploaded nothing is shown. They are decoration only: visitors cannot click them, they carry no controls, and
 * a video here loops silently. They live in the margins either side of the chat box (wide screens), so they never
 * cover the headline or the box.
 */
function Media({ item, eager }: { item: GalleryItem; eager: boolean }) {
  if (item.kind === "image") return <img src={item.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full object-cover" />;
  const embed = resolveVideoEmbed(item.url);
  if (embed.kind === "file") return <AutoplayVideo src={embed.src} poster={item.posterUrl} eager={eager} showBlockedControl={false} respectReducedMotion className="h-full w-full" />;
  // An external embed cannot play silently without controls: show its still picture, never a player.
  return item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/[.06]" />;
}

export function HeroFloatingPhotos() {
  const { examples } = useLandingExamples();
  if (!examples.length) return null;

  return (
    <div className="hero-floaters" aria-hidden="true">
      {examples.slice(0, 4).map((item, index) => {
        const feature = featureById(item.feature ?? "website");
        const Icon = feature.icon;
        return (
          <div key={item.id} className={`hero-floater hero-floater-${index}`}>
            <div className="hero-floater-media"><Media item={item} eager={index < 2} /></div>
            <div className="hero-floater-caption">
              <span className="hero-floater-icon"><Icon size={15} /></span>
              <span>
                <span className="hero-floater-title">{feature.label}</span>
                <span className="hero-floater-sub">{feature.description}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
