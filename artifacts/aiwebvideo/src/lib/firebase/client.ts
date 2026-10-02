import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { forgetAccountOnSignOut, reconcileAccount } from '../accountScope';
import { detectInAppBrowser } from '../inAppBrowser';
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type Auth,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let serverSyncedUid: string | null = null;
let serverSyncPromise: Promise<boolean> | null = null;
let cookieBlocked = false;

/** True when the server accepted a sign-in but the browser refused to keep the login cookie. */
export function sessionCookieBlocked(): boolean { return cookieBlocked; }

function getFirebaseAuth(): Auth {
  if (!cachedApp) cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!cachedAuth) cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

// Reasons a sign-in pop-up cannot open (typical inside in-app browsers). A full-page redirect usually still works.
const POPUP_UNAVAILABLE = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported']);

async function providerPopup(provider: GoogleAuthProvider | GithubAuthProvider | FacebookAuthProvider) {
  const auth = getFirebaseAuth();
  // Make provider state explicitly durable. This matters when the OAuth popup
  // completes while AiWebVideo is backgrounded or the user changes tabs.
  try { await setPersistence(auth, browserLocalPersistence); } catch { /* restricted storage: Firebase uses what it can */ }
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? '';
    // Providers refuse to sign people in from inside most embedded browsers, so a redirect would only fail later.
    if (POPUP_UNAVAILABLE.has(code) && !detectInAppBrowser()?.providerSignInBlocked) {
      try {
        await signInWithRedirect(auth, provider);   // leaves the page; the result is picked up when it returns
        return await new Promise<never>(() => {});
      } catch { /* redirect not possible either: report the original problem */ }
    }
    throw error;
  }
}

export async function signInWithGoogle() {
  return providerPopup(new GoogleAuthProvider());
}

export async function signInWithGithub() {
  return providerPopup(new GithubAuthProvider());
}

export async function signInWithFacebook() {
  return providerPopup(new FacebookAuthProvider());
}

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signOut() {
  if (isFirebaseConfigured) await firebaseSignOut(getFirebaseAuth());
  if (serverSyncPromise) await serverSyncPromise.catch(() => false);
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error('Could not sign out. Please try again.');
  serverSyncedUid = null;
  localStorage.removeItem('aiwebvideo_token');
  // The next person on this browser must not see this account's project, drafts or waiting requests.
  forgetAccountOnSignOut();
  window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
}

export async function clearFirebaseIdentity() {
  if (isFirebaseConfigured && getFirebaseAuth().currentUser) await firebaseSignOut(getFirebaseAuth());
  if (serverSyncPromise) await serverSyncPromise.catch(() => false);
  serverSyncedUid = null;
}

/** Asks the server whether this browser really is signed in right now (the login cookie came back with the request). */
export async function verifyServerSession(): Promise<boolean> {
  return (await serverSession())?.active === true;
}

async function serverSession(): Promise<{ active: boolean; email: string | null } | null> {
  let legacyToken: string | null = null;
  try { legacyToken = localStorage.getItem('aiwebvideo_token'); } catch { /* storage blocked */ }
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: legacyToken ? { Authorization: `Bearer ${legacyToken}` } : undefined,
    });
    if (response.ok) {
      // /me refreshes a secure cookie, so the old browser-readable JWT is no
      // longer needed after one successful migration request.
      localStorage.removeItem('aiwebvideo_token');
      const account = await response.json().catch(() => ({})) as { email?: string };
      return { active: true, email: account.email?.toLowerCase() ?? null };
    }
    if (response.status === 401) localStorage.removeItem('aiwebvideo_token');
    return { active: false, email: null };
  } catch {
    // A temporary network failure does not invalidate a previously verified
    // cookie. Keep the workspace state until the server can answer again.
    return null;
  }
}

/**
 * Firebase can finish an OAuth sign-in even when the popup promise that opened
 * it is delayed by browser focus/COOP behavior. Bridge that durable Firebase
 * identity to AiWebVideo's HttpOnly server session independently of the modal
 * that started the login. This makes provider auth resilient to switching tabs,
 * backgrounding the page, or returning after the popup completed elsewhere.
 */
async function ensureFirebaseServerSession(user: User): Promise<boolean> {
  if (serverSyncedUid === user.uid) return true;
  if (serverSyncPromise) return serverSyncPromise;

  serverSyncPromise = (async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/auth/firebase', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) return false;
      serverSyncedUid = user.uid;
      localStorage.removeItem('aiwebvideo_token');
      return true;
    } catch {
      return false;
    } finally {
      serverSyncPromise = null;
    }
  })();

  return serverSyncPromise;
}

export function watchAuthState(callback: (user: User | null) => void) {
  if (typeof window === 'undefined') { callback(null); return () => {}; }
  let stopped = false;
  let revision = 0;
  let firebaseReady = !isFirebaseConfigured;
  let lastVerified = false;
  let answered = false;
  const deliver = (user: User | null) => { answered = true; callback(user); };

  const refreshServerSession = async () => {
    try {
      await refreshServerSessionUnsafe();
    } catch {
      // Whatever went wrong, the page must learn an answer instead of waiting forever.
      if (!answered && !stopped) deliver(null);
    }
  };

  const refreshServerSessionUnsafe = async () => {
    const currentRevision = ++revision;
    if (!firebaseReady) return;
    let session = await serverSession();
    if (stopped || currentRevision !== revision) return;

    // If Firebase completed provider auth while the popup promise was delayed,
    // establish the server cookie here instead of depending on AuthModal still
    // being mounted/focused. Never creates a second provider login request.
    let currentFirebaseUser: User | null = null;
    try { currentFirebaseUser = isFirebaseConfigured ? getFirebaseAuth().currentUser : null; } catch { /* Firebase unavailable here: the server session is enough */ }
    const providerEmail = currentFirebaseUser?.email?.toLowerCase() ?? null;
    const sessionBelongsToAnotherAccount = Boolean(session?.active && providerEmail && session.email && session.email !== providerEmail);
    if (currentFirebaseUser && (session?.active === false || sessionBelongsToAnotherAccount)) {
      serverSyncedUid = null;
      const synced = await ensureFirebaseServerSession(currentFirebaseUser);
      // The server answering "ok" is not enough: some browsers silently drop the login cookie. Only a follow-up
      // request that the cookie actually authenticates proves the person is signed in.
      const confirmed = synced ? await serverSession() : null;
      const cookieStuck = confirmed?.active === true;
      if (synced && !cookieStuck) { cookieBlocked = true; serverSyncedUid = null; }
      session = { active: cookieStuck, email: cookieStuck ? providerEmail : null };
      if (stopped || currentRevision !== revision) return;
    }

    // A Firebase identity alone is not a usable AiWebVideo session. Wait for
    // the server cookie before showing Workspace or starting paid work.
    if (session === null) {
      if (!lastVerified) deliver(null);
      return;
    }
    lastVerified = session.active;
    // A different account replacing the previous one on this browser starts clean.
    if (session.active) reconcileAccount(session.email);
    deliver(session.active ? { uid: 'server-session', email: session.email } as User : null);
  };

  let unsubscribe: () => void = () => {};
  try {
    if (isFirebaseConfigured) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
        firebaseReady = true;
        if (!user) serverSyncedUid = null;
        void refreshServerSession();
      });
    }
  } catch {
    firebaseReady = true;   // Firebase could not start here; the server session does not depend on it
  }
  // Firebase can be slow or stuck inside restricted browsers (its own storage is limited there). The login cookie does
  // not depend on it, so after a moment ask the server directly, and never leave the page without an answer.
  const readyTimer = window.setTimeout(() => { if (!firebaseReady && !stopped) { firebaseReady = true; void refreshServerSession(); } }, 3500);
  const answerTimer = window.setTimeout(() => { if (!answered && !stopped) deliver(null); }, 7000);

  const onLocalChange = () => {
    void refreshServerSession();
  };
  const onResume = () => {
    void refreshServerSession();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') onResume();
  };

  // A page restored from the browser's back/forward cache (typical when returning to an app tab) shows OLD state until
  // told to look again; coming back online is the same.
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onResume(); };

  window.addEventListener('aiwebvideo-auth-changed', onLocalChange);
  window.addEventListener('focus', onResume);
  window.addEventListener('online', onResume);
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('visibilitychange', onVisibilityChange);
  void refreshServerSession();

  return () => {
    stopped = true;
    revision++;
    window.clearTimeout(readyTimer);
    window.clearTimeout(answerTimer);
    window.removeEventListener('online', onResume);
    window.removeEventListener('pageshow', onPageShow);
    unsubscribe();
    window.removeEventListener('aiwebvideo-auth-changed', onLocalChange);
    window.removeEventListener('focus', onResume);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

export async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // Legacy migration only. New sessions are sent automatically as HttpOnly
  // cookies and can never be read by application JavaScript.
  const localToken = localStorage.getItem('aiwebvideo_token');
  if (localToken) return localToken;
  if (!isFirebaseConfigured) return null;
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}
