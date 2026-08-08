import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/app-button';
import { Wordmark } from '@/components/ui/Wordmark';
import {
  signInWithGoogle,
  signInWithGithub,
  isFirebaseConfigured,
} from '@/lib/firebase/client';
import { ApiError, exchangeFirebaseToken, localLogin, localRegister } from '@/lib/api-client';

type ProviderResult = { user?: { getIdToken?: () => Promise<string> } };

export function AuthModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleProvider(fn: () => Promise<unknown>) {
    setError(null);
    setLoading(true);
    try {
      const result = await fn() as ProviderResult;
      const idToken = await result.user?.getIdToken?.();
      if (!idToken) throw new Error('The provider did not return a valid session.');
      await exchangeFirebaseToken(idToken);
      onSignedIn();
    } catch {
      setError('We could not complete sign-in. Please try again or use email instead.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'signup') {
        await localRegister(normalizedEmail, password);
      } else {
        await localLogin(normalizedEmail, password);
      }
      onSignedIn();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_EXISTS') {
        setError('An account already uses this email. Choose Sign in instead.');
      } else if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setError('That email or password is incorrect. Please check both and try again.');
      } else {
        setError(mode === 'signup'
          ? 'We could not create that account. Check the email and use at least 6 password characters.'
          : 'We could not sign you in right now. Please try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 animate-fade-in-up">
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
          {mode === 'signin' ? 'Sign in to unlock' : 'Create your account'}
        </h2>
        <p className="mb-5 text-sm text-text-muted">
          Save your projects, manage production credits, and download completed work in full quality.
        </p>

        {isFirebaseConfigured && (
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

        <form onSubmit={handleEmailSubmit} className="space-y-2">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-alt py-2.5 pl-3.5 pr-11 text-sm text-text-primary placeholder:text-text-dim
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-text-muted transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-pink">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setShowPassword(false);
          }}
          className="mt-4 w-full text-center text-xs text-text-muted hover:text-text-primary rounded"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
