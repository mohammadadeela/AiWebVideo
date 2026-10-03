import { useState } from "react";
import { Check, Copy, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/app-button";
import { checkAdminLink, type LinkCheckResult } from "@/lib/api-client";
import { mapPreviewUrl } from "@/lib/mapPreview";

/**
 * Paste a product link or a map link and see exactly what the server makes of it: every step it took, the photos
 * or the point it found, and why it stopped. "Copy report" puts it all in one block that can be sent for diagnosis.
 */
export function LinkChecker() {
  const [kind, setKind] = useState<"product" | "map">("product");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<LinkCheckResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!link.trim() || busy) return;
    setBusy(true); setFailure(null); setOutcome(null); setCopied(false);
    try { setOutcome(await checkAdminLink(kind, link.trim())); }
    catch (error) { setFailure(error instanceof Error ? error.message : "The check could not run."); }
    finally { setBusy(false); }
  }

  async function copyReport() {
    if (!outcome) return;
    const lines = [
      `Link check (${outcome.kind}) — ${outcome.ok ? "OK" : "FAILED"} in ${outcome.ms} ms`,
      `Link: ${link.trim()}`,
      outcome.error ? `Error: ${outcome.error}${outcome.code ? ` [${outcome.code}]` : ""}` : "",
      "Steps:", ...outcome.trace.map((line) => `  ${line}`),
      outcome.result ? `Result: ${JSON.stringify(outcome.result)}` : "",
    ].filter(Boolean);
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); } catch { setCopied(false); }
  }

  const result = outcome?.result;
  return (
    <div className="rounded-2xl border border-violet/25 bg-[#120e26] p-4">
      <p className="text-sm font-semibold text-white">Link checker</p>
      <p className="mt-0.5 text-xs text-text-muted">Paste a product link or a map link to see exactly what the server finds, step by step.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <div role="tablist" aria-label="Link type" className="flex gap-1 rounded-xl bg-white/[.05] p-1">
          {(["product", "map"] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => { setKind(value); setOutcome(null); }}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${kind === value ? "bg-white text-[#1b1030]" : "text-white/60 hover:text-white"}`}>
              {value === "product" ? "Product link" : "Map link"}
            </button>
          ))}
        </div>
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void run(); }}
          placeholder={kind === "product" ? "https://shop.example.com/product/…" : "https://maps.app.goo.gl/… or 31.5321, 35.0912"}
          aria-label="Link to check"
          className="min-h-10 min-w-[240px] flex-1 rounded-xl border border-white/10 bg-[#0b0919] px-3 text-sm text-white placeholder:text-text-dim"
        />
        <Button disabled={busy || !link.trim()} onClick={() => void run()}><Search size={15} /> {busy ? "Checking…" : "Check"}</Button>
      </div>

      {failure && <p className="mt-3 flex items-center gap-2 text-xs text-pink-300"><TriangleAlert size={14} /> {failure}</p>}

      {outcome && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`flex items-center gap-2 text-sm font-semibold ${outcome.ok ? "text-mint" : "text-pink-300"}`}>
              {outcome.ok ? <Check size={15} /> : <TriangleAlert size={15} />}
              {outcome.ok ? "Found" : "Not found"} <span className="font-normal text-text-muted">in {outcome.ms} ms{outcome.code ? ` · ${outcome.code}` : ""}</span>
            </p>
            <button type="button" onClick={() => void copyReport()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/[.06] px-3 text-xs font-semibold text-white hover:bg-white/10">
              <Copy size={13} /> {copied ? "Copied" : "Copy report"}
            </button>
          </div>
          {outcome.error && <p className="text-xs text-pink-200">{outcome.error}</p>}

          <ol className="space-y-1 rounded-xl bg-[#0b0919] p-3 text-xs text-text-muted" aria-label="Steps">
            {outcome.trace.map((line, index) => <li key={index} className="font-mono leading-5">{line}</li>)}
            {!outcome.trace.length && <li>No steps recorded.</li>}
          </ol>

          {outcome.kind === "product" && result && (
            <div>
              <p className="text-xs text-text-muted"><span className="font-semibold text-white">{result.title || "(no title)"}</span> · found by: {result.source}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {(result.images ?? []).map((src, index) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/10 bg-black">
                    <img src={src} alt={`Photo ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
                  </a>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-dim">{(result.images ?? []).length} photo(s). Only the product's own photos should be here; anything else is the bug to report.</p>
            </div>
          )}

          {outcome.kind === "map" && result && typeof result.latitude === "number" && typeof result.longitude === "number" && (
            <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
              <dl className="space-y-1 text-xs text-text-muted">
                <div><dt className="inline font-semibold text-white">Point: </dt><dd className="inline font-mono">{result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}</dd></div>
                <div><dt className="inline font-semibold text-white">Precision: </dt><dd className="inline">{result.precision === "pin" ? "pin (the place itself)" : "view (only where the map was centred, ask for the pin)"}</dd></div>
                <div><dt className="inline font-semibold text-white">Place: </dt><dd className="inline">{result.label || "(none)"}</dd></div>
                <div><dt className="inline font-semibold text-white">Imagery: </dt><dd className="inline">{result.imagery}</dd></div>
              </dl>
              <iframe title="Map preview" src={mapPreviewUrl(result.latitude, result.longitude)} loading="lazy" referrerPolicy="no-referrer" className="h-48 w-full rounded-xl border border-white/10" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
