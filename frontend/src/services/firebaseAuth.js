import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDLrSMt5noG_OYhFBRvROuprghNz6cjR_I',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'kyrovia-8dd36.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kyrovia-8dd36',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'kyrovia-8dd36.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '595080680859',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:595080680859:web:1fe5e86a1fc24d6fe53d3e'
};

function requireFirebaseWebConfig() {
  if (!firebaseConfig.apiKey || !firebaseConfig.appId) {
    throw new Error('Firebase Google sign-in needs VITE_FIREBASE_API_KEY and VITE_FIREBASE_APP_ID.');
  }
}

function getFirebaseAuth() {
  requireFirebaseWebConfig();

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  return provider;
}

let redirectResultPromise = null;

export async function completeGoogleRedirectSignIn() {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(getFirebaseAuth())
      .then((result) => (result?.user ? result.user.getIdToken() : null))
      .catch((error) => {
        redirectResultPromise = null;
        throw error;
      });
  }

  return redirectResultPromise;
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = createGoogleProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user.getIdToken();
  } catch (error) {
    const redirectFallbackErrors = new Set([
      'auth/popup-blocked',
      'auth/operation-not-supported-in-this-environment',
      'auth/web-storage-unsupported'
    ]);

    if (!redirectFallbackErrors.has(error?.code)) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return null;
  }
}

export async function restoreGoogleSignIn() {
  const session = await restoreGoogleSession();
  return session?.idToken || null;
}

export async function restoreGoogleSession() {
  const auth = getFirebaseAuth();
  const user = await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe();
      resolve(currentUser);
    });
  });

  if (!user) {
    return null;
  }

  return {
    idToken: await user.getIdToken(),
    uid: user.uid
  };
}

export async function signOutGoogle() {
  if (!getApps().length) {
    return;
  }

  await signOut(getAuth(getApps()[0]));
}
