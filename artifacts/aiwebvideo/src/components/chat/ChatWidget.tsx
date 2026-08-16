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
import { startCapture, requestStoryboard, requestRender, requestRenderQuote, cancelJob, fetchJob, fetchMe, reuseSavedCapture, saveJobMessage, saveJobWorkflow, uploadPhotos, uploadPrivatePages, claimJob, ApiError } from '@/lib/api-client';
import { LockedTeaser } from './LockedTeaser';
import { PaywallModal } from './PaywallModal';
import { PhotoUploadPicker } from './PhotoUploadPicker';
import { MediaPlanningPanel, captureMediaItems } from './MediaPlanningPanel';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import { clearActiveJobId, setActiveJobId } from '@/lib/guestSession';
import { FORMAT_OPTIONS, MODE_OPTIONS, type CaptureMetadata, type JobMode, type JobStatusResponse, type JobWorkflowState, type WorkflowStage } from './types';
import { normalizeWebsiteUrl } from '@/lib/websiteUrl';
import { estimateRenderCredits } from '@/lib/credits';
import { clearLocalJobWorkflow, loadLocalJobWorkflow, normalizeJobWorkflow, saveLocalJobWorkflow } from '@/lib/jobWorkflowDraft';
import { clearPhotoDraft } from '@/lib/photoDraft';

type Stage = 'awaiting_url' | WorkflowStage;

interface Message { id: string; role: 'bot' | 'user'; content: ReactNode; }

function durationLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ''}`;
}

const RESTORABLE_BEFORE_STORYBOARD = new Set<WorkflowStage>([
  'awaiting_private_pages', 'awaiting_mode', 'awaiting_duration', 'awaiting_format', 'awaiting_features', 'awaiting_brief',
]);
const RESTORABLE_WITH_STORYBOARD = new Set<WorkflowStage>([
  'awaiting_duration', 'awaiting_format', 'awaiting_features', 'awaiting_brief', 'ready_to_render',
]);

function resolveResumeStage(saved: JobStatusResponse, workflow: JobWorkflowState | null): WorkflowStage {
  // Server process status always wins over a cached UI step. This is what
  // makes closing the tab during generation safe: the provider continues,
  // and reopening reconnects to that same job rather than starting another.
  if (saved.status === 'rendering') return 'rendering';
  if (saved.status === 'storyboarding' && !saved.storyboard) return 'storyboarding';
  if ((saved.status === 'capturing' || saved.status === 'queued') && !saved.captureMetadata) return 'capturing';
  if (saved.status === 'done') return 'done';
  if (saved.status === 'failed' || saved.status === 'cancelled') return 'failed';

  const candidate = workflow?.stage;
  if (saved.storyboard) return candidate && RESTORABLE_WITH_STORYBOARD.has(candidate) ? candidate : 'ready_to_render';
  if (candidate && RESTORABLE_BEFORE_STORYBOARD.has(candidate)) return candidate;
  return saved.sourceUrl.startsWith('upload://') ? 'awaiting_mode' : 'awaiting_private_pages';
}

const MODE_DEFAULT_VIBES: Record<JobMode, string> = {
  video: 'Premium editorial · luxury agency pacing',
  tutorial: 'Clear · calm · easy to follow',
  buy: 'Premium commerce · confident · conversion focused',
  tour: 'Polished feature showcase · clean · modern',
  demo: 'Generative cinematic brand film · Apple/Stripe launch quality',
  photos: 'Premium marketing campaign · art-directed · brand faithful',
  icon: 'Distinctive · brand faithful · polished at every size',
  both: 'Exact-capture video · creative premium marketing stills',
  mockup: 'Fast social-feed reveal · energetic · scroll-stopping',
  linkedin: 'Professional · credible · LinkedIn feed optimized',
  custom: 'Guided entirely by your written idea',
};

type AudioMode = 'voice_music' | 'music_only' | 'silent';
const isImageMode = (value: JobMode) => value === 'photos' || value === 'icon';

let msgCounter = 0;
const nextId = () => `m${++msgCounter}`;

function doneResultMessage(job: JobStatusResponse, onUnlock: () => void): ReactNode {
  return (
    <div className="space-y-2">
      <p>Here it is — generated from your real site. 🎬</p>
      {job.errorMessage && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          ⚠️ {job.errorMessage}
        </p>
      )}
      <ResultGrid assets={job.assets} onUnlock={onUnlock} />
    </div>
  );
}

function storyboardSummaryMessage(job: JobStatusResponse, mode: JobMode, aspectRatio: string, frameRate: number): ReactNode {
  const sb = job.storyboard;
  if (!sb) return null;
  const scenes = Array.isArray(sb.scenes) ? sb.scenes.filter((scene) => scene && typeof scene === 'object') : [];
  const ideas = Array.isArray(sb.ideas) ? sb.ideas.filter((idea): idea is string => typeof idea === 'string') : [];
  return (
    <div className="space-y-2">
      <p className="font-semibold text-text-primary">{sb.concept || 'Production plan'}</p>
      <p className="text-text-muted">
        {isImageMode(mode)
          ? `${scenes.length} marketing image${scenes.length === 1 ? '' : 's'}.`
          : `${scenes.length} scene${scenes.length === 1 ? '' : 's'}, ${sb.targetDurationSeconds || scenes.reduce((s, x) => s + (Number(x.durationSeconds) || 0), 0)}s total.`}
      </p>
      <p className="font-utility text-[11px] text-mint">
        {isImageMode(mode)
          ? `Creative photo editing · ${sb.aspectRatio ?? aspectRatio} · ${sb.outputQuality === '4k' ? '4K master' : '1080p'}`
          : `Studio quality · ${sb.aspectRatio ?? aspectRatio} · ${sb.outputQuality === '4k' ? '4K master' : '1080p'} · ${sb.frameRate ?? frameRate} FPS`}
      </p>
      <div className="space-y-1.5">
        {scenes.map((scene, index) => (
          <div key={scene.sceneNumber ?? index} className="rounded-xl border border-white/5 bg-white/[.025] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-violet">{isImageMode(mode) ? (mode === 'icon' ? 'Icon' : 'Image') : 'Scene'} {scene.sceneNumber ?? index + 1}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{scene.shotDescription || 'Creative scene ready'}</p>
          </div>
        ))}
      </div>
      {ideas.length > 0 && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer text-text-dim hover:text-text-muted">💡 Other creative directions</summary>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            {ideas.map((idea, i) => <li key={i}>{idea}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ChatWidget({ className, onJobCreated, initialJobId, initialMode, resumeJobId }: { className?: string; onJobCreated?: (jobId: string) => void; initialJobId?: string | null; initialMode?: JobMode | null; resumeJobId?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([{
    id: nextId(), role: 'bot',
    content: "Paste your website link, or paste/upload your own photos below. You can copy photos or screenshots and press Ctrl+V or Cmd+V anywhere in this chat. I’ll capture the real pages (or save your photos) once. Videos keep the captured content and its text exact; Photos can use those captures as references for the marketing edits you describe.",
  }]);
  const [stage, setStage] = useState<Stage>('awaiting_url');
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const selectJobId = (value: string | null) => {
    jobIdRef.current = value;
    setJobId(value);
    // Remember the in-progress chat across a sign-in redirect (see
    // guestSession.ts) — harmless to also set this for already-signed-in
    // dashboard usage, it's just never read there.
    if (value) setActiveJobId(value);
  };
  const [mode, setMode] = useState<JobMode>('video');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallContext, setPaywallContext] = useState<string | undefined>();
  const [creditBalance, setCreditBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>('voice_music');
  const skipVoiceover = audioMode !== 'voice_music';
  const [narrationLanguage, setNarrationLanguage] = useState('en');
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [featuresText, setFeaturesText] = useState<string | null>(null);
  const [creativeBrief, setCreativeBrief] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [outputQuality, setOutputQuality] = useState<'1080p' | '4k'>('1080p');
  const [frameRate, setFrameRate] = useState<30 | 60>(30);
  const [activeCaptureMetadata, setActiveCaptureMetadata] = useState<CaptureMetadata | null>(null);
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<string[]>([]);
  const selectionKeyRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pollNoticeRef = useRef(false);
  const workflowReadyRef = useRef(!resumeJobId && !initialJobId);

  const pollingActive = stage === 'capturing' || stage === 'storyboarding' || stage === 'rendering';
  const { job, error: pollError } = useJobPolling(jobId, pollingActive);
  const estimatedCredits = estimateRenderCredits(mode, skipVoiceover, job?.storyboard?.targetDurationSeconds || durationSeconds, job?.storyboard?.outputQuality ?? outputQuality);
  const estimatedShortfall = Math.max(0, estimatedCredits - creditBalance);

  // A fresh job (new capture, reuse, regenerate) always starts cancellable
  // again — never leave the Stop button disabled because of a previous job.
  useEffect(() => { setCancelling(false); }, [jobId]);

  useEffect(() => watchAuthState((user) => {
    setIsSignedIn(!!user);
    if (!user) { setIsAdmin(false); setCreditBalance(0); return; }
    void fetchMe().then((me) => { setIsAdmin(me.isAdmin); setCreditBalance(me.creditsBalance); }).catch(() => { setIsAdmin(false); });
  }), []);

  function restoreWorkflow(saved: JobStatusResponse): JobWorkflowState | null {
    const localWorkflow = loadLocalJobWorkflow(saved.id);
    const serverWorkflow = normalizeJobWorkflow(saved.workflowState);
    const workflow = (localWorkflow?.savedAt ?? 0) > (serverWorkflow?.savedAt ?? 0)
      ? localWorkflow
      : (serverWorkflow ?? localWorkflow);
    if (workflow) {
      setMode(workflow.mode);
      setDurationSeconds(workflow.durationSeconds);
      setFeaturesText(workflow.featuresText);
      setCreativeBrief(workflow.creativeBrief);
      setAspectRatio(workflow.aspectRatio);
      setOutputQuality(workflow.outputQuality);
      setFrameRate(workflow.frameRate);
      setSelectedCaptureIds(workflow.selectedCaptureIds);
      setAudioMode(workflow.audioMode);
      setNarrationLanguage(workflow.narrationLanguage);
    } else {
      setMode(saved.mode);
      if (saved.storyboard?.targetDurationSeconds) setDurationSeconds(saved.storyboard.targetDurationSeconds);
      if (saved.storyboard?.aspectRatio) setAspectRatio(saved.storyboard.aspectRatio);
      if (saved.storyboard?.outputQuality) setOutputQuality(saved.storyboard.outputQuality);
      if (saved.storyboard?.frameRate) setFrameRate(saved.storyboard.frameRate);
      if (saved.storyboard?.creativeBrief !== undefined) setCreativeBrief(saved.storyboard.creativeBrief ?? null);
      if (saved.storyboard?.selectedCaptureIds) setSelectedCaptureIds(saved.storyboard.selectedCaptureIds);
    }
    if (saved.captureMetadata) {
      const allIds = captureMediaItems(saved.captureMetadata).map((item) => item.id).slice(0, 30);
      selectionKeyRef.current = `${saved.id}:${allIds.join('|')}`;
      if (!workflow?.selectedCaptureIds.length && !saved.storyboard?.selectedCaptureIds?.length) setSelectedCaptureIds(allIds);
    }
    return workflow;
  }

  // Save immediately in the browser and shortly afterward on the job itself.
  // The browser copy covers abrupt refresh/sign-out; the server copy makes the
  // same unfinished step available on another device.
  useEffect(() => {
    if (!jobId || stage === 'awaiting_url' || !workflowReadyRef.current) return;
    const workflowState: JobWorkflowState = {
      savedAt: Date.now(), stage, mode, durationSeconds, featuresText, creativeBrief, aspectRatio, outputQuality, frameRate,
      selectedCaptureIds, audioMode, narrationLanguage,
    };
    saveLocalJobWorkflow(jobId, workflowState);
    const timer = window.setTimeout(() => void saveJobWorkflow(jobId, workflowState).catch(() => {}), 180);
    return () => window.clearTimeout(timer);
  }, [jobId, stage, mode, durationSeconds, featuresText, creativeBrief, aspectRatio, outputQuality, frameRate, selectedCaptureIds, audioMode, narrationLanguage]);

  useEffect(() => {
    const metadata = activeCaptureMetadata ?? job?.captureMetadata;
    if (!jobId || !metadata) return;
    const ids = captureMediaItems(metadata).map((item) => item.id).slice(0, 30);
    const key = `${jobId}:${ids.join('|')}`;
    if (selectionKeyRef.current === key) return;
    selectionKeyRef.current = key;
    setSelectedCaptureIds(ids);
  }, [jobId, job?.captureMetadata, activeCaptureMetadata]);

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
      setActiveCaptureMetadata(saved.captureMetadata);
      setMode(initialMode ?? saved.mode);
      capturedRef.current = true;
      const transcript: Message[] = (Array.isArray(saved.messages) ? saved.messages : []).map((message) => ({
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
        } else if (initialMode === 'icon') {
          setAspectRatio('1:1'); setOutputQuality('1080p'); setFrameRate(30);
          reopenedMessages.push({ id: nextId(), role: 'bot', content: 'Your captured brand and website icon are ready. Add an optional icon direction, or let the AI choose the strongest four concepts.' });
          setStage('awaiting_brief');
        } else {
          reopenedMessages.push({ id: nextId(), role: 'bot', content: 'Your saved website capture is ready—no rescan needed. How long should this production be?' });
          setStage('awaiting_duration');
        }
      } else {
        reopenedMessages.push({ id: nextId(), role: 'bot', content: 'Saved capture loaded. What would you like to create from it?' });
        setStage('awaiting_mode');
      }
      workflowReadyRef.current = true;
      setMessages(reopenedMessages);
      onJobCreated?.(saved.id);
    }).catch(() => {
      workflowReadyRef.current = true;
      pushBot('We could not reopen that saved capture. Please choose another chat or start a new one.');
      setStage('failed');
    });
    return () => { cancelled = true; };
  }, [initialJobId, initialMode]);

  // Resume stage: reopen an existing job (any status — still in progress,
  // already completed, or failed) exactly where it left off, instead of
  // routing back through mode/duration/format selection like initialJobId
  // does. This is what lets a user switch to another chat mid-generation and
  // come back to find the live progress (or finished result) still there,
  // rather than landing on a different summary-style view.
  useEffect(() => {
    if (!resumeJobId) return;
    let cancelled = false;
    void fetchJob(resumeJobId).then((saved) => {
      if (cancelled) return;
      selectJobId(saved.id);
      setActiveCaptureMetadata(saved.captureMetadata);
      const workflow = restoreWorkflow(saved);
      const resumedStage = resolveResumeStage(saved, workflow);

      const transcript: Message[] = (Array.isArray(saved.messages) ? saved.messages : []).map((message) => ({
        id: message.id,
        role: message.role === 'user' ? 'user' : 'bot',
        content: message.content,
      }));
      const rebuilt: Message[] = [...transcript];
      if (saved.captureMetadata) {
        rebuilt.push({ id: nextId(), role: 'bot', content: <SiteCard sourceUrl={saved.sourceUrl} metadata={saved.captureMetadata} /> });
      }
      if (saved.storyboard) {
        rebuilt.push({ id: nextId(), role: 'bot', content: storyboardSummaryMessage(saved, saved.mode, saved.storyboard.aspectRatio ?? '16:9', saved.storyboard.frameRate ?? 30) });
      }

      // Mark the effects that would otherwise fire on a live transition as
      // already-handled for whichever milestones this job already passed,
      // so resuming doesn't replay bubbles the saved transcript already has.
      capturedRef.current = Boolean(saved.captureMetadata);
      storyboardedRef.current = Boolean(saved.storyboard);

      if (resumedStage === 'done') {
        renderedRef.current = true;
        rebuilt.push({ id: nextId(), role: 'bot', content: doneResultMessage(saved, () => setShowAuthModal(true)) });
        rebuilt.push({ id: nextId(), role: 'bot', content: 'What would you like to do next? You can reuse these saved screenshots and recordings without scanning again, or start with a different website.' });
        setMessages(rebuilt);
        setStage('done');
      } else if (resumedStage === 'failed') {
        renderedRef.current = true;
        rebuilt.push({
          id: nextId(), role: 'bot',
          content: saved.status === 'cancelled'
            ? 'Stopped — all reserved credits for this render were restored.'
            : (saved.errorMessage || "The render didn't finish. Try again or start over with a different URL."),
        });
        setMessages(rebuilt);
        setStage('failed');
      } else {
        const isProcessing = resumedStage === 'capturing' || resumedStage === 'storyboarding' || resumedStage === 'rendering';
        rebuilt.push({
          id: nextId(), role: 'bot',
          content: isProcessing
            ? 'Welcome back — this production kept running safely. Live progress is reconnected below.'
            : 'Welcome back — your unfinished choices were restored. Continue from the exact step below.',
        });
        setMessages(rebuilt);
        setStage(resumedStage);
      }
      workflowReadyRef.current = true;
      onJobCreated?.(saved.id);
    }).catch(() => {
      workflowReadyRef.current = true;
      pushBot('We could not reopen that chat. Please choose another chat or start a new one.');
      setStage('failed');
    });
    return () => { cancelled = true; };
  }, [resumeJobId]);
  useEffect(() => {
    if (stage !== 'capturing' || !job || job.id !== jobId || capturedRef.current) return;
    if (job.status === 'cancelled') {
      capturedRef.current = true;
      pushBot('Stopped — no credits were spent on this capture.');
      setCancelling(false);
      setStage('failed'); return;
    }
    if (job.status === 'failed') {
      capturedRef.current = true;
      pushBot(job.errorMessage || "We couldn't load that site. Check the URL and try again.");
      setStage('failed'); return;
    }
    if (job.captureMetadata) {
      capturedRef.current = true;
      setActiveCaptureMetadata(job.captureMetadata);
      pushBot(<SiteCard sourceUrl={job.sourceUrl} metadata={job.captureMetadata} />);
      if (job.sourceUrl.startsWith('upload://')) {
        pushBot('What do you want to generate?');
        setStage('awaiting_mode');
      } else {
        pushBot('Do you have screenshots of admin, account, checkout, or other private pages I could not open? Add them now so your creations can use those real screens, or continue with the captured public pages.');
        setStage('awaiting_private_pages');
      }
    }
  }, [job, stage]);

  // Storyboard stage
  const storyboardedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'storyboarding' || !job || job.id !== jobId || storyboardedRef.current) return;
    if (job.status === 'cancelled') {
      storyboardedRef.current = true;
      pushBot('Stopped — no credits were spent on planning.');
      setCancelling(false);
      setStage('failed'); return;
    }
    if (job.status === 'failed') {
      storyboardedRef.current = true;
      pushBot(job.errorMessage || "We couldn't prepare the edit plan this time. Your capture is safe — try the direction again.");
      setStage('awaiting_brief'); return;
    }
    if (job.storyboard) {
      storyboardedRef.current = true;
      pushBot(storyboardSummaryMessage(job, mode, aspectRatio, frameRate));
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
      pushBot(doneResultMessage(job, () => setShowAuthModal(true)));
      pushBot('What would you like to do next? You can reuse these saved screenshots and recordings without scanning again, or start with a different website.');
      setStage('done');
    } else if (job.status === 'cancelled') {
      renderedRef.current = true;
      pushBot('Stopped — all reserved credits for this render were restored.');
      setCancelling(false);
      setStage('failed');
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
    let normalized: string;
    try { normalized = normalizeWebsiteUrl(url); }
    catch (error) { pushBot(error instanceof Error ? error.message : 'Enter a valid website name.'); return; }
    pushUser(normalized);
    setActiveCaptureMetadata(null);
    setSelectedCaptureIds([]);
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

  function continueAfterPrivatePages() {
    pushUser('Continue with captured pages');
    pushBot('Great. What do you want to generate? You can still add your own creative prompt and photos during the next steps.');
    setStage('awaiting_mode');
  }

  async function performPrivatePageUpload(files: File[]) {
    if (!jobId) return false;
    setBusy(true);
    try {
      await claimJob(jobId).catch(() => ({ claimed: false }));
      const result = await uploadPrivatePages(jobId, files);
      const refreshed = await fetchJob(jobId).catch(() => null);
      if (refreshed?.captureMetadata) setActiveCaptureMetadata(refreshed.captureMetadata);
      pushUser(`Added ${result.added} private-page screenshot${result.added === 1 ? '' : 's'}`);
      pushBot('Private pages added securely to this project. What do you want to generate?');
      setStage('awaiting_mode');
      return true;
    } catch (err) { pushBot(errorMessage(err)); return false; }
    finally { setBusy(false); }
  }

  async function handlePrivatePageUpload(files: File[]) {
    if (!jobId) return false;
    if (!isSignedIn) {
      // Resume the authenticated operation directly. React's auth-state update
      // can land one render after AuthModal's callback, so re-entering this
      // guard from that callback could otherwise reopen the modal.
      const pendingJobId = jobId;
      pendingActionRef.current = () => void performPrivatePageUpload(files).then((succeeded) => {
        if (succeeded) void clearPhotoDraft(`private-pages-${pendingJobId}`).catch(() => {});
      });
      setShowAuthModal(true);
      return false;
    }
    return performPrivatePageUpload(files);
  }

  async function handlePhotoUploadSubmit(files: File[]) {
    setActiveCaptureMetadata(null);
    setSelectedCaptureIds([]);
    pushUser(`📷 Uploaded ${files.length} photo${files.length === 1 ? '' : 's'}`);
    setBusy(true);
    capturedRef.current = false;
    setStage('capturing');
    try {
      const res = await uploadPhotos(files);
      selectJobId(res.jobId);
      onJobCreated?.(res.jobId);
      pushBot('Saving your photos…');
      return true;
    } catch (err) {
      pushBot(errorMessage(err));
      setStage('awaiting_url');
      return false;
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
    } else if (selected === 'icon') {
      setAspectRatio('1:1');
      setOutputQuality('1080p');
      setFrameRate(30);
      pushBot('I’ll create four square website-icon concepts from the real captured brand, colors, logo and what the site does. Add an optional direction, or let the AI choose the strongest brand-suitable designs.');
      setStage('awaiting_brief');
    } else {
      const mediaCount = captureMediaItems(activeCaptureMetadata ?? job?.captureMetadata).length;
      const recommended = Math.min(240, Math.max(8, mediaCount * 8));
      pushBot(mediaCount > 1
        ? `I found ${mediaCount} usable photos/pages. For one complete scene per item, I recommend ${durationLabel(recommended)}. You can use that length, choose a shorter focus selection, or set any custom duration in 8-second steps.`
        : 'Choose the video length. You can use a preset or set a custom duration from 8 seconds to 4 minutes.');
      setStage('awaiting_duration');
    }
  }

  function handleDurationSelect(seconds: number, label: string) {
    if (selectedCaptureIds.length === 0) {
      pushBot('Choose at least one photo or screenshot before setting the video length.');
      return;
    }
    pushUser(label);
    setDurationSeconds(seconds);
    const dedicatedScenes = seconds / 8;
    if (selectedCaptureIds.length > dedicatedScenes) {
      pushBot(`This ${durationLabel(seconds)} version has ${dedicatedScenes} scenes for ${selectedCaptureIds.length} selected items. The AI will focus on the strongest ${dedicatedScenes}; return to media selection if you want different priorities.`);
    } else {
      pushBot(`Your ${durationLabel(seconds)} plan has ${dedicatedScenes} complete AI-video scenes. Choose the delivery format next. 1080p costs 1 credit per second; 4K costs 3 credits per second.`);
    }
    setStage('awaiting_format');
  }

  function askForBrief() {
    if (mode === 'photos') {
      pushBot('Describe what you want the marketing photos to become. You can ask for a product ad, new background, luxury studio, lifestyle scene, social-media creative, seasonal campaign, lighting change, or another edit. I’ll use the captured website images as the real brand/product references. If website UI appears in a result, its existing text must stay faithful to the capture.');
    } else if (mode === 'icon') {
      pushBot('Describe any icon direction you want—minimal, dimensional, geometric, elegant, bold, or based on a real initial—or let the AI create the best four directions for this website.');
    } else if (mode === 'both') {
      pushBot('Describe the campaign direction once. Tell me what the video should emphasize and what you want the marketing photos to look like. The video will be generated by AI from your real captured website states, with visible UI text, products, prices, and branding required to stay faithful to those references; the photos may be creatively edited from the same brand/product references.');
    } else if (mode === 'demo') {
      pushBot('Describe the campaign direction if you want to steer it — a feature, product, journey, atmosphere, or cinematic treatment to emphasize. I’ll generate a true AI cinematic brand film grounded in your real logo, products, UI, and captured brand content — or let the studio choose the strongest direction automatically.');
    } else if (mode === 'mockup') {
      pushBot('Anything you want emphasized in the reveal — which pages/panels to lead with, a title/brand card to close on, or a specific mood (bold, playful, minimal)? I’ll generate a fast, scroll-stopping flip-through from your real captured pages — or let the studio pick the strongest sequence automatically.');
    } else if (mode === 'custom') {
      pushBot('This one is fully your idea — describe exactly the video you want: the story, the mood, what should happen in it. Be as specific as you like. I’ll direct real AI-generated video around your real captures/photos to bring it to life.');
    } else {
      pushBot('Everything important is already set. Add one optional instruction if you want to emphasize a page, product, real user action, feature, pacing, or cinematic style — or let the studio choose the strongest AI-video direction from the saved website states automatically.');
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
        : mode === 'icon'
          ? 'Planning four distinct square icon concepts from the website’s real identity, captured icon/logo, colors, purpose, and your direction.'
        : mode === 'both'
          ? 'Planning one campaign: a true AI-generated website video grounded in your saved screenshots and interaction states, plus creative marketing photos based on the same brand/product references.'
          : mode === 'demo'
            ? 'Planning a true AI-generated cinematic brand film grounded in your real logo, products, UI, and captured brand content. Each scene will be generated as video rather than created by moving screenshots with code.'
            : mode === 'mockup'
              ? 'Planning a fast, AI-generated social-feed-style reveal of your real pages/photos — the flip-through style used to advertise products and digital downloads on TikTok, Reels, and Pinterest.'
              : mode === 'custom'
                ? 'Planning your custom concept as real AI-generated video, grounded in your captured pages/photos.'
                : 'Planning true AI-generated video scenes from your real saved website captures. Each scene uses a real screenshot/state as grounding, and supported interactions can use real before/after states. The smooth-scroll recording stays separate. Visible UI text, prices, products, and branding must stay faithful to the captured website.'
    );
    try {
      const requestedJobId = jobId;
      const response = await requestStoryboard(requestedJobId, mode, vibe, durationSeconds, featuresText ?? undefined, {
        creativeBrief: (briefOverride === undefined ? creativeBrief : briefOverride) ?? undefined,
        aspectRatio,
        outputQuality,
        frameRate,
        selectedCaptureIds,
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
        sceneCount={Array.isArray(sb?.scenes) ? sb.scenes.length : 3}
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
    const sceneCount = Array.isArray(sb?.scenes) ? sb.scenes.length : 3;
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

  /**
   * Stops an in-progress capture/plan/render. The backend settles the job
   * cooperatively (refunding any spent credits along the way) — this just
   * requests it and gives immediate visual feedback while that happens.
   */
  async function handleCancelJob() {
    if (!jobId || cancelling) return;
    setCancelling(true);
    try {
      await cancelJob(jobId);
    } catch (err) {
      pushBot(errorMessage(err));
      setCancelling(false);
    }
    // Left true until the job's status flips (polling will show 'cancelled'
    // within a couple of seconds); the effects above reset stage/UI then.
  }

  async function handleGenerate() {
    if (!jobId) return;
    if (!isSignedIn) {
      pendingActionRef.current = () => handleGenerate();
      setShowAuthModal(true); return;
    }

    // Claim guest previews after sign-in, then ask the server for the exact
    // quote. This runs before any expensive provider call or credit mutation.
    try {
      await claimJob(jobId).catch(() => ({ claimed: false }));
      const quote = await requestRenderQuote(jobId, audioMode);
      setCreditBalance(quote.balance);
      if (!quote.affordable) {
        const context = `You need ${quote.shortfall} more credit${quote.shortfall === 1 ? '' : 's'} for this ${durationLabel(quote.generatedSeconds)} production`;
        setPaywallContext(context);
        pushBot(`This production costs exactly ${quote.totalCredits} credits: ${quote.videoCredits} for video${quote.photoCredits ? `, ${quote.photoCredits} for the photo set` : ''}${quote.narrationCredits ? `, and ${quote.narrationCredits} for voice narration` : ''}. You have ${quote.balance}, so you need ${quote.shortfall} more. Nothing was charged. Choose fewer priority photos with a shorter duration, switch quality, or add credits.`);
        setShowPaywall(true);
        return;
      }
    } catch { /* The atomic server render gate remains the final authority. */ }

    setBusy(true);
    renderedRef.current = false;
    setStage('rendering');
    const isVideo = !isImageMode(mode);
    pushBot(
      mode === 'photos'
        ? 'Creating four marketing images from your saved website captures and the direction you described. Products and brand details stay anchored to the source; creative backgrounds and campaign styling follow your request. This usually takes a few minutes.'
        : mode === 'icon'
          ? 'Creating four polished square website-icon concepts. Each one uses a different professional direction while staying grounded in the real site, brand colors and captured mark.'
        : mode === 'both'
          ? `Creating both deliverables in parallel: a true AI-generated ${durationLabel(durationSeconds)} website video grounded in the selected site states, plus four AI marketing photos based on the captured brand/products.`
          : mode === 'demo'
            ? `Generating your ${durationLabel(durationSeconds)} cinematic brand film as true AI-video scenes, grounded in your selected real logo, products, UI, and captured brand content. Each scene receives its own role in the story so longer films stay varied instead of repeating the same content.`
            : isVideo && durationSeconds > 8
              ? `Generating your ${durationLabel(durationSeconds)} video as true AI-video scenes from the selected real website states. Important actions are planned to finish before a cut, and longer versions rotate through different pages, features, products, and actions instead of repeating one idea. The smooth-scroll recording remains separate.`
              : 'Generating a complete short AI-video beat from the strongest real website state. The key action is planned to finish inside the clip instead of being cut off, while visible UI text and brand details must stay faithful to the reference.'
    );
    try { await requestRender(jobId, audioMode, narrationLanguage); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_REQUIRED') {
        setStage('ready_to_render');
        showLockedTeaser();
      } else if (err instanceof ApiError && err.code === 'INSUFFICIENT_CREDITS') {
        const required = estimateRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality);
        const shortfall = Math.max(0, required - creditBalance);
        setPaywallContext(`Add ${shortfall} credit${shortfall === 1 ? '' : 's'} to generate this saved production`);
        pushBot(`This production needs ${required} credits. You have ${creditBalance}, so you need ${shortfall} more. Nothing was charged and your project is saved. Choose a shorter version, reduce the selected media, or add credits.`);
        setStage('ready_to_render');
        setShowPaywall(true);
      } else {
        pushBot(errorMessage(err));
        setStage('ready_to_render');
      }
    } finally { setBusy(false); }
  }

  function handleStartOver() {
    if (jobId) clearLocalJobWorkflow(jobId);
    clearActiveJobId();
    void clearPhotoDraft('new-photo-project').catch(() => {});
    selectJobId(null); setBusy(false);
    capturedRef.current = false; storyboardedRef.current = false; renderedRef.current = false;
    setMode('video'); setAudioMode('voice_music'); setNarrationLanguage('en'); setDurationSeconds(8); setFeaturesText(null); setCreativeBrief(null);
    setActiveCaptureMetadata(null); setSelectedCaptureIds([]); selectionKeyRef.current = ''; setPaywallContext(undefined);
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
    pushBot(isImageMode(mode)
      ? `Starting four fresh ${mode === 'icon' ? 'website-icon concepts' : 'marketing images'} from the same saved brand references. The previous result stays untouched.`
      : 'Starting a fresh AI-video version from the same saved screenshots and interaction states. I’ll create a new scene plan and new output file — the previous result stays untouched.');
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
        selectedCaptureIds,
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
    pushBot(isImageMode(mode)
      ? `Preparing a fresh ${mode === 'icon' ? 'website-icon' : 'marketing-image'} plan from your saved brand references…`
      : 'Preparing a fresh version from your saved screenshots so the next attempt uses a brand-new AI-video scene plan…');
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
        selectedCaptureIds,
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
          : previousMode === 'icon'
            ? 'Describe how you want the website icon changed—more minimal, bolder, more dimensional, a different silhouette, or closer to the existing mark. I’ll reuse the captured website identity and create four fresh concepts.'
          : previousMode === 'both'
            ? 'Describe what to change in the video and/or photos. The video will be regenerated by AI from the saved website screenshots and interaction states; the marketing photos can be creatively regenerated from the saved brand/product references.'
            : previousMode === 'demo'
              ? 'Describe what to change in the cinematic film — a different feature, product, journey, atmosphere, camera language, or mood. I’ll regenerate the AI-video scenes from your saved brand/product references without rescanning.'
              : 'Tell me what to change: pages, products, real actions, feature emphasis, scene order, timing, energy, format, or pacing. I’ll regenerate the AI-video scenes from the saved website states — no new link and no rescan.'
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
    <div className={`relative flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-panel/85 shadow-[0_30px_100px_-42px_rgba(139,92,246,.75)] backdrop-blur-xl ${className ?? ''}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet/10 to-transparent" />
      {/* Header */}
      <div className="relative flex items-center gap-3 border-b border-border bg-white/[.015] px-4 py-3.5 sm:px-5">
        <img src="/logo.svg" alt="" width={26} height={26} className="shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13.5px] font-semibold text-text-primary">AiWebVideo Studio</p>
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
            AI website video studio
          </p>
        </div>
        {jobId && (
          <div className="hidden items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold text-mint sm:flex">
            <span aria-hidden="true">✓</span> {mode === 'photos' ? 'Creative photo edits' : mode === 'icon' ? 'Website icon studio' : mode === 'both' ? 'AI video · creative photos' : mode === 'demo' ? 'AI cinematic film' : 'AI video · site-grounded'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-scroll relative flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
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
              onCancel={() => void handleCancelJob()}
              cancelling={cancelling}
            />
          </ChatBubble>
        )}
      </div>

      {/* Input area */}
      <div className="chat-scroll max-h-[72vh] shrink-0 space-y-2.5 overflow-y-auto border-t border-border bg-bg/35 p-3.5 sm:p-4">
        {stage === 'awaiting_url' && (
          <div className="space-y-2.5">
            <ChatInputBar prefix="https://" placeholder="yourwebsite" onSubmit={handleUrlSubmit} disabled={busy} />
            <div className="flex items-center gap-2.5 text-[11px] text-text-dim" aria-hidden="true">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <PhotoUploadPicker onSubmit={handlePhotoUploadSubmit} disabled={busy} isAdmin={isAdmin} draftKey="new-photo-project" />
          </div>
        )}
        {stage === 'awaiting_private_pages' && (
          <div className="space-y-2.5">
            <PhotoUploadPicker onSubmit={handlePrivatePageUpload} disabled={busy} isAdmin={isAdmin} draftKey={`private-pages-${jobId ?? 'pending'}`} title="Paste or add private/admin page screenshots" buttonLabel="Add" helper={isAdmin ? 'Administrator upload · add any number of authorized screenshots' : 'Paste with Ctrl+V / Cmd+V or choose screens you are authorized to use'} />
            <Button variant="secondary" size="md" className="w-full" onClick={continueAfterPrivatePages} disabled={busy}>Continue without private pages</Button>
          </div>
        )}
        {stage === 'awaiting_mode' && (
          <QuickReplyChips options={MODE_OPTIONS.map((o) => o.label)} onSelect={handleModeSelect} disabled={busy} />
        )}
        {stage === 'awaiting_duration' && (
          <MediaPlanningPanel
            metadata={activeCaptureMetadata ?? job?.captureMetadata}
            selectedIds={selectedCaptureIds}
            onSelectionChange={setSelectedCaptureIds}
            onChooseDuration={handleDurationSelect}
            creditBalance={creditBalance}
            isSignedIn={isSignedIn}
            disabled={busy}
          />
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
                : mode === 'icon'
                  ? 'Optional: e.g. elegant minimal symbol, use the real gold and cream palette, keep the existing L idea, no words…'
                : mode === 'both'
                  ? 'Optional: video focus + photo style, e.g. fast luxury video; create clean studio product ads from the captured products…'
                  : 'Optional: e.g. focus on dresses, make the pacing faster, show add-to-cart clearly, end on checkout…'}
              onSubmit={handleBriefSubmit}
              disabled={busy}
            />
          </>
        )}
        {stage === 'ready_to_render' && (
          <div className="space-y-2">
            {!isImageMode(mode) && (
              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant={audioMode === 'voice_music' ? 'primary' : 'secondary'} size="sm" onClick={() => setAudioMode('voice_music')} disabled={busy}>
                  Voice + music
                </Button>
                <Button variant={audioMode === 'music_only' ? 'primary' : 'secondary'} size="sm" onClick={() => setAudioMode('music_only')} disabled={busy}>
                  Music only · no talking
                </Button>
                <Button variant={audioMode === 'silent' ? 'primary' : 'secondary'} size="sm" onClick={() => setAudioMode('silent')} disabled={busy}>
                  Silent master
                </Button>
                {audioMode === 'voice_music' && <label className="sm:col-span-3"><span className="mb-1.5 block text-[11px] font-semibold text-text-muted">Speaking language · English is selected by default</span><select value={narrationLanguage} onChange={(event) => setNarrationLanguage(event.target.value)} className="w-full rounded-xl border border-border bg-panel px-3 py-2.5 text-xs text-text-primary"><option value="en">English</option><option value="ar">Arabic</option><option value="fr">French</option><option value="es">Spanish</option><option value="de">German</option><option value="it">Italian</option><option value="tr">Turkish</option><option value="hi">Hindi</option><option value="ur">Urdu</option><option value="pt">Portuguese</option><option value="ru">Russian</option><option value="zh">Chinese</option><option value="ja">Japanese</option><option value="ko">Korean</option></select></label>}
              </div>
            )}
            <div className={`rounded-xl border p-3 text-xs ${estimatedShortfall > 0 && isSignedIn ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-mint/20 bg-mint/5 text-text-muted'}`}>
              <p className="font-semibold text-text-primary">Exact production estimate · {estimatedCredits} credits</p>
              <p className="mt-1">{durationLabel(job?.storyboard?.targetDurationSeconds || durationSeconds)} · {job?.storyboard?.outputQuality === '4k' || outputQuality === '4k' ? '3 credits per generated second at 4K' : '1 credit per generated second at 1080p'}{audioMode === 'voice_music' ? ' · voice +6 credits' : audioMode === 'music_only' ? ' · music only, no voice charge' : ' · silent, no voice charge'}.</p>
              {isSignedIn && <p className="mt-1 font-semibold">Balance: {creditBalance}{estimatedShortfall > 0 ? ` · add ${estimatedShortfall} more credits or choose a shorter version` : ' · enough to generate'}</p>}
            </div>
            <Button variant="primary" size="md" className="w-full" onClick={handleGenerate} disabled={busy}>
              {isSignedIn ? (estimatedShortfall > 0 ? `Add ${estimatedShortfall} credits to generate` : `Generate · ${estimatedCredits} credits`) : 'Sign in to generate'}
            </Button>
            {!isImageMode(mode) && <Button variant="secondary" size="sm" className="w-full" disabled={busy} onClick={() => { pushUser('Change selected media or video length'); pushBot('Choose the priority photos/pages again, then select a shorter or longer duration. I’ll create a fresh plan and recalculate the exact credits before generation.'); storyboardedRef.current = false; setStage('awaiting_duration'); }}>Change photos or duration</Button>}
            <Button
              variant="secondary" size="sm" className="w-full" disabled={busy}
              onClick={() => {
                storyboardedRef.current = false;
                pushBot(
                  mode === 'photos'
                    ? 'Describe the new marketing-photo direction you want. I’ll reuse the saved website images as references.'
                    : mode === 'icon'
                      ? 'Describe the new website-icon direction you want. I’ll reuse the captured brand, colors and original mark to create four fresh concepts.'
                    : mode === 'both'
                      ? 'Describe the new campaign direction. The video will be regenerated by AI from the saved website states; the photos can be creatively generated from the saved references.'
                      : mode === 'demo'
                        ? 'Describe the new cinematic direction you want, or use the best direction again. I’ll regenerate the scenes from your saved brand/product references.'
                        : 'Describe the change you want, or use the best direction again. The saved screenshots and real interaction states will be reused as grounding for a new AI-video version.'
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
            {activeCaptureMetadata && <Button variant="primary" size="md" className="w-full" onClick={() => void handleReuseCapture()} disabled={busy}>Reuse saved capture</Button>}
            <Button variant="secondary" size="md" className="w-full" onClick={handleStartOver} disabled={busy}>Use a new website</Button>
          </div>
        )}
      </div>

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          context={paywallContext}
          durationSeconds={job?.storyboard?.targetDurationSeconds || durationSeconds}
          mode={mode}
          outputQuality={job?.storyboard?.outputQuality ?? outputQuality}
          skipVoiceover={skipVoiceover}
          currentBalance={creditBalance}
          jobId={jobId}
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
