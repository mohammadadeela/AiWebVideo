import { useEffect, useRef, useState, type CSSProperties } from "react";
import { hasVariants, imageSrcSet, imageVariant } from "@/lib/mediaVariants";

/**
 * A picture that never shows an empty box. In order:
 *  1. at once: a soft gradient, then the tiny blurred copy (a few hundred bytes) filling the whole frame,
 *  2. a right-sized copy of the picture fades in over it (not the 4K master, unless full quality is asked for),
 *  3. if the picture cannot be loaded, a quiet "Try again" instead of a broken icon.
 * The frame keeps its shape from the first paint, so nothing jumps when the picture arrives.
 */
export function ProgressiveImage({
  src,
  alt,
  className = "",
  imgClassName = "object-cover",
  sizes = "(min-width: 640px) 50vw, 100vw",
  priority = false,
  full = false,
  style,
  onClick,
}: {
  src: string;
  alt: string;
  /** Classes for the frame (set its aspect ratio or height here). */
  className?: string;
  /** Classes for the picture itself (object-cover or object-contain). */
  imgClassName?: string;
  sizes?: string;
  /** Above the fold: fetched first. */
  priority?: boolean;
  /** Use the original rather than a smaller copy (the full-size viewer). */
  full?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tinyFailed, setTinyFailed] = useState(false);
  // If a smaller copy cannot be served for any reason, the original is used: the picture must never depend on its preview.
  const [originalOnly, setOriginalOnly] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const tiny = imageVariant(src, 32);

  useEffect(() => { setLoaded(false); setFailed(false); setTinyFailed(false); }, [src, attempt]);
  useEffect(() => { setOriginalOnly(false); }, [src]);
  // A picture already in the browser cache can finish before React attaches onLoad.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [src, attempt]);

  const retryUrl = attempt ? `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}` : src;
  const smaller = !full && !originalOnly && hasVariants(src);

  return (
    <div
      className={`relative isolate overflow-hidden bg-[linear-gradient(145deg,#1b1533,#0b0912)] ${className}`}
      style={style}
      onClick={onClick}
      data-loaded={loaded ? "true" : "false"}
    >
      {tiny && !tinyFailed && (
        <img
          src={tiny}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          onError={() => setTinyFailed(true)}
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          style={{ opacity: loaded ? 0 : 1, transition: "opacity 450ms ease-out" }}
        />
      )}
      {!loaded && !failed && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-white/[.03]" />}
      {!failed && (
        <img
          ref={imageRef}
          src={smaller ? imageVariant(retryUrl, 960) ?? retryUrl : retryUrl}
          srcSet={smaller ? imageSrcSet(retryUrl) : undefined}
          sizes={smaller ? sizes : undefined}
          alt={alt}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={() => { if (smaller) setOriginalOnly(true); else setFailed(true); }}
          className={`relative h-full w-full ${imgClassName}`}
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 450ms ease-out" }}
        />
      )}
      {failed && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setAttempt((n) => n + 1); }}
          className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-white/70 hover:text-white"
        >
          Couldn&apos;t load this picture. Try again
        </button>
      )}
    </div>
  );
}
