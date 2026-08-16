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

function getFirebaseAuth(): Auth {
  if (!cachedApp) cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!cachedAuth) cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

export async function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
}

export async function signInWithGithub() {
  return signInWithPopup(getFirebaseAuth(), new GithubAuthProvider());
}

export async function signInWithFacebook() {
  return signInWithPopup(getFirebaseAuth(), new FacebookAuthProvider());
}

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signOut() {
  // Also clear local token
  localStorage.removeItem('aiwebvideo_token');
  window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
  if (isFirebaseConfigured) return firebaseSignOut(getFirebaseAuth());
}

export function watchAuthState(callback: (user: User | null) => void) {
  if (typeof window === 'undefined') { callback(null); return () => {}; }
  const localUser = () => {
    const token = localStorage.getItem('aiwebvideo_token');
    return token ? { uid: 'local', email: 'local@local.com' } as unknown as User : null;
  };
  let firebaseUser: User | null = null;
  const emit = () => callback(localUser() ?? firebaseUser);
  const unsubscribe = isFirebaseConfigured
    ? onAuthStateChanged(getFirebaseAuth(), (user) => { firebaseUser = user; emit(); })
    : () => {};
  const onLocalChange = () => emit();
  window.addEventListener('aiwebvideo-auth-changed', onLocalChange);
  // When Firebase is configured, wait for its first real auth result instead
  // of briefly reporting a signed-out state and flashing the guest page.
  if (localUser() || !isFirebaseConfigured) emit();
  return () => {
    unsubscribe();
    window.removeEventListener('aiwebvideo-auth-changed', onLocalChange);
  };
}

export async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // Check for local JWT token first (non-Firebase auth)
  const localToken = localStorage.getItem('aiwebvideo_token');
  if (localToken) return localToken;
  if (!isFirebaseConfigured) return null;
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}
