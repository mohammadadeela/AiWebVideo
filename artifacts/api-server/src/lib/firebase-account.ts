/**
 * Decides which AiWebVideo account a verified Google/GitHub/Facebook sign-in belongs to.
 *
 * The users table has TWO unique keys (firebase_uid and email). Matching on only one of them made a
 * returning person crash into the other: a customer who first signed up with email + password and later
 * pressed "Continue with Google" for the SAME email hit a unique-email violation, got a 500 and saw only
 * a generic "could not complete sign-in". The rules below make that case link to the existing account.
 */
export interface AccountCandidate {
  id: string;
  email: string;
  firebase_uid: string | null;
  password_hash: string | null;
}

export type FirebaseAccountDecision<T extends AccountCandidate = AccountCandidate> =
  | { action: 'existing'; user: T }
  | { action: 'link'; user: T }
  | { action: 'create' }
  | { action: 'reject'; code: 'EMAIL_MISSING' | 'EMAIL_UNVERIFIED'; message: string; status: number };

export function decideFirebaseAccount<T extends AccountCandidate>(input: {
  byUid: T | null;
  byEmail: T | null;
  email: string;
  emailVerified: boolean;
}): FirebaseAccountDecision<T> {
  // The same Firebase identity signing in again is always the same account.
  if (input.byUid) return { action: 'existing', user: input.byUid };

  if (!input.email.trim()) {
    return {
      action: 'reject',
      code: 'EMAIL_MISSING',
      status: 400,
      message: 'This sign-in did not share an email address. Make your email visible to AiWebVideo in that account, or use another sign-in method.',
    };
  }

  if (input.byEmail) {
    // Never hand an existing account to someone who has not proven they own the email.
    if (!input.emailVerified) {
      return {
        action: 'reject',
        code: 'EMAIL_UNVERIFIED',
        status: 409,
        message: 'An account already exists for this email, but the provider has not verified it. Verify the email with the provider, or sign in with your password.',
      };
    }
    return { action: 'link', user: input.byEmail };
  }

  return { action: 'create' };
}

export function providerDisplayName(provider: string | null | undefined): string | null {
  const key = (provider ?? '').toLowerCase();
  if (key === 'google') return 'Google';
  if (key === 'github') return 'GitHub';
  if (key === 'facebook') return 'Facebook';
  return null;
}
