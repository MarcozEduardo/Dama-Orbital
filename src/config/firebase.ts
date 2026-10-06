import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import {
  connectDatabaseEmulator,
  getDatabase,
  type Database,
} from "firebase/database";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";

const env = import.meta.env;

export const firebaseOptions: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export const missingFirebaseVariables = required.filter((key) => !env[key]?.trim());
export const isFirebaseConfigured = missingFirebaseVariables.length === 0;
export const turnCredentialEndpoint = env.VITE_TURN_CREDENTIAL_ENDPOINT?.trim() || null;
export const firebaseFunctionsRegion =
  env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || "us-central1";
export const firebaseFunctionsEnabled =
  env.VITE_FIREBASE_FUNCTIONS_ENABLED === "true";
export const trysteroFirebasePath =
  env.VITE_TRYSTERO_FIREBASE_PATH?.trim() || "__trystero_damas_orbitais__";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let sessionPromise: Promise<FirebaseSession> | null = null;
let emulatorsConnected = false;
let appCheckInitialized = false;

export interface FirebaseSession {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
  user: User;
}

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super(`Firebase não configurado: ${missingFirebaseVariables.join(", ")}`);
    this.name = "FirebaseNotConfiguredError";
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new FirebaseNotConfiguredError();
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseOptions);
  return app;
}

function attachAppCheck(nextApp: FirebaseApp) {
  const siteKey = env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (
    appCheckInitialized ||
    !siteKey ||
    env.VITE_USE_FIREBASE_EMULATORS === "true"
  ) {
    return;
  }
  initializeAppCheck(nextApp, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInitialized = true;
}

function attachEmulators(nextAuth: Auth, nextDatabase: Database) {
  if (emulatorsConnected || env.VITE_USE_FIREBASE_EMULATORS !== "true") return;

  connectAuthEmulator(
    nextAuth,
    env.VITE_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099",
    { disableWarnings: true },
  );
  connectDatabaseEmulator(
    nextDatabase,
    env.VITE_FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1",
    Number(env.VITE_FIREBASE_DATABASE_EMULATOR_PORT || 9000),
  );
  emulatorsConnected = true;
}

function waitForInitialAuth(nextAuth: Auth): Promise<User | null> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      nextAuth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });
}

/**
 * Inicializa Firebase apenas quando o modo online for usado. Assim o jogo
 * local continua funcionando sem credenciais e sem custo de boot remoto.
 */
export function ensureFirebaseSession(): Promise<FirebaseSession> {
  if (!isFirebaseConfigured) return Promise.reject(new FirebaseNotConfiguredError());
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const nextApp = getFirebaseApp();
    attachAppCheck(nextApp);
    auth ??= getAuth(nextApp);
    database ??= getDatabase(nextApp);
    attachEmulators(auth, database);

    await setPersistence(auth, browserLocalPersistence);
    const existing = auth.currentUser ?? (await waitForInitialAuth(auth));
    const user = existing ?? (await signInAnonymously(auth)).user;
    return { app: nextApp, auth, database, user };
  })().catch((error) => {
    sessionPromise = null;
    throw error;
  });

  return sessionPromise;
}

export function firebaseReadiness() {
  return {
    configured: isFirebaseConfigured,
    missing: [...missingFirebaseVariables],
    turnConfigured: Boolean(turnCredentialEndpoint),
    functionsEnabled: firebaseFunctionsEnabled,
    signalingPath: trysteroFirebasePath,
  };
}