import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearActiveJobId } from "@/lib/guestSession";
import { isStaleAssetError, reloadForNewVersion } from "@/lib/staleAssets";

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
  error: string | null;
  /** The page is an old version whose files were replaced by a newer deploy. */
  stale: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, error: null, stale: false };

  static getDerivedStateFromError(error: Error): State {
    return {
      failed: true,
      error: error?.message || "Unexpected interface error",
      stale: isStaleAssetError(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[ui] recovered from an unexpected render error",
      error,
      info.componentStack,
    );
    // An old tab after a new deploy: load the new version once, with nothing lost.
    if (isStaleAssetError(error)) reloadForNewVersion();
  }

  private recover = async () => {
    clearActiveJobId();
    // Remove only browser-side AiWebVideo recovery data. Account projects,
    // uploaded server files, credits, and running jobs are never touched.
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith("aiwebvideo_workflow_"))
          localStorage.removeItem(key);
      }
      indexedDB.deleteDatabase("aiwebvideo-local-drafts");
    } catch {
      /* continue with the safe navigation even in private mode */
    }
    window.history.replaceState({}, "", "/dashboard");
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    // Inline styles on purpose: this screen must stay readable even when the stylesheet itself failed to load.
    const page = { display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 20, background: "#0b0818", color: "#f4f1ff", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" } as const;
    const card = { width: "100%", maxWidth: 440, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#17112b", padding: 28, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,.55)" } as const;
    const button = { marginTop: 22, width: "100%", cursor: "pointer", border: 0, borderRadius: 12, padding: "13px 16px", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#8b5cf6,#ec4899)" } as const;
    return (
      <main style={page}>
        <section style={card}>
          <img src="/logo.svg" alt="" width={48} height={48} style={{ margin: "0 auto" }} />
          <h1 style={{ margin: "16px 0 0", fontSize: 20, fontWeight: 800 }}>
            {this.state.stale ? "A new version is ready" : "The workspace needs a quick reset"}
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "#b8b0d6" }}>
            {this.state.stale
              ? "AiWebVideo was just updated, and this page is the older version. Reload to continue. Nothing you saved or generated is lost."
              : "Your uploaded files and server-side generation are safe. Reset the screen, then reopen the project from Your productions to continue or view the finished result."}
          </p>
          {this.state.error && !this.state.stale && (
            <details style={{ marginTop: 16, textAlign: "left", fontSize: 11, color: "#9b93bd" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Technical error details</summary>
              <p style={{ marginTop: 8, wordBreak: "break-word", fontFamily: "ui-monospace, monospace" }}>{this.state.error}</p>
            </details>
          )}
          {this.state.stale ? (
            <button type="button" onClick={() => window.location.reload()} style={button}>Reload now</button>
          ) : (
            <button type="button" onClick={this.recover} style={button}>Reset screen safely</button>
          )}
          <a href="/" style={{ display: "block", marginTop: 12, fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>Return to homepage</a>
        </section>
      </main>
    );
  }
}
