import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getStorage, type Storage } from 'firebase-admin/storage';

let firebaseApp: App | undefined;

function getFirebaseApp(): App {
  if (getApps().length === 0) {
    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET || 'f3-nation-auth.firebasestorage.app';

    // Check for service account JSON in environment variable (for local dev)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebaseApp = initializeApp({
          credential: cert(serviceAccount),
          storageBucket,
        });
      } catch (error) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON');
      }
    } else {
      // In Firebase App Hosting, Application Default Credentials are automatically available
      firebaseApp = initializeApp({
        storageBucket,
      });
    }
  }
  return firebaseApp || getApps()[0];
}

export function getFirebaseStorage(): Storage {
  return getStorage(getFirebaseApp());
}

export const PROFILE_PICTURES_PATH = 'profile-pictures';
export const PROFILE_PICTURE_FILENAME = 'avatar.webp';
