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
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    // Local cleanup still completes if the network is temporarily unavailable.
  }
  serverSyncedUid = null;
  localStorage.removeItem('aiwebvideo_token');
  if (isFirebaseConfigured) await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
  window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
}

async function hasServerSession(): Promise<boolean> {
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
    // Do not pretend a session exists when it could not be verified.
    return false;
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
  let serverReady = false;
  let firebaseReady = !isFirebaseConfigured;
  let serverUser: User | null = null;
  let firebaseUser: User | null = null;

  const emit = () => {
    if (!stopped && serverReady && firebaseReady) callback(serverUser ?? firebaseUser);
  };

  const refreshServerSession = async () => {
    let active = await hasServerSession();
    if (stopped) return;

    // If Firebase completed provider auth while the popup promise was delayed,
    // establish the server cookie here instead of depending on AuthModal still
    // being mounted/focused. Never creates a second provider login request.
    const currentFirebaseUser = isFirebaseConfigured ? getFirebaseAuth().currentUser : null;
    if (!active && currentFirebaseUser) {
      active = await ensureFirebaseServerSession(currentFirebaseUser);
      if (stopped) return;
    }

    serverUser = active ? { uid: 'server-session', email: null } as unknown as User : null;
    serverReady = true;
    emit();
  };

  const unsubscribe = isFirebaseConfigured
    ? onAuthStateChanged(getFirebaseAuth(), (user) => {
        firebaseUser = user;
        firebaseReady = true;
        if (!user) serverSyncedUid = null;
        // First emit can rely on the Firebase identity immediately; API calls
        // already carry its bearer token. Then refresh the server cookie in the
        // background so navigation/reloads remain authenticated as well.
        if (!serverReady) {
          serverReady = true;
          serverUser = null;
        }
        emit();
        if (user) {
          void ensureFirebaseServerSession(user).then(() => {
            if (stopped) return;
            serverReady = false;
            void refreshServerSession();
          });
        }
      })
    : () => {};

  const onLocalChange = () => {
    serverReady = false;
    void refreshServerSession();
  };
  const onResume = () => {
    if (!isFirebaseConfigured || !getFirebaseAuth().currentUser) return;
    serverReady = false;
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
