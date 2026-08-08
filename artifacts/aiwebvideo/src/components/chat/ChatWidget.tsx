import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatBubble, TypingIndicator } from './ChatBubble';
import { QuickReplyChips } from './QuickReplyChips';
import { ChatInputBar } from './ChatInputBar';
import { SiteCard } from './SiteCard';
import { ProgressBar } from './ProgressBar';
import { ResultGrid } from './ResultGrid';
import { Button } from '@/components/ui/app-button';
import { AuthModal } from '@/components/auth/AuthModal';
import { watchAuthState } from '@/lib/firebase/client';
import { startCapture, requestStoryboard, requestRender, fetchJob, fetchMe, reuseSavedCapture, saveJobMessage, ApiError } from '@/lib/api-client';
import { LockedTeaser } from './LockedTeaser';
import { PaywallModal } from './PaywallModal';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import { DURATION_OPTIONS, FORMAT_OPTIONS, MODE_OPTIONS, type JobMode } from './types';

type Stage =
  | 'awaiting_url'
  | 'capturing'
  | 'awaiting_mode'
  | 'awaiting_duration'
  | 'awaiting_format'
  | 'awaiting_features'
  | 'awaiting_brief'
  | 'storyboarding'
  | 'ready_to_render'
  | 'rendering'
  | 'done'
  | 'failed';

interface Message { id: string; role: 'bot' | 'user'; content: ReactNode; }

const MODE_DEFAULT_VIBES: Record<JobMode, string> = {
  video: 'Premium editorial · luxury agency pacing',
  tutorial: 'Clear · calm · easy to follow',
  buy: 'Premium commerce · confident · conversion focused',
  tour: 'Polished feature showcase · clean · modern',
  demo: 'Generative cinematic brand film · Apple/Stripe launch quality',
  photos: 'Premium marketing campaign · art-directed · brand faithful',
  both: 'Exact-capture video · creative premium marketing stills',
};

let msgCounter = 0;
const nextId = () => `m${++msgCounter}`;

export function ChatWidget({ className, onJobCreated, initialJobId, initialMode }: { className?: string; onJobCreated?: (jobId: string) => void; initialJobId?: string | null; initialMode?: JobMode | null }) {
  const [messages, setMessages] = useState<Message[]>([{
    id: nextId(), role: 'bot',
    content: "Paste your website link. I’ll capture the real pages once. Videos keep the captured website and its text exact; Photos can use those captures as references for the marketing edits you describe.",
  }]);
  const [stage, setStage] = useState<Stage>('awaiting_url');
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const selectJobId = (value: string | null) => {
    jobIdRef.current = value;
    setJobId(value);
  };
  const [mode, setMode] = useState<JobMode>('video');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skipVoiceover, setSkipVoiceover] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [featuresText, setFeaturesText] = useState<string | null>(null);
  const [creativeBrief, setCreativeBrief] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [outputQuality, setOutputQuality] = useState<'1080p' | '4k'>('1080p');
  const [frameRate, setFrameRate] = useState<30 | 60>(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pollNoticeRef = useRef(false);

  const pollingActive = stage === 'capturing' || stage === 'storyboarding' || stage === 'rendering';
  const { job, error: pollError } = useJobPolling(jobId, pollingActive);

  useEffect(() => watchAuthState((user) => setIsSignedIn(!!user)), []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, stage]);

  function persist(role: 'user' | 'assistant', content: ReactNode, kind = 'text') {
    const activeJobId = jobIdRef.current;
    if (!activeJobId || typeof content !== 'string') return;
    void saveJobMessage(activeJobId, role, content, kind).catch(() => {});
  }
  function pushBot(content: ReactNode, kind = 'text') {
    setMessages((p) => [...p, { id: nextId(), role: 'bot', content }]);
    persist('assistant', content, kind);
  }
  function pushUser(content: ReactNode, kind = 'text') {
    setMessages((p) => [...p, { id: nextId(), role: 'user', content }]);
    persist('user', content, kind);
  }

  // Capture stage: watch for capture_metadata
  const capturedRef = useRef(false);
  useEffect(() => {
    if (!initialJobId) return;
    let cancelled = false;
    void fetchJob(initialJobId).then((saved) => {
      if (cancelled || !saved.captureMetadata) return;
      selectJobId(saved.id);
      setMode(initialMode ?? saved.mode);
      capturedRef.current = true;
      const transcript: Message[] = saved.messages.map((message) => ({
        id: message.id,
        role: message.role === 'user' ? 'user' : 'bot',
        content: message.content,
      }));
      const reopenedMessages: Message[] = [
        ...transcript,
        { id: nextId(), role: 'bot', content: <SiteCard sourceUrl={saved.sourceUrl} metadata={saved.captureMetadata} /> },
      ];
      if (initialMode) {
        const label = MODE_OPTIONS.find((option) => option.mode === initialMode)?.label ?? 'Continue creating';
        reopenedMessages.push({ id: nextId(), role: 'user', content: label });
        if (initialMode === 'photos') {
          reopenedMessages.push({ id: nextId(), role: 'bot', content: 'Your saved screenshots and recording are ready. Choose the format for the new photo set.' });
          setStage('awaiting_format');
        } else {
          reopenedMessages.push({ id: nextId(), role: 'bot', content: 'Your saved website capture is ready—no rescan needed. How long should this production be?' });
          setStage('awaiting_duration');
        }
      } else {
        reopenedMessages.push({ id: nextId(), role: 'bot', content: 'Saved capture loaded. What would you like to create from it?' });
        setStage('awaiting_mode');
      }
      setMessages(reopenedMessages);
      onJobCreated?.(saved.id);
    }).catch(() => {
      pushBot('We could not reopen that saved capture. Please choose another chat or start a new one.');
      setStage('failed');
    });
    return () => { cancelled = true; };
  }, [initialJobId, initialMode]);
  useEffect(() => {
    if (stage !== 'capturing' || !job || job.id !== jobId || capturedRef.current) return;
    if (job.status === 'failed') {
      capturedRef.current = true;
      pushBot(job.errorMessage || "We couldn't load that site. Check the URL and try again.");
      setStage('failed'); return;
    }
    if (job.captureMetadata) {
      capturedRef.current = true;
      pushBot(<SiteCard sourceUrl={job.sourceUrl} metadata={job.captureMetadata} />);
      pushBot('What do you want to generate?');
      setStage('awaiting_mode');
    }
  }, [job, stage]);

  // Storyboard stage
  const storyboardedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'storyboarding' || !job || job.id !== jobId || storyboardedRef.current) return;
    if (job.status === 'failed') {
      storyboardedRef.current = true;
      pushBot(job.errorMessage || "We couldn't prepare the edit plan this time. Your capture is safe — try the direction again.");
      setStage('awaiting_brief'); return;
    }
    if (job.storyboard) {
      storyboardedRef.current = true;
      const sb = job.storyboard;
      pushBot(
        <div className="space-y-2">
          <p className="font-semibold text-text-primary">{sb.concept}</p>
          <p className="text-text-muted">
            {mode === 'photos'
              ? `${sb.scenes.length} marketing image${sb.scenes.length === 1 ? '' : 's'}.`
              : `${sb.scenes.length} scene${sb.scenes.length === 1 ? '' : 's'}, ${sb.targetDurationSeconds || sb.scenes.reduce((s, x) => s + x.durationSeconds, 0)}s total.`}
          </p>
          <p className="font-utility text-[11px] text-mint">
            {mode === 'photos'
              ? `Creative photo editing · ${sb.aspectRatio ?? aspectRatio} · ${sb.outputQuality === '4k' ? '4K master' : '1080p'}`
              : `Studio quality · ${sb.aspectRatio ?? aspectRatio} · ${sb.outputQuality === '4k' ? '4K master' : '1080p'} · ${sb.frameRate ?? frameRate} FPS`}
          </p>
          <div className="space-y-1.5">
            {sb.scenes.map((scene) => (
              <div key={scene.sceneNumber} className="rounded-xl border border-white/5 bg-white/[.025] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-violet">{mode === 'photos' ? 'Image' : 'Scene'} {scene.sceneNumber}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{scene.shotDescription}</p>
              </div>
            ))}
          </div>
          {sb.ideas && sb.ideas.length > 0 && (
            <details className="text-xs text-text-muted">
              <summary className="cursor-pointer text-text-dim hover:text-text-muted">💡 Other creative directions</summary>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                {sb.ideas.map((idea, i) => <li key={i}>{idea}</li>)}
              </ul>
            </details>
          )}
        </div>
      );
      pushBot('Ready when you are — or try another concept.');
      setStage('ready_to_render');
    }
  }, [job, stage]);

  // Render stage
  const renderedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'rendering' || !job || job.id !== jobId || renderedRef.current) return;
    if (job.status === 'done') {
      renderedRef.current = true;
      pushBot(
        <div className="space-y-2">
          <p>Here it is — generated from your real site. 🎬</p>
          {job.errorMessage && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              ⚠️ {job.errorMessage}
            </p>
          )}
          <ResultGrid assets={job.assets} onUnlock={() => setShowAuthModal(true)} />
        </div>
      );
      pushBot('What would you like to do next? You can reuse these saved screenshots and recordings without scanning again, or start with a different website.');
      setStage('done');
    } else if (job.status === 'failed') {
      renderedRef.current = true;
      pushBot(job.errorMessage || "The render didn't finish. Try again or start over with a different URL.");
      // Never let a retry reuse the same job/storyboard that just failed —
      // the backend now refuses that anyway (RENDER_ALREADY_FAILED), and
      // reusing it would replay the exact same edit plan on the next click.
      // Automatically prepare a brand-new job + a brand-new storyboard from
      // the same saved screenshots and the same creative choices, so the
      // next "Generate" click is guaranteed to be a fresh attempt.
      void prepareFreshVersionAfterFailure(job.id);
    }
  }, [job, stage]);

  useEffect(() => {
    if (pollError && !pollNoticeRef.current) {
      pollNoticeRef.current = true;
      pushBot('The connection paused briefly. Your project is safe and we are reconnecting automatically.');
    }
    if (!pollError) pollNoticeRef.current = false;
  }, [pollError]);

  async function handleUrlSubmit(url: string) {
    const normalized = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    pushUser(normalized);
    setBusy(true);
    capturedRef.current = false;
    setStage('capturing');
    try {
      const res = await startCapture(normalized);
      selectJobId(res.jobId);
      onJobCreated?.(res.jobId);
      let hostname = normalized;
      try { hostname = new URL(normalized).hostname; } catch {}
      pushBot(`Scanning ${hostname}…`);
    } catch (err) {
      pushBot(errorMessage(err));
      setStage('awaiting_url');
    } finally { setBusy(false); }
  }

  function handleModeSelect(label: string) {
    const selected: JobMode = MODE_OPTIONS.find((o) => o.label === label)?.mode ?? 'video';
    pushUser(label);
    setMode(selected);
    setFeaturesText(null);
    setCreativeBrief(null);
    if (selected === 'photos') {
      pushBot('Choose the delivery format.');
      setStage('awaiting_format');
    } else {
      pushBot('How long should the video be? Longer videos cover more of your site’s features, scene by scene.');
      setStage('awaiting_duration');
    }
  }

  function handleDurationSelect(label: string) {
    const opt = DURATION_OPTIONS.find((o) => o.label === label) ?? DURATION_OPTIONS[0];
    pushUser(label);
    setDurationSeconds(opt.seconds);
    pushBot('Choose the delivery format. Cinema 4K 60 keeps the captured website crisp while delivering a 4K master.');
    setStage('awaiting_format');
  }

  function askForBrief() {
    if (mode === 'photos') {
      pushBot('Describe what you want the marketing photos to become. You can ask for a product ad, new background, luxury studio, lifestyle scene, social-media creative, seasonal campaign, lighting change, or another edit. I’ll use the captured website images as the real brand/product references. If website UI appears in a result, its existing text must stay faithful to the capture.');
    } else if (mode === 'both') {
      pushBot('Describe the campaign direction once. Tell me what the video should emphasize and what you want the marketing photos to look like. The video will keep the captured website and text exact; the photos may be creatively edited from those captured brand/product references.');
    } else if (mode === 'demo') {
      pushBot('Describe the campaign direction if you want to steer it — a specific mockup device, backdrop, or feature to emphasize. I’ll generate a cinematic brand film (device mockups, glassmorphism cards, a studio backdrop) grounded in your real logo, products, and captured brand content — or let the studio use the strongest direction automatically.');
    } else {
      pushBot('Everything important is already set. Add one optional instruction if you want to emphasize a page, product, feature, pacing, or editing style — or let the studio use the strongest exact-capture direction automatically.');
    }
    setStage('awaiting_brief');
  }

  function handleFormatSelect(label: string) {
    const option = FORMAT_OPTIONS.find((item) => item.label === label) ?? FORMAT_OPTIONS[0];
    pushUser(label);
    setAspectRatio(option.aspectRatio);
    setOutputQuality(option.outputQuality);
    setFrameRate(option.frameRate);
    if (mode === 'tour') {
      pushBot('Feature Tour can detect the strongest features automatically. If there are specific features you must include, type them below.');
      setStage('awaiting_features');
    } else {
      askForBrief();
    }
  }

  function handleFeaturesAuto() {
    pushUser('✨ Detect the strongest features');
    setFeaturesText(null);
    askForBrief();
  }

  function handleFeaturesSubmit(text: string) {
    pushUser(text);
    setFeaturesText(text);
    askForBrief();
  }

  async function requestBestStoryboard(briefOverride?: string | null) {
    if (!jobId) return;
    const vibe = MODE_DEFAULT_VIBES[mode];
    setBusy(true);
    storyboardedRef.current = true;
    setStage('storyboarding');
    pushBot(
      mode === 'photos'
        ? 'Planning four marketing images from your saved website captures and your description. Creative photo editing is allowed, while real brand/product details stay grounded in the source.'
        : mode === 'both'
          ? 'Planning one campaign: an exact-capture website video plus creative marketing photos based on your saved brand/product references.'
          : mode === 'demo'
            ? 'Planning a generative cinematic brand film: device mockups, glassmorphism cards, and a studio backdrop, all grounded in your real logo, products, and captured brand content. This is the one mode that generates new imagery instead of editing the exact screenshots.'
            : 'Building the edit plan from the exact saved screenshots. The smooth-scroll recording stays available separately for you and is not mixed into the generated video. Website text and UI stay locked to the capture.'
    );
    try {
      const requestedJobId = jobId;
      const response = await requestStoryboard(requestedJobId, mode, vibe, durationSeconds, featuresText ?? undefined, {
        creativeBrief: (briefOverride === undefined ? creativeBrief : briefOverride) ?? undefined,
        aspectRatio,
        outputQuality,
        frameRate,
      });
      if (response.jobId !== requestedJobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
        capturedRef.current = true;
        renderedRef.current = false;
      }
      storyboardedRef.current = false;
    } catch (err) {
      pushBot(errorMessage(err));
      setStage('awaiting_brief');
    } finally { setBusy(false); }
  }

  function handleBriefPreset(label: string) {
    pushUser(label);
    setCreativeBrief(null);
    void requestBestStoryboard(null);
  }

  function handleBriefSubmit(text: string) {
    pushUser(text);
    setCreativeBrief(text);
    void requestBestStoryboard(text);
  }

  function showLockedTeaser() {
    const sb = job?.storyboard;
    pushBot(
      <LockedTeaser
        siteUrl={job?.sourceUrl ?? ''}
        screenshotUrl={job?.captureMetadata?.screenshotUrl ?? null}
        sceneCount={sb?.scenes.length ?? 3}
        durationSeconds={sb?.targetDurationSeconds || durationSeconds}
        onUnlock={() => setShowPaywall(true)}
      />
    );
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Free users get a real multi-page capture and storyboard preview. Expensive
  // Expensive production begins only after purchase.
  async function runFreeRenderExperience() {
    const sb = job?.storyboard;
    const sceneCount = sb?.scenes.length ?? 3;
    setBusy(true);
    try {
      pushBot(`🎬 Preparing your ${sceneCount}-scene production preview…`);
      await sleep(1200);
      pushBot('✨ Capture, brand direction, format and storyboard are ready.');
      await sleep(900);
      showLockedTeaser();
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!jobId) return;
    if (!isSignedIn) {
      pendingActionRef.current = () => handleGenerate();
      setShowAuthModal(true); return;
    }

    // Free plan: everything up to here felt real — because it is. The storyboard
    // is built from their actual site. Rendering is where the paywall sits.
    try {
      const me = await fetchMe();
      if (me.plan === 'free') {
        void runFreeRenderExperience();
        return;
      }
    } catch { /* if /me fails, let the server-side gate decide */ }

    setBusy(true);
    renderedRef.current = false;
    setStage('rendering');
    const isVideo = mode !== 'photos';
    pushBot(
      mode === 'photos'
        ? 'Creating four marketing images from your saved website captures and the direction you described. Products and brand details stay anchored to the source; creative backgrounds and campaign styling follow your request. This usually takes a few minutes.'
        : mode === 'both'
          ? `Creating both deliverables in parallel: an exact-capture ${durationSeconds >= 48 ? '~60s' : durationSeconds > 8 ? '~30s' : 'short'} website video plus four creatively edited marketing photos based on the captured brand/products. This usually takes ${durationSeconds >= 48 ? '4–10' : '2–6'} minutes.`
          : mode === 'demo'
            ? `Generating your ${durationSeconds >= 48 ? '~60s' : '~30s'} cinematic brand film — one AI-generated scene at a time (device mockups, glassmorphism cards, studio backdrop), grounded in your real logo, products, and captured brand content, then cut together. This usually takes ${durationSeconds >= 48 ? '6–12' : '3–7'} minutes.`
            : isVideo && durationSeconds > 8
              ? `Editing your ${durationSeconds >= 48 ? '~60s' : '~30s'} video from the exact saved screenshots only. The smooth-scroll recording remains a separate preview/download and is not inserted into the generated video. No website text, product, logo, or UI is regenerated. This usually takes ${durationSeconds >= 48 ? '4–10' : '2–6'} minutes.`
              : 'Editing the exact saved website capture into the final video — no redrawn interface and no regenerated website text. This usually takes 1–4 minutes.'
    );
    try { await requestRender(jobId, skipVoiceover); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_REQUIRED') {
        setStage('ready_to_render');
        showLockedTeaser();
      } else if (err instanceof ApiError && err.code === 'INSUFFICIENT_CREDITS') {
        pushBot('This production needs more credits than your current balance. Nothing was charged and your project is saved. Choose a shorter version or add production credits to continue.');
        setStage('ready_to_render');
        setShowPaywall(true);
      } else {
        pushBot(errorMessage(err));
        setStage('ready_to_render');
      }
    } finally { setBusy(false); }
  }

  function handleStartOver() {
    selectJobId(null); setBusy(false);
    capturedRef.current = false; storyboardedRef.current = false; renderedRef.current = false;
    setMode('video'); setSkipVoiceover(false); setDurationSeconds(8); setFeaturesText(null); setCreativeBrief(null);
    setAspectRatio('16:9'); setOutputQuality('1080p'); setFrameRate(30); setStage('awaiting_url');
    setMessages([{ id: nextId(), role: 'bot', content: "New project — paste the website URL and I’ll prepare it." }]);
  }

  async function handleReuseCapture() {
    if (!jobId) return;
    setBusy(true);
    try {
      const reused = await reuseSavedCapture(jobId);
      const saved = await fetchJob(reused.jobId);
      selectJobId(saved.id);
      onJobCreated?.(saved.id);
      capturedRef.current = true;
      storyboardedRef.current = false;
      renderedRef.current = false;
      setMode('video');
      setFeaturesText(null);
      setCreativeBrief(null);
      pushUser('Reuse these saved website files');
      if (saved.captureMetadata) {
        pushBot(<SiteCard sourceUrl={saved.sourceUrl} metadata={saved.captureMetadata} />);
      }
      pushBot('Saved screenshots and scrolling recording loaded—no new scan and no duplicate capture cost. What would you like to create from them?');
      setStage('awaiting_mode');
    } catch (err) {
      pushBot(errorMessage(err));
      setStage('done');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateResult() {
    if (!jobId) return;
    const sourceJobId = jobId;
    const vibe = MODE_DEFAULT_VIBES[mode];
    setBusy(true);
    storyboardedRef.current = true;
    renderedRef.current = false;
    pushUser('Generate another version');
    pushBot('Starting a fresh version from the same saved screenshots. I’ll create a new edit plan and new output file — the previous result stays untouched.');
    setStage('storyboarding');
    try {
      const reused = await reuseSavedCapture(sourceJobId);
      selectJobId(reused.jobId);
      onJobCreated?.(reused.jobId);
      capturedRef.current = true;
      const response = await requestStoryboard(reused.jobId, mode, vibe, durationSeconds, featuresText ?? undefined, {
        creativeBrief: creativeBrief ?? undefined,
        aspectRatio,
        outputQuality,
        frameRate,
      });
      if (response.jobId !== reused.jobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
      }
      storyboardedRef.current = false;
    } catch (err) {
      storyboardedRef.current = false;
      pushBot(errorMessage(err));
      setStage('done');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Runs automatically after a render fails. Gets a brand-new job (fresh copy
   * of the saved screenshots, new job id) and a brand-new storyboard (fresh
   * AI planning attempt, new variant seed) using the same creative choices
   * the user already made, so the next "Generate" click can never replay the
   * exact plan that just failed.
   */
  async function prepareFreshVersionAfterFailure(failedJobId: string) {
    const vibe = MODE_DEFAULT_VIBES[mode];
    setBusy(true);
    storyboardedRef.current = true;
    renderedRef.current = false;
    pushBot('Preparing a fresh version from your saved screenshots so the next attempt uses a brand-new edit plan…');
    setStage('storyboarding');
    try {
      const reused = await reuseSavedCapture(failedJobId);
      selectJobId(reused.jobId);
      onJobCreated?.(reused.jobId);
      capturedRef.current = true;
      const response = await requestStoryboard(reused.jobId, mode, vibe, durationSeconds, featuresText ?? undefined, {
        creativeBrief: creativeBrief ?? undefined,
        aspectRatio,
        outputQuality,
        frameRate,
      });
      if (response.jobId !== reused.jobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
      }
      storyboardedRef.current = false;
    } catch (err) {
      storyboardedRef.current = false;
      pushBot(errorMessage(err));
      setStage('failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemixResult() {
    if (!jobId) return;
    const previousMode = mode;
    setBusy(true);
    try {
      const reused = await reuseSavedCapture(jobId);
      const saved = await fetchJob(reused.jobId);
      selectJobId(saved.id);
      onJobCreated?.(saved.id);
      capturedRef.current = true;
      storyboardedRef.current = false;
      renderedRef.current = false;
      setMode(previousMode);
      setCreativeBrief(null);
      pushUser('Edit or remix this result');
      if (saved.captureMetadata) pushBot(<SiteCard sourceUrl={saved.sourceUrl} metadata={saved.captureMetadata} />);
      pushBot(
        previousMode === 'photos'
          ? 'Describe the photo change you want — for example a different background, product focus, luxury studio, lifestyle setup, social-ad style, lighting, crop, or campaign mood. I’ll reuse the saved website images as references without rescanning.'
          : previousMode === 'both'
            ? 'Describe what to change in the video and/or photos. The video will continue to use the exact saved website capture; the marketing photos can be creatively re-edited from the saved brand/product references.'
            : previousMode === 'demo'
              ? 'Describe what to change in the cinematic film — a different mockup device, backdrop, feature to emphasize, or mood. I’ll regenerate the scenes from your saved brand/product references without rescanning.'
              : 'Tell me what to change: pages, products, scene order, timing, split screens, transitions, format, or pacing. I will reuse the exact saved capture — no new link, no rescan, and no website text will be regenerated.'
      );
      setStage('awaiting_brief');
    } catch (err) {
      pushBot(errorMessage(err));
      setStage('done');
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshCapture() {
    const sourceUrl = job?.sourceUrl;
    if (!sourceUrl) return;
    pushUser('Refresh the website capture');
    setBusy(true);
    capturedRef.current = false;
    storyboardedRef.current = false;
    renderedRef.current = false;
    setStage('capturing');
    try {
      const res = await startCapture(sourceUrl);
      selectJobId(res.jobId);
      onJobCreated?.(res.jobId);
      pushBot('Recapturing every page after loading lazy images, product media, fonts and video. This replaces missing placeholders with the newest live website content.');
    } catch (err) {
      pushBot(errorMessage(err));
      setStage('done');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-panel/85 shadow-[0_30px_100px_-42px_rgba(139,92,246,.75)] backdrop-blur-xl ${className ?? ''}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet/10 to-transparent" />
      {/* Header */}
      <div className="relative flex items-center gap-3 border-b border-border bg-white/[.015] px-4 py-3.5 sm:px-5">
        <img src="/logo.svg" alt="" width={26} height={26} className="shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13.5px] font-semibold text-text-primary">AiWebVideo Studio</p>
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
            Capture-based creative studio
          </p>
        </div>
        {jobId && (
          <div className="hidden items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold text-mint sm:flex">
            <span aria-hidden="true">✓</span> {mode === 'photos' ? 'Creative photo edits' : mode === 'both' ? 'Exact video · creative photos' : mode === 'demo' ? 'Generative cinematic film' : 'Website text preserved'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-scroll relative flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5" style={{ maxHeight: 570 }}>
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role}>{m.content}</ChatBubble>
        ))}
        {(stage === 'capturing' || stage === 'storyboarding') && !job && (
          <TypingIndicator />
        )}
        {job && pollingActive && (
          <ChatBubble role="bot">
            <ProgressBar
              status={job.status}
              progress={job.progress}
              statusMessage={job.statusMessage}
              etaSeconds={job.etaSeconds}
            />
          </ChatBubble>
        )}
      </div>

      {/* Input area */}
      <div className="space-y-2.5 border-t border-border bg-bg/35 p-3.5 sm:p-4">
        {stage === 'awaiting_url' && (
          <ChatInputBar placeholder="https://yoursite.com" onSubmit={handleUrlSubmit} disabled={busy} />
        )}
        {stage === 'awaiting_mode' && (
          <QuickReplyChips options={MODE_OPTIONS.map((o) => o.label)} onSelect={handleModeSelect} disabled={busy} />
        )}
        {stage === 'awaiting_duration' && (
          <QuickReplyChips options={DURATION_OPTIONS.map((o) => o.label)} onSelect={handleDurationSelect} disabled={busy} />
        )}
        {stage === 'awaiting_format' && (
          <QuickReplyChips options={FORMAT_OPTIONS.map((o) => o.label)} onSelect={handleFormatSelect} disabled={busy} />
        )}
        {stage === 'awaiting_features' && (
          <>
            <QuickReplyChips options={['✨ Detect the strongest features']} onSelect={handleFeaturesAuto} disabled={busy} />
            <ChatInputBar placeholder="e.g. search, wishlist, live chat, fast checkout…" onSubmit={handleFeaturesSubmit} disabled={busy} />
          </>
        )}
        {stage === 'awaiting_brief' && (
          <>
            {mode !== 'photos' && (
              <QuickReplyChips options={['✨ Create with best direction']} onSelect={handleBriefPreset} disabled={busy} />
            )}
            <ChatInputBar
              multiline
              placeholder={mode === 'photos'
                ? 'Describe the marketing edit: e.g. use the black dress, luxury beige studio, soft shadows, Instagram ad style, no added text…'
                : mode === 'both'
                  ? 'Optional: video focus + photo style, e.g. fast luxury video; create clean studio product ads from the captured products…'
                  : 'Optional: e.g. focus on dresses, faster cuts, more split screens, show checkout last…'}
              onSubmit={handleBriefSubmit}
              disabled={busy}
            />
          </>
        )}
        {stage === 'ready_to_render' && (
          <div className="space-y-2">
            {mode !== 'photos' && (
              <div className="flex gap-2">
                <Button variant={!skipVoiceover ? 'primary' : 'secondary'} size="sm" onClick={() => setSkipVoiceover(false)} disabled={busy}>
                  Cinematic sound
                </Button>
                <Button variant={skipVoiceover ? 'primary' : 'secondary'} size="sm" onClick={() => setSkipVoiceover(true)} disabled={busy}>
                  Silent master
                </Button>
              </div>
            )}
            <Button variant="primary" size="md" className="w-full" onClick={handleGenerate} disabled={busy}>
              {isSignedIn ? 'Generate' : 'Sign in to generate'}
            </Button>
            <Button
              variant="secondary" size="sm" className="w-full" disabled={busy}
              onClick={() => {
                storyboardedRef.current = false;
                pushBot(
                  mode === 'photos'
                    ? 'Describe the new marketing-photo direction you want. I’ll reuse the saved website images as references.'
                    : mode === 'both'
                      ? 'Describe the new campaign direction. The video stays exact-capture; the photos can be creatively edited from the saved references.'
                      : mode === 'demo'
                        ? 'Describe the new cinematic direction you want, or use the best direction again. I’ll regenerate the scenes from your saved brand/product references.'
                        : 'Describe the change you want, or use the best direction again. The saved capture will be reused exactly.'
                );
                setStage('awaiting_brief');
              }}
            >
              Try another concept
            </Button>
          </div>
        )}
        {stage === 'done' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" size="md" className="w-full sm:col-span-2" onClick={() => void handleRegenerateResult()} disabled={busy}>
              Generate another version
            </Button>
            <Button variant="secondary" size="md" className="w-full" onClick={() => void handleRemixResult()} disabled={busy}>
              Edit this result
            </Button>
            <Button variant="secondary" size="md" className="w-full" onClick={() => void handleReuseCapture()} disabled={busy}>
              Create something else
            </Button>
            <Button variant="secondary" size="md" className="w-full" onClick={() => void handleRefreshCapture()} disabled={busy}>
              Refresh website capture
            </Button>
            <Button variant="secondary" size="md" className="w-full" onClick={handleStartOver} disabled={busy}>
              Use a new website
            </Button>
          </div>
        )}
        {stage === 'failed' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {job?.captureMetadata && <Button variant="primary" size="md" className="w-full" onClick={() => void handleReuseCapture()} disabled={busy}>Reuse saved capture</Button>}
            <Button variant="secondary" size="md" className="w-full" onClick={handleStartOver} disabled={busy}>Use a new website</Button>
          </div>
        )}
      </div>

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          durationSeconds={job?.storyboard?.targetDurationSeconds || durationSeconds}
        />
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignedIn={() => {
            setShowAuthModal(false);
            const resume = pendingActionRef.current;
            pendingActionRef.current = null;
            resume?.();
          }}
        />
      )}
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const friendly: Record<string, string> = {
      RATE_LIMITED: 'The studio is handling several website previews right now. Please wait a few minutes, then try again.',
      SSRF_BLOCKED: 'That address cannot be opened safely. Please use a public website URL.',
      VALIDATION_ERROR: 'Please check what you entered and try again.',
      PLAN_REQUIRED: 'Your production plan is ready. Choose a production option when you want to create the final files.',
      INSUFFICIENT_CREDITS: 'Your project is saved, but this version needs more production credits. Nothing was charged.',
      RENDER_ALREADY_STARTED: 'This production is already running. Progress will update here automatically.',
      RENDER_ALREADY_FAILED: 'That version already tried once and failed. Preparing a fresh version to try again…',
      STORYBOARD_NOT_READY: 'The production plan is still being prepared. Please give it another moment.',
      BILLING_NOT_CONFIGURED: 'Checkout is temporarily unavailable. Your project is saved; please try again shortly.',
      PRICE_NOT_CONFIGURED: 'That purchase option is temporarily unavailable. Your project is saved.',
      INTERNAL_ERROR: 'We could not complete that step right now. Your work is safe; please try again shortly.',
      NOT_FOUND: 'That project could not be found. Start a new project from the website URL.',
    };
    return friendly[err.code ?? ''] ?? 'We could not complete that step. Your project is safe; please try again.';
  }
  // Anything else (network drops, unexpected exceptions) should never leak
  // technical details — show a calm, professional message instead.
  if (err instanceof TypeError || (err instanceof Error && /fetch|network|load failed/i.test(err.message))) {
    return "We're having trouble connecting. Please check your internet connection and try again.";
  }
  return "Something unexpected happened on our side. Please try again in a moment — if it keeps happening, we're on it.";
}
