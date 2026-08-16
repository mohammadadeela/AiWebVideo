import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearActiveJobId } from '@/lib/guestSession';

interface Props { children: ReactNode; }
interface State { failed: boolean; error: string | null; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { failed: true, error: error?.message || 'Unexpected interface error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] recovered from an unexpected render error', error, info.componentStack);
  }

  private recover = async () => {
    clearActiveJobId();
    // Remove only browser-side AiWebVideo recovery data. Account projects,
    // uploaded server files, credits, and running jobs are never touched.
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith('aiwebvideo_workflow_')) localStorage.removeItem(key);
      }
      indexedDB.deleteDatabase('aiwebvideo-local-drafts');
    } catch { /* continue with the safe navigation even in private mode */ }
    window.history.replaceState({}, '', '/dashboard');
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5">
        <section className="w-full max-w-md rounded-3xl border border-border bg-panel p-7 text-center shadow-2xl">
          <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 font-display text-xl font-bold text-text-primary">The workspace needs a quick reset</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">Your uploaded files and server-side generation are safe. Reset the screen, then reopen the project from Your chats to continue or view the finished result.</p>
          {this.state.error && <details className="mt-4 rounded-xl border border-border bg-bg/40 p-3 text-left text-[10px] text-text-dim"><summary className="cursor-pointer font-semibold text-text-muted">Technical error details</summary><p className="mt-2 break-words font-mono">{this.state.error}</p></details>}
          <button type="button" onClick={this.recover} className="premium-button mt-6 w-full rounded-xl bg-signature px-4 py-3 text-sm font-semibold text-white">Reset screen safely</button>
          <a href="/" className="mt-3 block text-xs font-semibold text-violet hover:underline">Return to homepage</a>
        </section>
      </main>
    );
  }
}
