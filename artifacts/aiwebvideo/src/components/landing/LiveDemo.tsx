import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Play } from "lucide-react";

/** Scripted examples of a conversation, played on a loop so a visitor sees how it works before trying it. */
const SCRIPTS = [
  {
    ask: "Make a 16 second ad for lumencoffee.com with an Arabic voice-over",
    steps: ["Website link found", "Vertical, 16 seconds", "Arabic narration"],
    reply: "A 16-second vertical promo for lumencoffee.com with an Arabic voice-over. Reading the site now.",
    stages: ["Reading the site", "Writing the story", "Generating scenes"],
    frames: ["Hook", "The roast", "The café", "Order now"],
    result: "Website video · 16s · 9:16",
  },
  {
    ask: "amazon.com/dp/B0C7 studio photos on a marble counter",
    steps: ["Product page found", "4 studio photos", "Marble surface, soft light"],
    reply: "Four studio photos of the product on a marble counter with soft daylight. Picking up the product photos now.",
    stages: ["Reading the product", "Matching the product", "Rendering photos"],
    frames: ["Front", "Detail", "Lifestyle", "Top view"],
    result: "Product photos · set of 4 · 1:1",
  },
  {
    ask: "Show a two-floor clothes shop on this corner maps.app.goo.gl/k3Rf",
    steps: ["Map location found", "Two floors, retail", "Street-level view"],
    reply: "A two-floor clothes shop placed on that corner, seen from the street. Finding the exact spot on the map.",
    stages: ["Locating the site", "Studying the street", "Rendering the building"],
    frames: ["Street", "Entrance", "Corner", "Dusk"],
    result: "Architecture · set of 4 · 16:9",
  },
] as const;

type Phase = "typing" | "sent" | "thinking" | "reply" | "making" | "done";

export function LiveDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [count, setCount] = useState(0);
  const script = SCRIPTS[index];
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // One small clock drives the whole scene; it only runs while the demo is on screen.
  useEffect(() => {
    if (!visible || still) return;
    const next = (to: Phase, wait: number) => window.setTimeout(() => { setCount(0); setPhase(to); }, wait);
    const tick = (wait: number) => window.setTimeout(() => setCount((value) => value + 1), wait);
    let timer = 0;
    if (phase === "typing") timer = count < script.ask.length ? tick(26) : next("sent", 500);
    else if (phase === "sent") timer = next("thinking", 350);
    else if (phase === "thinking") timer = count < script.steps.length ? tick(520) : next("reply", 350);
    else if (phase === "reply") timer = count < script.reply.length ? tick(14) : next("making", 500);
    else if (phase === "making") timer = count < 12 ? tick(380) : next("done", 300);
    else timer = window.setTimeout(() => { setIndex((value) => (value + 1) % SCRIPTS.length); setCount(0); setPhase("typing"); }, 3200);
    return () => window.clearTimeout(timer);
  }, [visible, still, phase, count, script]);

  const after = (target: Phase) => still || ["typing", "sent", "thinking", "reply", "making", "done"].indexOf(phase) >= ["typing", "sent", "thinking", "reply", "making", "done"].indexOf(target);
  const typed = still || phase !== "typing" ? "" : script.ask.slice(0, count);
  const stepsShown = still || after("reply") ? script.steps.length : phase === "thinking" ? count : 0;
  const replyShown = still || after("making") ? script.reply : phase === "reply" ? script.reply.slice(0, count) : "";
  const progress = still || phase === "done" ? 12 : phase === "making" ? count : 0;
  const stage = script.stages[Math.min(script.stages.length - 1, Math.floor(progress / 4))];

  return (
    <div ref={rootRef} className="demo-window mx-auto w-full max-w-[860px] overflow-hidden rounded-[28px] border border-white/10 bg-bg" aria-label="Example conversation" role="img">
      <div className="flex items-center gap-2 border-b border-white/[.08] px-5 py-3">
        <img src="/logo.svg" alt="" width={20} height={20} />
        <span className="text-[13px] font-medium text-text-muted">Example</span>
        <span className="ml-auto flex gap-1.5" aria-hidden="true">
          {SCRIPTS.map((_, dot) => <span key={dot} className={`h-1.5 w-1.5 rounded-full ${dot === index ? "bg-white" : "bg-white/20"}`} />)}
        </span>
      </div>

      <div className="flex min-h-[430px] flex-col gap-5 px-4 py-6 sm:min-h-[400px] sm:px-8">
        {after("sent") && (
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-[22px] bg-white/[.07] px-4 py-2.5 text-[15px] leading-6 text-text-primary">{script.ask}</p>
          </div>
        )}

        {after("thinking") && (
          <div className="flex items-start gap-3">
            <img src="/logo.svg" alt="" width={26} height={26} className={`mt-0.5 shrink-0 ${phase === "thinking" ? "assistant-pulse" : ""}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] ${phase === "thinking" ? "thinking-shimmer" : "text-text-dim"}`}>{phase === "thinking" ? "Thinking" : "Thought for 2s"}</p>
              <ul className="mt-1.5 space-y-1 border-l border-white/15 pl-3">
                {script.steps.slice(0, stepsShown).map((step) => (
                  <li key={step} className="thinking-step flex items-center gap-2 text-[13px] leading-5 text-text-muted"><Check size={12} strokeWidth={3} className="shrink-0 text-mint" /> {step}</li>
                ))}
              </ul>
              {replyShown && <p className="mt-2.5 text-[15px] leading-7 text-text-primary">{replyShown}{phase === "reply" && <span className="typing-caret" />}</p>}

              {after("making") && (
                <div className="mt-4 rounded-2xl border border-white/10 p-3.5">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-medium text-text-primary">{progress >= 12 ? script.result : stage}</span>
                    <span className="font-utility text-text-dim">{Math.round((progress / 12) * 100)}%</span>
                  </div>
                  <div className="credit-meter mt-2.5"><span style={{ width: `${(progress / 12) * 100}%` }} /></div>
                  <div className="mt-3.5 grid grid-cols-4 gap-2">
                    {script.frames.map((frame, slot) => {
                      const ready = progress >= (slot + 1) * 3;
                      return (
                        <div key={frame} className={`demo-frame relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl text-[11px] font-medium transition-colors duration-500 sm:aspect-video ${ready ? "demo-frame-ready text-text-primary" : "bg-white/[.04] text-text-dim"}`} data-slot={slot}>
                          {ready && slot === 0 && progress >= 12 ? <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-bg"><Play size={13} fill="currentColor" /></span> : frame}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 sm:px-8 sm:pb-6">
        <div className="flex min-h-[52px] items-center gap-3 rounded-full border border-white/10 py-1.5 pl-5 pr-1.5">
          <p className="min-w-0 flex-1 truncate text-[15px] text-text-primary">
            {typed || <span className="text-text-dim">Paste a link, or describe what you want to make</span>}
            {phase === "typing" && !still && <span className="typing-caret" />}
          </p>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${typed ? "bg-white text-bg" : "bg-white/10 text-text-dim"}`}><ArrowUp size={17} strokeWidth={2.4} /></span>
        </div>
      </div>
    </div>
  );
}
