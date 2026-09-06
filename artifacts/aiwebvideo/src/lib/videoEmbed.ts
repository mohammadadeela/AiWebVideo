// Admins can paste either a direct video file link (mp4/webm — including
// ones they just uploaded) or a YouTube/Vimeo watch link. This normalizes
// either into something the VideoShowcase component can render correctly.

export type VideoEmbed =
  | { kind: 'file'; src: string }
  | { kind: 'iframe'; src: string };

export function resolveVideoEmbed(url: string): VideoEmbed {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (youtube) {
    const id = youtube[1];
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&disablekb=1&fs=0&playsinline=1&rel=0&modestbranding=1`,
    };
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return {
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1&background=1&controls=0&title=0&byline=0&portrait=0`,
    };
  }
  return { kind: 'file', src: url };
}
