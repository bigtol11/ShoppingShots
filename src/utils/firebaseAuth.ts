import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { firebaseConfig } from '../firebaseConfig';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// Opens the Google account picker popup and returns a fresh Firebase ID token for the
// signed-in Google account. The backend verifies this token and checks it against
// ALLOWED_EMAILS before issuing our own session cookie — see /api/auth/google in server.ts.
export async function signInWithGoogle(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user.getIdToken();
}
