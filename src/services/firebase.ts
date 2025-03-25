import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, UserCredential, onAuthStateChanged, Auth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, Firestore, DocumentReference } from 'firebase/firestore';
import { PlayerProfile } from '../playerProfile';

// Check if running in renderer process (no direct access to process.env)
const isRenderer = (typeof window !== 'undefined' && window.process === undefined);

// Check if we're in a test environment
const isTestEnvironment = 
  (typeof process !== 'undefined' && 
   (process.env?.NODE_ENV === 'test' || process.env?.JEST_WORKER_ID !== undefined));

// Firebase configuration - will be populated in different ways depending on the context
let firebaseConfig: any;

// Initialize with a placeholder config
if (isRenderer) {
  // In renderer process, we'll load the config later from the main process
  firebaseConfig = {};
} else {
  // In main process, use environment variables
  firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  };
}

// Only log Firebase config in non-test environments
if (!isTestEnvironment && !isRenderer) {
  console.log('Firebase initialized with config:', {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    measurementId: firebaseConfig.measurementId
  });
}

// Create mock objects for test environment
const mockApp: FirebaseApp = {
  name: '[DEFAULT]',
  options: firebaseConfig,
  automaticDataCollectionEnabled: false
};

const mockAuth: Auth = {
  app: mockApp,
  name: 'auth',
  config: {
    apiKey: 'mock-api-key',
    apiHost: 'mock-host',
    apiScheme: 'https',
    tokenApiHost: 'mock-token-host',
    sdkClientVersion: 'mock-version'
  },
  currentUser: null,
  languageCode: null,
  tenantId: null,
  settings: { appVerificationDisabledForTesting: false },
  onAuthStateChanged: () => { /* empty auth state change handler */ return () => { /* empty cleanup function */ }; },
  onIdTokenChanged: () => { /* empty token change handler */ return () => { /* empty cleanup function */ }; },
  setPersistence: () => { /* empty persistence setter */ return Promise.resolve(); },
  signOut: () => { /* empty sign out function */ return Promise.resolve(); },
  updateCurrentUser: () => { /* empty user update function */ return Promise.resolve(); },
  beforeAuthStateChanged: () => { /* empty before auth state change handler */ return () => { /* empty cleanup function */ }; },
  authStateReady: () => { /* empty auth state ready function */ return Promise.resolve(); },
  emulatorConfig: null,
  useDeviceLanguage: function () { /* empty language setter */ }
};

const mockFirestore = {
  type: 'firestore',
  app: mockApp,
  toJSON: () => ({})
} as unknown as Firestore;

const mockDocRef = {
  id: 'mock-doc-id',
  path: 'playerProfiles/mock-user-id',
  type: 'document',
  firestore: mockFirestore,
  parent: null,
  converter: null,
  withConverter: () => mockDocRef
} as unknown as DocumentReference;

// Initialize Firebase objects - these will be populated later if in renderer context
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Initialize objects now if not in renderer process
if (!isRenderer) {
  app = isTestEnvironment ? mockApp : initializeApp(firebaseConfig);
  auth = isTestEnvironment ? mockAuth : getAuth(app);
  db = isTestEnvironment ? mockFirestore : getFirestore(app);
}

// Hardcoded credentials as requested
const HARDCODED_EMAIL = 'mariocatch@gmail.com';
const HARDCODED_PASSWORD = 'gibson15';

// Track if Firestore operations are available
let firestoreAvailable = false; // Start with false until authentication confirms access
let authInitialized = false;
let configLoaded = !isRenderer; // If not in renderer, config is already loaded

/**
 * Set the Firebase configuration (for renderer process)
 */
export const setFirebaseConfig = (config: any): void => {
  if (isRenderer && !configLoaded) {
    firebaseConfig = config;
    
    // Initialize Firebase with the provided config
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    configLoaded = true;
    console.log('Firebase config set in renderer process');
  }
};

/**
 * Ensure Firebase is initialized
 */
const ensureInitialized = async (): Promise<void> => {
  if (isRenderer && !configLoaded) {
    try {
      // In renderer process, get config from the main process
      const config = await window.electronAPI.getFirebaseConfig();
      setFirebaseConfig(config);
    } catch (error) {
      console.error('Failed to get Firebase config:', error);
    }
  }
};

/**
 * Initialize Firebase authentication and verify Firestore access
 * @param email User's email address
 * @param password User's password 
 */
export const initializeFirebase = async (email?: string, password?: string): Promise<boolean> => {
  // Ensure Firebase is initialized first
  await ensureInitialized();
  
  if (isTestEnvironment) {
    // Return false in test environment (use local storage only)
    authInitialized = true;
    firestoreAvailable = false;
    return false;
  }

  if (authInitialized) {
    return firestoreAvailable;
  }

  try {
    // Only attempt authentication if credentials are explicitly provided
    if (email && password) {
      // Authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Successfully authenticated with Firebase');
      console.log('User:', userCredential.user.email);

      // Then verify Firestore access
      try {
        // Check if the user's profile document can be accessed
        const docRef = doc(db, 'playerProfiles', email.replace(/[@.]/g, '_'));
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
    } else {
      // If no credentials provided, just initialize Firebase without authentication
      console.log('Firebase initialized without authentication');
      firestoreAvailable = false;
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
 * Authenticate with Firebase
 * @param email User's email address
 * @param password User's password
 * @returns Promise that resolves with authentication result
 */
export const authenticateWithFirebase = async (email?: string, password?: string): Promise<UserCredential> => {
  // Ensure Firebase is initialized first
  await ensureInitialized();
  
  if (isTestEnvironment) {
    // Return mock user credentials in test environment
    return {
      user: {
        email: email || 'test@example.com',
        uid: 'mock-user-id'
      }
    } as UserCredential;
  }

  // Require both email and password
  if (!email || !password) {
    throw new Error('Both email and password are required to authenticate');
  }

  console.log('Attempting to authenticate with Firebase');
  
  // Initialize Firebase with the provided credentials
  await initializeFirebase(email, password);
  
  return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Check if the current user is signed in
 * @returns Promise that resolves with auth state
 */
export const checkAuthState = (): Promise<boolean> => {
  if (isTestEnvironment) {
    // Always return true in test environment
    return Promise.resolve(true);
  }

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
  if (isTestEnvironment) {
    // Return null in test environment (use local storage or mock data)
    return null;
  }

  // Initialize Firebase if not already done
  if (!authInitialized) {
    await initializeFirebase();
  }

  if (!firestoreAvailable) {
    console.log('Firestore not available for loading - skipping remote load');
    return null;
  }

  try {
    // Get the current user's email
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      console.log('No authenticated user found, using default user ID');
      return null;
    }

    // Create user ID from email
    const userId = currentUser.email.replace(/[@.]/g, '_');
    
    console.log(`Loading player profile from Firestore for user: ${userId}`);
    const docRef = doc(db, 'playerProfiles', userId);
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
  if (isTestEnvironment) {
    // No-op in test environment
    return;
  }

  // Initialize Firebase if not already done
  if (!authInitialized) {
    await initializeFirebase();
  }

  if (!firestoreAvailable) {
    console.log('Firestore not available for saving - skipping remote save');
    return;
  }

  try {
    // Get the current user's email
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      console.log('No authenticated user found, cannot save profile');
      return;
    }

    // Create user ID from email
    const userId = currentUser.email.replace(/[@.]/g, '_');
    
    console.log(`Saving player profile to Firestore for user: ${userId}`);
    const docRef = doc(db, 'playerProfiles', userId);
    await setDoc(docRef, profile, { merge: true });
    console.log('Player profile saved to Firestore');
  } catch (error) {
    console.error('Error saving player profile to Firestore:', error);
    firestoreAvailable = false;
  }
};

// Export Firebase instances
export { app, auth, db }; 