import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  Film,
  House,
  Image as ImageIcon,
  Languages,
  Mic,
  Music,
  Volume2,
  VolumeX,
} from "lucide-react";
import { displayCredits } from "@/lib/credits";
import type { PublicModelCard, PublicModelId } from "@/lib/generationModels";
import { NumberStepper } from "@/components/ui/number-stepper";
import type { AudioMode } from "./types";

type Ratio = "16:9" | "9:16" | "1:1";
type Quality = "1080p" | "4k";

export interface OutputSettingsValue {
  modelId: PublicModelId;
  durationSeconds: number | "auto";
  aspectRatio: Ratio;
  outputQuality: Quality;
  audioMode: AudioMode;
  narrationLanguage: string;
}

const DURATION_PRESETS = [8, 16, 24, 32, 48, 60] as const;

const RATIOS: Array<{ value: Ratio; label: string; helper: string; w: number; h: number }> = [
  { value: "9:16", label: "9:16", helper: "Portrait", w: 12, h: 20 },
  { value: "16:9", label: "16:9", helper: "Landscape", w: 22, h: 13 },
  { value: "1:1", label: "1:1", helper: "Square", w: 16, h: 16 },
];

const AUDIO_META: Record<AudioMode, { label: string; helper: string; icon: ReactNode }> = {
  native_audio: { label: "Sound", helper: "Scene audio", icon: <Volume2 size={15} /> },
  voice_music: { label: "Narration", helper: "Voice + music", icon: <Mic size={15} /> },
  music_only: { label: "Music", helper: "Soundtrack", icon: <Music size={15} /> },
  silent: { label: "Silent", helper: "No audio", icon: <VolumeX size={15} /> },
};

/** 4K / HD badge — a proper glyph instead of a generic sparkle. */
export function QualityGlyph({ quality, size = 20 }: { quality: Quality; size?: number }) {
  const is4k = quality === "4k";
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-[7px] font-black leading-none tracking-tight ${
        is4k
          ? "bg-gradient-to-br from-gold via-pink to-violet text-[#1b1030] shadow-[0_4px_14px_-4px_rgba(236,72,153,.7)]"
          : "border border-white/20 bg-white/[.08] text-white/75"
      }`}
      style={{ height: size, minWidth: Math.round(size * 1.5), fontSize: Math.round(size * 0.48) }}
    >
      {is4k ? "4K" : "HD"}
    </span>
  );
}

function tierOf(model: PublicModelCard) {
  return model.id.endsWith("pro") ? 3 : model.id.endsWith("-2") ? 2 : 1;
}

function shortName(model: PublicModelCard) {
  return model.name.replace(/^AiWebVideo\s+/, "");
}

const FAMILY_LABEL = { video: "Video model", image: "Image model", interior: "Space model" } as const;
const FAMILY_TINT = {
  video: "from-violet to-pink",
  image: "from-mint to-violet",
  interior: "from-gold to-pink",
} as const;

function FamilyIcon({ family, size = 15 }: { family: PublicModelCard["family"]; size?: number }) {
  return family === "video" ? <Film size={size} /> : family === "interior" ? <House size={size} /> : <ImageIcon size={size} />;
}

function ModelGlyph({ model, size = 32 }: { model: PublicModelCard; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)] ${FAMILY_TINT[model.family]}`}
      style={{ height: size, width: size }}
    >
      <FamilyIcon family={model.family} size={Math.round(size * 0.5)} />
    </span>
  );
}

function TierBars({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-label={`Tier ${level} of 3`} role="img">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`w-[4px] rounded-full ${bar <= level ? "bg-white/85" : "bg-white/15"}`}
          style={{ height: 5 + bar * 3 }}
        />
      ))}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-4 text-[11px] font-semibold text-white/50 first:mt-0">{children}</p>;
}

export function OutputSettings({
  value,
  models,
  selectedModel,
  disabled = false,
  onModel,
  onDuration,
  onAspect,
  onQuality,
  onAudio,
  onLanguage,
  languages,
}: {
  value: OutputSettingsValue;
  models: PublicModelCard[];
  selectedModel: PublicModelCard;
  disabled?: boolean;
  onModel: (id: PublicModelId) => void;
  onDuration: (seconds: number) => void;
  onAspect: (ratio: Ratio) => void;
  onQuality: (quality: Quality) => void;
  onAudio: (mode: AudioMode) => void;
  onLanguage: (code: string) => void;
  languages: ReadonlyArray<readonly [string, string]>;
}) {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const shakeTimer = useRef<number | null>(null);

  const duration = value.durationSeconds === "auto" ? 8 : value.durationSeconds;
  const [durationText, setDurationText] = useState(String(duration));
  useEffect(() => setDurationText(String(duration)), [duration]);
  useEffect(() => () => { if (shakeTimer.current) window.clearTimeout(shakeTimer.current); }, []);

  const quality: Quality = selectedModel.supportedQualities.includes(value.outputQuality)
    ? value.outputQuality
    : (selectedModel.supportedQualities[0] ?? "1080p");
  const ratio = RATIOS.find((item) => item.value === value.aspectRatio) ?? RATIOS[0];
  const audioModes = selectedModel.audioModes;
  const audio = AUDIO_META[value.audioMode] ?? AUDIO_META.silent;
  const narration = value.audioMode === "voice_music";
  const languageLabel = value.narrationLanguage === "auto"
    ? "Auto"
    : (languages.find(([code]) => code === value.narrationLanguage)?.[1] ?? value.narrationLanguage.toUpperCase());

  function chooseAudio(mode: AudioMode) {
    onAudio(mode);
    if (mode === "voice_music") {
      // Keep the panel open and make the language row impossible to miss.
      setShaking(false);
      window.requestAnimationFrame(() => {
        setShaking(true);
        languageRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShaking(false), 1500);
    } else {
      setShaking(false);
    }
  }

  const modelPrice = (model: PublicModelCard) => {
    const effective = model.supportedQualities.includes(quality) ? quality : (model.supportedQualities[0] ?? "1080p");
    const base = model.family === "video"
      ? (effective === "4k" ? (model.internalCredits4k ?? model.internalCredits1080p ?? 1) : (model.internalCredits1080p ?? 1))
      : (effective === "4k" ? (model.internalCredits4k ?? model.internalCreditsPerImage ?? 1) : (model.internalCreditsPerImage ?? 1));
    return displayCredits(base);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Output settings: ${shortName(selectedModel)}`}
          className={`group inline-flex h-11 min-w-0 max-w-full items-center gap-2 rounded-2xl border pl-1.5 pr-3 text-left transition active:scale-[.99] sm:h-10 ${
            open ? "border-violet/60 bg-violet/[.12]" : "border-white/10 bg-white/[.05] hover:border-white/25 hover:bg-white/[.08]"
          } ${narration && shaking ? "attention-shake" : ""}`}
        >
          <ModelGlyph model={selectedModel} size={30} />
          <span className="min-w-0 truncate text-[12px] font-semibold text-white">{shortName(selectedModel)}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium tabular-nums text-white/60">
            {selectedModel.supportsDuration && <span>{duration}s</span>}
            <span className="hidden min-[400px]:inline">{ratio.label}</span>
            <QualityGlyph quality={quality} size={17} />
            <span className="text-white/70" aria-hidden="true">{audio.icon}</span>
          </span>
          <ChevronDown size={13} className={`shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Output settings"
          className="z-[100] w-[min(calc(100vw-24px),400px)] overflow-y-auto overscroll-contain rounded-[26px] border border-white/10 bg-[#161026]/[.98] p-4 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.85)] backdrop-blur-2xl"
          style={{ maxHeight: "min(var(--radix-popover-content-available-height), 620px)" }}
        >
          <SectionLabel>Model</SectionLabel>
          <div role="radiogroup" aria-label="Model" className="space-y-1.5">
            {models.map((model) => {
              const active = model.id === selectedModel.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onModel(model.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[.99] ${
                    active ? "border-violet/55 bg-violet/[.13]" : "border-white/[.07] bg-white/[.025] hover:border-white/20 hover:bg-white/[.05]"
                  }`}
                >
                  <ModelGlyph model={model} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[13px] font-bold leading-tight">{shortName(model)}</span>
                      <span className="text-[10px] font-medium text-white/40">{FAMILY_LABEL[model.family]}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[11px] leading-4 text-white/55">{model.bestFor}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[10px] text-white/40">
                      <span>{model.speed}</span>
                      <span aria-hidden="true">·</span>
                      <span>{model.quality}</span>
                      {model.nativeAudio && <><span aria-hidden="true">·</span><span>Sound</span></>}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <TierBars level={tierOf(model)} />
                    <span className="text-[10px] font-semibold tabular-nums text-white/60">
                      {modelPrice(model)} <span className="font-normal text-white/35">{model.family === "video" ? "cr/s" : "cr/img"}</span>
                    </span>
                  </span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${active ? "bg-violet text-white" : "border border-white/15 text-transparent"}`}>
                    <Check size={12} />
                  </span>
                </button>
              );
            })}
          </div>

          {selectedModel.supportsDuration && (
            <>
              <SectionLabel>Duration</SectionLabel>
              <div className="grid grid-cols-6 gap-1.5">
                {DURATION_PRESETS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => onDuration(seconds)}
                    className={`h-10 rounded-xl text-[12px] font-semibold tabular-nums transition active:scale-95 ${
                      duration === seconds ? "bg-white text-[#1b1030]" : "bg-white/[.05] text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <NumberStepper
                className="mt-2"
                label="Custom seconds (8–60)"
                value={durationText}
                min={8}
                max={60}
                unit="sec"
                onChange={(next) => {
                  setDurationText(next);
                  const parsed = Number(next);
                  if (next !== "" && Number.isFinite(parsed) && parsed >= 8 && parsed <= 60) onDuration(parsed);
                }}
              />
            </>
          )}

          <SectionLabel>Format</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {RATIOS.map((item) => {
              const active = value.aspectRatio === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onAspect(item.value)}
                  aria-pressed={active}
                  className={`flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border transition active:scale-95 ${
                    active ? "border-violet/55 bg-violet/[.13] text-white" : "border-white/[.07] bg-white/[.025] text-white/55 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`rounded-[4px] border-[1.5px] ${active ? "border-white bg-white/15" : "border-current"}`}
                    style={{ width: item.w, height: item.h }}
                  />
                  <span className="text-[11px] font-semibold leading-none">{item.label}</span>
                  <span className="text-[10px] leading-none text-white/40">{item.helper}</span>
                </button>
              );
            })}
          </div>

          <SectionLabel>Quality</SectionLabel>
          {selectedModel.supportedQualities.length > 1 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {selectedModel.supportedQualities.map((item) => {
                const active = quality === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onQuality(item)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[.98] ${
                      active ? "border-violet/55 bg-violet/[.13]" : "border-white/[.07] bg-white/[.025] hover:border-white/20"
                    }`}
                  >
                    <QualityGlyph quality={item} size={26} />
                    <span>
                      <span className="block text-[12px] font-semibold">{item === "4k" ? "Ultra 4K" : "Full HD"}</span>
                      <span className="block text-[10px] text-white/45">{item === "4k" ? "Maximum detail" : "Fast and sharp"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] px-3 py-2.5">
              <QualityGlyph quality={quality} size={26} />
              <span className="text-[12px] text-white/60">Fixed at {selectedModel.quality} for this model</span>
            </div>
          )}

          {audioModes.length > 0 && (
            <>
              <SectionLabel>Audio</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {audioModes.map((mode) => {
                  const meta = AUDIO_META[mode];
                  const active = value.audioMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => chooseAudio(mode)}
                      aria-pressed={active}
                      className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[.98] ${
                        active ? "border-violet/55 bg-violet/[.13] text-white" : "border-white/[.07] bg-white/[.025] text-white/65 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span className={active ? "text-violet" : "text-white/45"}>{meta.icon}</span>
                      <span>
                        <span className="block text-[12px] font-semibold leading-tight">{meta.label}</span>
                        <span className="block text-[10px] leading-tight text-white/40">{meta.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {narration && (
                <div
                  ref={languageRef}
                  className={`mt-3 rounded-2xl border border-violet/35 bg-violet/[.07] p-3 ${shaking ? "attention-shake" : ""}`}
                >
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                    <Languages size={13} className="text-violet" />
                    Narration language
                    <span className="ml-auto font-normal text-white/45">{languageLabel}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[["auto", "Auto"] as const, ...languages].map(([code, label]) => {
                      const active = value.narrationLanguage === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => { onLanguage(code); setShaking(false); }}
                          aria-pressed={active}
                          className={`h-8 rounded-full px-3 text-[11px] font-semibold transition active:scale-95 ${
                            active ? "bg-white text-[#1b1030]" : "bg-white/[.07] text-white/70 hover:bg-white/[.13] hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-white/40">Auto speaks the language you wrote your prompt in.</p>
                </div>
              )}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
