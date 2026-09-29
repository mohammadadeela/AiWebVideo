import { Globe2 } from "lucide-react";

export function SiteIcon({ url, size = 32 }: { url?: string | null; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm" style={{ width: size, height: size }} aria-hidden="true">
      {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <Globe2 className="h-full w-full text-slate-500" />}
    </span>
  );
}
