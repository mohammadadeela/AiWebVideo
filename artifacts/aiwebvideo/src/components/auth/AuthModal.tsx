import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/app-button';
import { Wordmark } from '@/components/ui/Wordmark';
import {
  signInWithGoogle,
  signInWithGithub,
  isFirebaseConfigured,
} from '@/lib/firebase/client';
import {
  ApiError, exchangeFirebaseToken, localLogin,
  requestSignupCode, verifySignupCode, resendSignupCode,
  requestPasswordResetCode, resetPasswordWithCode, claimJob,
} from '@/lib/api-client';
import { getActiveJobId } from '@/lib/guestSession';

type ProviderResult = { user?: { getIdToken?: () => Promise<string> } };

// Maps a Firebase Auth error code to a message someone can actually act on.
// The raw error is always logged to the console too, so a developer looking
// at devtools can see exactly what Firebase rejected (unauthorized domain,
// provider not enabled in the console, popup blocked, etc.) instead of
// staring at one generic sentence for every possible failure.
function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  const known: Record<string, string> = {
    'auth/unauthorized-domain': "This site's domain is not authorized for sign-in yet. An admin needs to add it under Firebase Console -> Authentication -> Settings -> Authorized domains.",
    'auth/operation-not-allowed': 'This sign-in method is not turned on yet. An admin needs to enable it under Firebase Console -> Authentication -> Sign-in method.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing. Please try again.',
    'auth/cancelled-popup-request': 'The sign-in window was closed before finishing. Please try again.',
    'auth/network-request-failed': 'We could not reach the sign-in service. Please check your connection and try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    'auth/invalid-api-key': 'Sign-in is not configured correctly for this site yet.',
    'auth/configuration-not-found': 'Sign-in is not configured correctly for this site yet.',
  };
  return known[code] ?? 'We could not complete sign-in. Please try again or use email instead.';
}

export function AuthModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void | Promise<void> }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify' | 'forgot' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);
  // Bumped on every provider sign-in attempt so a stale popup promise (or a
  // stale abandon-timeout) from an earlier click can recognize it's no
  // longer the current attempt and avoid touching state for it.
  const providerAttempt = useRef(0);

  // After any successful sign-in/sign-up, hand off (best-effort) whatever
  // chat/job the visitor was working on before they authenticated.
  async function finishSignIn() {
    const pendingJobId = getActiveJobId();
    if (pendingJobId) {
      try { await claimJob(pendingJobId); } catch { /* non-fatal -- dashboard still resumes via ?job= */ }
    }
    await onSignedIn();
  }

  function startResendCooldown() {
    setResendCooldown(60);
    if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    cooldownTimer.current = window.setInterval(() => {
      setResendCooldown((value) => {
        if (value <= 1 && cooldownTimer.current) window.clearInterval(cooldownTimer.current);
        return Math.max(0, value - 1);
      });
    }, 1000);
  }

  async function handleProvider(fn: () => Promise<unknown>) {
    setError(null);
    if (!isFirebaseConfigured) {
      setError('Google and GitHub sign-in are not configured in this build. Add the Firebase VITE_ variables to the root .env.local and rebuild.');
      return;
    }
    setLoading(true);
    const attemptId = ++providerAttempt.current;
    const isCurrent = () => attemptId === providerAttempt.current;

    // The one place that actually finishes sign-in on success — runs
    // whenever the popup promise resolves, whether that's right away or
    // later than the abandon-detection below gives up waiting for it.
    (fn() as Promise<ProviderResult>).then(
      async (result) => {
        if (!isCurrent()) return;
        try {
          const idToken = await result.user?.getIdToken?.();
          if (!idToken) throw new Error('The provider did not return a valid session.');
          await exchangeFirebaseToken(idToken);
          await finishSignIn();
        } catch (err) {
          if (!isCurrent()) return;
          console.error('[auth] provider sign-in failed:', err);
          setError(firebaseErrorMessage(err));
          setLoading(false);
        }
      },
      (err) => {
        if (!isCurrent()) return;
        console.error('[auth] provider sign-in failed:', err);
        setError(firebaseErrorMessage(err));
        setLoading(false);
      },
    );

    // Escape hatch for a real browser bug: some browsers (Chrome's default
    // Cross-Origin-Opener-Policy on accounts.google.com's popup — see
    // firebase/firebase-js-sdk#6716) never resolve *or* reject Firebase's
    // popup promise if someone closes the popup manually instead of
    // finishing sign-in, leaving Sign in stuck disabled until a full page
    // refresh. window.blur/focus (not visibilitychange — a popup doesn't
    // hide this tab, it just steals OS focus) tells us when focus returns
    // to this tab after the popup took it. We give the real promise a
    // short grace period to still land normally, then stop spinning so the
    // person can try again — the handler above will still quietly finish
    // sign-in if that promise resolves a moment later after all.
    await new Promise<void>((resolve) => {
      let blurred = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
        resolve();
      };
      const onBlur = () => { blurred = true; };
      const onFocus = () => {
        if (!blurred) return; // only once focus actually left and came back
        window.setTimeout(finish, 2000);
      };
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);
      window.setTimeout(finish, 45_000); // hard backstop regardless of focus events
    });
    if (isCurrent()) setLoading(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'signup') {
        // Step 1: request a verification code, then move to the code step.
        await requestSignupCode(normalizedEmail, password);
        setMode('verify');
        setNotice(`We sent a 6-digit code to ${normalizedEmail}. It expires in 10 minutes.`);
        startResendCooldown();
      } else {
        await localLogin(normalizedEmail, password);
        await finishSignIn();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_EXISTS') {
        setError('An account already uses this email. Choose Sign in instead.');
      } else if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setError('That email or password is incorrect. Please check both and try again.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(mode === 'signup'
          ? 'We could not create that account. Check the email and use at least 8 password characters.'
          : 'We could not sign you in right now. Please try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await verifySignupCode(normalizedEmail, code.trim());
      await finishSignIn();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CODE_EXPIRED') {
        setError('That code expired. Send a new one below.');
      } else if (err instanceof ApiError && err.code === 'CODE_INVALID') {
        setError('That code is incorrect. Please check your email and try again.');
      } else if (err instanceof ApiError && err.code === 'CODE_LOCKED') {
        setError('Too many incorrect attempts. Send a new code below.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('We could not verify that code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await resendSignupCode(normalizedEmail);
      setNotice(`We sent a new code to ${normalizedEmail}.`);
      startResendCooldown();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not resend a code. Please try again.');
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await requestPasswordResetCode(normalizedEmail);
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setMode('reset');
      setNotice(`If a password account exists for ${normalizedEmail}, we sent a 6-digit reset code. It expires in 10 minutes.`);
      startResendCooldown();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not start the password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await resetPasswordWithCode(normalizedEmail, code.trim(), password);
      setMode('signin');
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setNotice('Password updated successfully. Sign in with your new password.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESET_CODE_EXPIRED') {
        setError('That reset code expired. Request a new one below.');
      } else if (err instanceof ApiError && err.code === 'RESET_CODE_INVALID') {
        setError('That reset code is incorrect. Please check your email and try again.');
      } else if (err instanceof ApiError && err.code === 'RESET_CODE_LOCKED') {
        setError('Too many incorrect attempts. Request a new reset code.');
      } else if (err instanceof ApiError && err.code === 'PASSWORD_REUSED') {
        setError('Choose a password you have not used recently.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('We could not reset your password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetResend() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await requestPasswordResetCode(normalizedEmail);
      setNotice(`If a password account exists for ${normalizedEmail}, we sent a new reset code.`);
      startResendCooldown();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not resend the reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Rendered via a portal straight onto document.body — this dialog can be
  // opened from inside the sticky header (which gets a backdrop-blur once
  // the page scrolls) or from inside animated chat cards. Both apply a CSS
  // filter/transform to themselves, and per the CSS spec that makes them the
  // containing block for any `position: fixed` descendant — so without the
  // portal, this modal would be positioned relative to that ancestor instead
  // of the viewport, and only look right when no such ancestor was active
  // (e.g. before scrolling).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true">
      <div className="chat-scroll max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-panel p-4 animate-fade-in-up sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <Wordmark />
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-text-dim hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
          >
            ✕
          </button>
        </div>

        <h2 className="mb-1 font-display text-lg font-bold text-text-primary">
          {mode === 'signin' ? 'Sign in to unlock'
            : mode === 'signup' ? 'Create your account'
              : mode === 'verify' ? 'Check your email'
                : mode === 'forgot' ? 'Forgot your password?'
                  : 'Create a new password'}
        </h2>
        <p className="mb-5 text-sm text-text-muted">
          {mode === 'verify'
            ? 'Enter the 6-digit code we just emailed you to finish creating your account.'
            : mode === 'forgot'
              ? 'Enter your email and we will send you a 6-digit password reset code.'
              : mode === 'reset'
                ? 'Enter the reset code from your email and choose a new password.'
                : 'Save your projects, manage production credits, and download completed work in full quality.'}
        </p>

        {(mode === 'signin' || mode === 'signup') && (
          <>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full" onClick={() => handleProvider(signInWithGoogle)} disabled={loading}>
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => handleProvider(signInWithGithub)} disabled={loading}>
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                Continue with GitHub
              </Button>
            </div>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-text-dim">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {mode === 'verify' ? (
          <form onSubmit={handleVerifySubmit} className="space-y-2">
            <input
              name="verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-center text-lg tracking-[0.4em] text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            {notice && !error && <p className="text-xs text-mint">{notice}</p>}
            {error && <p className="text-xs text-pink">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading || code.length !== 6}>
              Verify and create account
            </Button>
            <button type="button" onClick={handleResend} disabled={resendCooldown > 0} className="mt-1 w-full rounded text-center text-xs text-text-muted hover:text-text-primary disabled:opacity-50">
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </form>
        ) : mode === 'forgot' ? (
          <form onSubmit={handleForgotSubmit} className="space-y-2">
            <input
              name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            {notice && !error && <p className="text-xs text-mint">{notice}</p>}
            {error && <p className="text-xs text-pink">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              Send reset code
            </Button>
          </form>
        ) : mode === 'reset' ? (
          <form onSubmit={handleResetSubmit} className="space-y-2">
            <input
              name="username" type="email" autoComplete="username" readOnly value={email}
              aria-label="Account email"
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            <input
              name="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
              placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-center text-lg tracking-[0.4em] text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            <div className="relative">
              <input
                name="new-password" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password"
                placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel-alt py-2.5 pl-3.5 pr-11 text-base text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-text-muted hover:text-text-primary">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              name="new-password-confirmation" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password"
              placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            {notice && !error && <p className="text-xs text-mint">{notice}</p>}
            {error && <p className="text-xs text-pink">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading || code.length !== 6}>
              Reset password
            </Button>
            <button type="button" onClick={handleResetResend} disabled={loading || resendCooldown > 0} className="mt-1 w-full rounded text-center text-xs text-text-muted hover:text-text-primary disabled:opacity-50">
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend reset code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-2">
            <input
              name="username" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            <div className="relative">
              <input
                name={mode === 'signin' ? 'password' : 'new-password'}
                type={showPassword ? 'text' : 'password'} required minLength={mode === 'signup' ? 8 : 1} maxLength={128}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel-alt py-2.5 pl-3.5 pr-11 text-base text-text-primary placeholder:text-text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-text-muted transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === 'signin' && (
              <button type="button" onClick={() => { setMode('forgot'); setError(null); setNotice(null); setPassword(''); }} className="w-full rounded text-right text-xs font-medium text-violet hover:underline">
                Forgot password?
              </button>
            )}
            {notice && !error && <p className="text-xs text-mint">{notice}</p>}
            {error && <p className="text-xs text-pink">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {mode === 'signin' ? 'Sign in' : 'Send verification code'}
            </Button>
          </form>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null); setNotice(null); setShowPassword(false); setPassword('');
            }}
            className="mt-4 w-full rounded text-center text-xs text-text-muted hover:text-text-primary"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        )}
        {mode === 'verify' && (
          <button onClick={() => { setMode('signup'); setError(null); setNotice(null); setCode(''); }} className="mt-4 w-full rounded text-center text-xs text-text-muted hover:text-text-primary">
            Use a different email
          </button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <button onClick={() => { setMode('signin'); setError(null); setNotice(null); setCode(''); setPassword(''); setConfirmPassword(''); }} className="mt-4 w-full rounded text-center text-xs text-text-muted hover:text-text-primary">
            Back to sign in
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
