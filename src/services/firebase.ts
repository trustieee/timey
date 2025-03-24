import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, UserCredential, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { PlayerProfile } from '../playerProfile';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Log Firebase config (excluding sensitive data)
console.log('Firebase initialized with config:', {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  measurementId: firebaseConfig.measurementId
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Optionally try to enable offline persistence, wrapped in try/catch
// to handle environments where it's not supported
try {
  // Skip enabling IndexedDB persistence as it's not fully supported in Electron
  console.log('Skipping Firestore IndexedDB persistence due to compatibility issues in Electron');
} catch (err) {
  console.warn('Firestore offline persistence could not be enabled:', err);
}

// Hardcoded credentials as requested
const HARDCODED_EMAIL = 'mariocatch@gmail.com';
const HARDCODED_PASSWORD = 'gibson15';

// User ID from hardcoded email (removing @ and . for Firestore compatibility)
const USER_ID = HARDCODED_EMAIL.replace(/[@.]/g, '_');

// Track if Firestore operations are available
let firestoreAvailable = false; // Start with false until authentication confirms access
let authInitialized = false;

/**
 * Initialize Firebase authentication and verify Firestore access
 */
export const initializeFirebase = async (): Promise<boolean> => {
  if (authInitialized) {
    return firestoreAvailable;
  }

  try {
    // First authenticate the user
    const userCredential = await signInWithEmailAndPassword(auth, HARDCODED_EMAIL, HARDCODED_PASSWORD);
    console.log('Successfully authenticated with Firebase');
    console.log('User:', userCredential.user.email);
    
    // Then verify Firestore access
    try {
      // Check if the user's profile document can be accessed
      const docRef = doc(db, 'playerProfiles', USER_ID);
      await getDoc(docRef);
      console.log('Firestore access confirmed - remote storage is available');
      firestoreAvailable = true;
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        console.warn('Firestore permissions are insufficient - using local storage only');
        console.warn('Make sure to create a Firestore database and deploy proper security rules');
        firestoreAvailable = false;
      } else {
        console.error('Error checking Firestore access:', err);
        firestoreAvailable = false;
      }
    }
    
    authInitialized = true;
    return firestoreAvailable;
  } catch (error: any) {
    console.error('Firebase authentication failed:', error.code, error.message);
    console.warn('Falling back to local storage only');
    firestoreAvailable = false;
    authInitialized = true;
    return false;
  }
};

/**
 * Authenticate with Firebase using hardcoded credentials
 * @returns Promise that resolves with authentication result
 */
export const authenticateWithFirebase = async (): Promise<UserCredential> => {
  console.log('Attempting to authenticate with Firebase using hardcoded email');
  await initializeFirebase();
  return signInWithEmailAndPassword(auth, HARDCODED_EMAIL, HARDCODED_PASSWORD);
};

/**
 * Check if the current user is signed in
 * @returns Promise that resolves with auth state
 */
export const checkAuthState = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
};

/**
 * Load player profile from Firestore
 * @returns Promise that resolves with the player profile or null if not found
 */
export const loadPlayerProfileFromFirestore = async (): Promise<PlayerProfile | null> => {
  // Initialize Firebase if not already done
  if (!authInitialized) {
    await initializeFirebase();
  }
  
  if (!firestoreAvailable) {
    console.log('Firestore not available for loading - skipping remote load');
    return null;
  }

  try {
    console.log(`Loading player profile from Firestore for user: ${USER_ID}`);
    const docRef = doc(db, 'playerProfiles', USER_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('Player profile loaded from Firestore');
      return docSnap.data() as PlayerProfile;
    } else {
      console.log('No player profile found in Firestore');
      return null;
    }
  } catch (error) {
    console.error('Error loading player profile from Firestore:', error);
    firestoreAvailable = false;
    return null;
  }
};

/**
 * Save player profile to Firestore
 * @param profile The player profile to save
 * @returns Promise that resolves when the save is complete
 */
export const savePlayerProfileToFirestore = async (profile: PlayerProfile): Promise<void> => {
  // Initialize Firebase if not already done
  if (!authInitialized) {
    await initializeFirebase();
  }
  
  if (!firestoreAvailable) {
    console.log('Firestore not available for saving - skipping remote save');
    return;
  }

  try {
    console.log(`Saving player profile to Firestore for user: ${USER_ID}`);
    const docRef = doc(db, 'playerProfiles', USER_ID);
    await setDoc(docRef, profile, { merge: true });
    console.log('Player profile saved to Firestore');
  } catch (error) {
    console.error('Error saving player profile to Firestore:', error);
    firestoreAvailable = false;
  }
};

// Export Firebase instances
export { app, auth, db }; 