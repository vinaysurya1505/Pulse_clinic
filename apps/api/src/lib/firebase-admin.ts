import * as admin from 'firebase-admin';

let initialized = false;

export function initializeFirebaseAdmin(): admin.app.App {
  if (initialized) return admin.app();

  const isEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const hasCert = Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

  if (isEmulator || !hasCert) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-pulseclinic' });
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  initialized = true;
  return admin.app();
}

export function getFirestore(): admin.firestore.Firestore {
  if (!initialized) initializeFirebaseAdmin();
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  if (!initialized) initializeFirebaseAdmin();
  return admin.auth();
}
