import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
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

function getFirebaseAuth(): Auth {
  if (!cachedApp) cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!cachedAuth) cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

async function providerPopup(provider: GoogleAuthProvider | GithubAuthProvider | FacebookAuthProvider) {
  const auth = getFirebaseAuth();
  // Make provider state explicitly durable. This matters when the OAuth popup
  // completes while AiWebVideo is backgrounded or the user changes tabs.
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, provider);
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
  window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
}

export async function clearFirebaseIdentity() {
  if (isFirebaseConfigured && getFirebaseAuth().currentUser) await firebaseSignOut(getFirebaseAuth());
  if (serverSyncPromise) await serverSyncPromise.catch(() => false);
  serverSyncedUid = null;
}

async function hasServerSession(): Promise<boolean | null> {
  const legacyToken = localStorage.getItem('aiwebvideo_token');
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
      return true;
    }
    if (response.status === 401) localStorage.removeItem('aiwebvideo_token');
    return false;
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

  const refreshServerSession = async () => {
    const currentRevision = ++revision;
    if (!firebaseReady) return;
    let active = await hasServerSession();
    if (stopped || currentRevision !== revision) return;

    // If Firebase completed provider auth while the popup promise was delayed,
    // establish the server cookie here instead of depending on AuthModal still
    // being mounted/focused. Never creates a second provider login request.
    const currentFirebaseUser = isFirebaseConfigured ? getFirebaseAuth().currentUser : null;
    if (active === false && currentFirebaseUser) {
      serverSyncedUid = null;
      active = await ensureFirebaseServerSession(currentFirebaseUser);
      if (stopped || currentRevision !== revision || getFirebaseAuth().currentUser?.uid !== currentFirebaseUser.uid) return;
    }

    // A Firebase identity alone is not a usable AiWebVideo session. Wait for
    // the server cookie before showing Workspace or starting paid work.
    if (active === null) {
      if (!lastVerified) callback(null);
      return;
    }
    lastVerified = active;
    callback(active ? { uid: 'server-session', email: currentFirebaseUser?.email ?? null } as User : null);
  };

  const unsubscribe = isFirebaseConfigured
    ? onAuthStateChanged(getFirebaseAuth(), (user) => {
        firebaseReady = true;
        if (!user) serverSyncedUid = null;
        void refreshServerSession();
      })
    : () => {};

  const onLocalChange = () => {
    void refreshServerSession();
  };
  const onResume = () => {
    void refreshServerSession();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') onResume();
  };

  window.addEventListener('aiwebvideo-auth-changed', onLocalChange);
  window.addEventListener('focus', onResume);
  document.addEventListener('visibilitychange', onVisibilityChange);
  void refreshServerSession();

  return () => {
    stopped = true;
    revision++;
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
