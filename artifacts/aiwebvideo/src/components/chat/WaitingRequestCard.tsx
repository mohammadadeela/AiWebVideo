import { useEffect, useMemo } from "react";
import { FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/app-button";
import type { HandoffReason, PublicCreatorHandoff } from "@/lib/publicCreatorHandoff";

/**
 * A request the person prepared before they could run it (they were not signed in, or had too few credits).
 * Everything they made travels with it: the prompt or website address, every attachment and every setting.
 */
export interface WaitingRequest {
  handoff: PublicCreatorHandoff;
  files: File[];
  reason: HandoffReason;
  savedAt: number;
  /** Credits still missing, when the balance is too low. */
  shortfall?: number;
}

const STUDIO_LABELS: Record<string, string> = {
  product: "Product",
  idea: "AI video",
  scenario: "Talking scene",
  interior: "Interior design",
  architecture: "Architecture",
};

const WEBSITE_LABELS: Record<string, string> = {
  video: "Promo video",
  tutorial: "How to use",
  buy: "How to buy",
  tour: "Feature tour",
  linkedin: "LinkedIn video",
  demo: "Brand film",
  character: "Character story",
};

const AUDIO_LABELS: Record<string, string> = {
  voice_music: "Voice + music",
  native_audio: "Native audio",
  music_only: "Music only",
  silent: "Silent",
};

export function describeWaitingRequest(waiting: WaitingRequest) {
  const { handoff } = waiting;
  if (handoff.kind === "website") {
    const { settings } = handoff;
    return {
      title: `${WEBSITE_LABELS[settings.mode] ?? "Website video"} for ${safeHost(handoff.url) || "your website"}`,
      prompt: handoff.brief,
      url: handoff.url,
      settings: [
        settings.durationSeconds === "auto" ? "Auto length" : `${settings.durationSeconds}s`,
        settings.aspectRatio,
        settings.outputQuality.toUpperCase(),
        AUDIO_LABELS[settings.audioMode] ?? settings.audioMode,
      ],
    };
  }
  const { request } = handoff;
  const kind = STUDIO_LABELS[request.studioKind] ?? "Creation";
  return {
    title: request.mode === "photos" ? `${kind} photos` : `${kind} video`,
    prompt: request.prompt,
    url: request.productUrl,
    settings: [
      request.mode === "photos" ? "4 images" : `${request.durationSeconds}s`,
      request.aspectRatio,
      request.outputQuality.toUpperCase(),
      request.mode === "photos" ? null : AUDIO_LABELS[request.audioMode] ?? request.audioMode,
    ].filter((item): item is string => Boolean(item)),
  };
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function WaitingRequestCard({
  waiting,
  busy,
  balance,
  required,
  onStart,
  onAddCredits,
  onDiscard,
}: {
  waiting: WaitingRequest;
  busy: boolean;
  balance: number;
  required: number;
  onStart: () => void;
  onAddCredits: () => void;
  onDiscard: () => void;
}) {
  const summary = describeWaitingRequest(waiting);
  const needsCredits = required > 0 && balance < required;
  const shortfall = Math.max(0, required - balance);
  const previews = useMemo(
    () =>
      waiting.files.map((file) => ({
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [waiting.files],
  );
  useEffect(() => () => previews.forEach((item) => item.url && URL.revokeObjectURL(item.url)), [previews]);

  return (
    <section
      data-waiting-request
      aria-label="Your request is ready"
      className="space-y-3 rounded-2xl border border-violet/30 bg-[linear-gradient(180deg,rgba(139,92,246,.10),rgba(139,92,246,.04))] p-3.5 shadow-[0_18px_50px_-30px_rgba(139,92,246,.7)] sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-white">Your request is ready</p>
          <p className="mt-0.5 text-[11px] text-text-muted">{summary.title}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[.04] px-2 py-0.5 text-[10px] text-text-dim">
          {summary.settings.join(" · ")}
        </span>
      </div>

      {summary.prompt ? (
        <p className="line-clamp-6 whitespace-pre-wrap rounded-xl border border-white/[.07] bg-black/20 px-3 py-2 text-xs leading-relaxed text-text-primary">
          {summary.prompt}
        </p>
      ) : null}
      {summary.url ? (
        <p className="truncate text-[11px] text-text-muted">
          <span className="text-text-dim">Link:</span> {summary.url}
        </p>
      ) : null}

      {previews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-text-dim">
            <Paperclip size={12} /> {previews.length} attachment{previews.length === 1 ? "" : "s"}
          </span>
          {previews.map((item, index) => (
            item.url ? (
              <img
                key={`${item.file.name}-${index}`}
                src={item.url}
                alt=""
                title={item.file.name}
                className="h-12 w-12 rounded-lg border border-white/10 object-cover"
              />
            ) : (
              <span
                key={`${item.file.name}-${index}`}
                title={item.file.name}
                className="inline-flex h-12 max-w-[9rem] items-center gap-1.5 truncate rounded-lg border border-white/10 bg-white/[.04] px-2 text-[11px] text-text-muted"
              >
                <FileText size={13} className="shrink-0" />
                <span className="truncate">{item.file.name}</span>
              </span>
            )
          ))}
        </div>
      )}

      {needsCredits && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[.08] px-3 py-2 text-[11px] leading-relaxed text-amber-100">
          This production needs <strong>{required}</strong> credits and you have <strong>{balance}</strong>. Add{" "}
          <strong>{shortfall}</strong> more and it starts automatically.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {needsCredits ? (
          <Button variant="primary" size="md" onClick={onAddCredits} disabled={busy}>
            Add {shortfall} credit{shortfall === 1 ? "" : "s"} and start
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={onStart} disabled={busy}>
            {busy ? "Starting…" : "Start now"}
          </Button>
        )}
        <Button variant="ghost" size="md" onClick={onDiscard} disabled={busy}>
          Discard
        </Button>
        <span className="text-[10px] text-text-dim">Nothing is charged until the production starts.</span>
      </div>
    </section>
  );
}
