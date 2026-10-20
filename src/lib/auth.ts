import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { ADMIN_EMAIL, DEFAULT_ADMIN_CODE, passwordFromCode } from './config';

export class AuthFailure extends Error {
  constructor(message: string, readonly kind: 'denied' | 'locked' | 'network' | 'config' | 'invalid') {
    super(message);
  }
}

const codeOf = (e: unknown): string => (typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '');
const BAD_CREDENTIAL = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'];

const denied = () => new AuthFailure('Incorrect code.', 'denied');

function mapError(e: unknown): AuthFailure {
  const c = codeOf(e);
  if (BAD_CREDENTIAL.includes(c)) return denied();
  if (c === 'auth/too-many-requests') return new AuthFailure('Too many attempts. Try again in a few minutes.', 'locked');
  if (c === 'auth/configuration-not-found') return new AuthFailure('Firebase Authentication is not set up. In Firebase Console, enable Email/Password under Authentication > Sign-in method.', 'config');
  if (c === 'auth/unauthorized-domain') return new AuthFailure('This site domain is not authorized. Add it under Firebase Authentication > Settings > Authorized domains.', 'config');
  if (c === 'auth/invalid-api-key') return new AuthFailure('The Firebase API key is invalid. Check the web app configuration.', 'config');
  if (c === 'auth/operation-not-allowed') return new AuthFailure('Enable Email/Password sign-in in Firebase Authentication.', 'config');
  if (c === 'auth/network-request-failed') return new AuthFailure('Network error. Check your connection and try again.', 'network');
  if (c === 'auth/weak-password') return new AuthFailure('Code is too weak.', 'invalid');
  return new AuthFailure('Could not sign in. Try again.', 'network');
}

export async function signInAdmin(code: string): Promise<void> {
  const password = passwordFromCode(code);
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  } catch (e) {
    if (!BAD_CREDENTIAL.includes(codeOf(e))) throw mapError(e);
    // First-time setup: the admin account does not exist yet, so the initial code creates it.
    if (code !== DEFAULT_ADMIN_CODE) throw denied();
    try {
      await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    } catch (e2) {
      throw codeOf(e2) === 'auth/email-already-in-use' ? denied() : mapError(e2);
    }
  }
}

export async function changeAdminCode(currentCode: string, newCode: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) throw new AuthFailure('Sign in again to change the code.', 'denied');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(ADMIN_EMAIL, passwordFromCode(currentCode)));
    await updatePassword(user, passwordFromCode(newCode));
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, passwordFromCode(newCode));
  } catch (e) {
    throw mapError(e);
  }
}

export const signOutAdmin = () => signOut(auth);

export function subscribeAdmin(cb: (isAdmin: boolean) => void): () => void {
  return onAuthStateChanged(auth, (user: User | null) => cb(user?.email === ADMIN_EMAIL));
}
