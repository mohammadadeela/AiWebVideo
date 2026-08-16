// Admins can paste either a direct video file link (mp4/webm — including
// ones they just uploaded) or a YouTube/Vimeo watch link. This normalizes
// either into something the VideoShowcase component can render correctly.

export type VideoEmbed =
  | { kind: 'file'; src: string }
  | { kind: 'iframe'; src: string };

export function resolveVideoEmbed(url: string): VideoEmbed {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (youtube) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}?autoplay=0&rel=0&modestbranding=1` };
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }
  return { kind: 'file', src: url };
}
