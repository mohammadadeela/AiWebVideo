import { useRef } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/app-button";
import { SHOWCASE_FEATURE_LABELS, uploadMarketingAsset, type MarketingVideo, type ShowcaseFeature } from "@/lib/api-client";

/** How many photos or videos can sit in the row under the chat box (matches the server). */
export const MAX_LANDING_EXAMPLES = 6;
const FEATURES = Object.keys(SHOWCASE_FEATURE_LABELS) as ShowcaseFeature[];

/**
 * The few photos/videos shown right under the chat box on the home page. They are uploaded HERE, for that place,
 * and are never taken from the gallery. Each one is filed under a feature, which is what opens when a visitor taps it.
 */
export function LandingExamplesManager({
  examples, onChange, busy, setBusy, setMessage,
}: {
  examples: MarketingVideo[];
  onChange: (next: MarketingVideo[]) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setMessage: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const items = examples.filter((item) => item.url);
  const room = MAX_LANDING_EXAMPLES - items.length;

  async function upload(files: File[]) {
    const accepted = files.filter((file) => /^(image|video)\//.test(file.type)).slice(0, Math.max(0, room));
    if (!accepted.length) { setMessage(room <= 0 ? `The row already has the maximum of ${MAX_LANDING_EXAMPLES}.` : "Choose image or video files."); return; }
    setBusy(true);
    const added: MarketingVideo[] = [];
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        setMessage(`Uploading ${index + 1} of ${accepted.length}…`);
        const uploaded = await uploadMarketingAsset(accepted[index]);
        added.push({ id: `landing-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`, url: uploaded.url, posterUrl: uploaded.posterUrl ?? null, kind: uploaded.kind, feature: null, caption: null, overlayText: null, eyebrow: null });
      }
      setMessage(`${added.length} uploaded. Choose a feature for each one, then save.`);
    } catch (error) {
      setMessage(`${added.length} uploaded before an error: ${error instanceof Error ? error.message : "Upload failed."}`);
    } finally {
      if (added.length) onChange([...items, ...added]);
      setBusy(false);
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-violet/25 bg-[#120e26] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Landing examples</p>
          <p className="mt-0.5 text-xs text-text-muted">The photos under the chat box on the home page. Only what you upload here is shown there.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-text-muted">{items.length} of {MAX_LANDING_EXAMPLES}</span>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/*" multiple hidden onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <Button disabled={busy || room <= 0} onClick={() => input.current?.click()}><Upload size={15} /> Upload</Button>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Landing examples">
          {items.map((item, index) => (
            <li key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0919]">
              <div className="aspect-[4/3] bg-black">
                {(item.kind ?? "video") === "image"
                  ? <img src={item.url ?? ""} alt="" className="h-full w-full object-cover" />
                  : <video src={item.url ?? ""} poster={item.posterUrl ?? undefined} muted loop autoPlay playsInline className="h-full w-full object-cover" />}
              </div>
              <div className="space-y-2 p-2">
                <select
                  aria-label="Feature"
                  value={item.feature ?? ""}
                  onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, feature: (event.target.value || null) as ShowcaseFeature | null } : entry))}
                  className={`min-h-9 w-full rounded-lg border bg-[#100c20] px-2 text-xs text-white ${item.feature ? "border-white/10" : "border-amber-300/60"}`}
                >
                  <option value="">Choose a feature</option>
                  {FEATURES.map((feature) => <option key={feature} value={feature}>{SHOWCASE_FEATURE_LABELS[feature]}</option>)}
                </select>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move left" className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.06] text-white disabled:opacity-30"><ArrowLeft size={14} /></button>
                    <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="Move right" className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.06] text-white disabled:opacity-30"><ArrowRight size={14} /></button>
                  </div>
                  <button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.06] text-pink-300 hover:bg-pink-500/20"><Trash2 size={14} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
