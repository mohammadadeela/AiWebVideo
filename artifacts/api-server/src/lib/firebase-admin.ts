import { applicationDefault, cert, getApp, getApps, initializeApp, type Credential } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _auth: Auth | null = null;
let _initialized = false;

export function getFirebaseAuth(): Auth | null {
  if (_initialized) return _auth;
  _initialized = true;

  const cred = process.env.FIREBASE_ADMIN_CREDENTIAL_JSON;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!cred && !projectId && !(clientEmail && privateKey)) {
    console.warn('[firebase-admin] Not configured — Firebase auth verification disabled.');
    return null;
  }

  try {
    let credential: Credential;
    if (cred) {
      credential = cert(JSON.parse(cred));
    } else if (projectId && clientEmail && privateKey) {
      credential = cert({ projectId, clientEmail, privateKey });
    } else {
      credential = applicationDefault();
    }

    const app = getApps().length ? getApp() : initializeApp({ credential, projectId });
    _auth = getAuth(app);
    return _auth;
  } catch (err) {
    console.error('[firebase-admin] Init failed:', (err as Error).message);
    return null;
  }
}
