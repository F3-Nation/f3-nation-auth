import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getStorage, type Storage } from 'firebase-admin/storage';

let firebaseApp: App | undefined;

function getFirebaseApp(): App {
  if (getApps().length === 0) {
    // In Firebase App Hosting, Application Default Credentials are automatically available
    // For local development, set GOOGLE_APPLICATION_CREDENTIALS env var to service account JSON path
    firebaseApp = initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'f3-nation-auth.firebasestorage.app',
    });
  }
  return firebaseApp || getApps()[0];
}

export function getFirebaseStorage(): Storage {
  return getStorage(getFirebaseApp());
}

export const PROFILE_PICTURES_PATH = 'profile-pictures';
export const PROFILE_PICTURE_FILENAME = 'avatar.webp';
