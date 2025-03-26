import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  UserCredential,
  onAuthStateChanged,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Firestore,
  DocumentReference,
  onSnapshot,
} from "firebase/firestore";
import { PlayerProfile } from "../playerProfile";
import { firebaseConfig as hardcodedConfig } from "../config";

// Check if running in renderer process (no direct access to process.env)
const isRenderer =
  typeof window !== "undefined" && window.process === undefined;

// Check if we're in a test environment
const isTestEnvironment =
  typeof process !== "undefined" &&
  (process.env?.NODE_ENV === "test" ||
    process.env?.JEST_WORKER_ID !== undefined);

// Firebase configuration - will be populated in different ways depending on the context
let firebaseConfig: any;

// Initialize with a placeholder config
if (isRenderer) {
  // In renderer process, we'll load the config later from the main process
  firebaseConfig = {};
} else {
  // In main process, try environment variables first, then fall back to hardcoded config
  firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || hardcodedConfig.apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || hardcodedConfig.authDomain,
    projectId: process.env.FIREBASE_PROJECT_ID || hardcodedConfig.projectId,
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET || hardcodedConfig.storageBucket,
    messagingSenderId:
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      hardcodedConfig.messagingSenderId,
    appId: process.env.FIREBASE_APP_ID || hardcodedConfig.appId,
    measurementId:
      process.env.FIREBASE_MEASUREMENT_ID || hardcodedConfig.measurementId,
  };
}

// Only log Firebase config in non-test environments
if (!isTestEnvironment && !isRenderer) {
  console.log("Firebase initialized with config:", {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    measurementId: firebaseConfig.measurementId,
  });
}

// Create mock objects for test environment
const mockApp: FirebaseApp = {
  name: "[DEFAULT]",
  options: firebaseConfig,
  automaticDataCollectionEnabled: false,
};

const mockAuth: Auth = {
  app: mockApp,
  name: "auth",
  config: {
    apiKey: "mock-api-key",
    apiHost: "mock-host",
    apiScheme: "https",
    tokenApiHost: "mock-token-host",
    sdkClientVersion: "mock-version",
  },
  currentUser: null,
  languageCode: null,
  tenantId: null,
  settings: { appVerificationDisabledForTesting: false },
  onAuthStateChanged: () => {
    /* empty auth state change handler */ return () => {
      /* empty cleanup function */
    };
  },
  onIdTokenChanged: () => {
    /* empty token change handler */ return () => {
      /* empty cleanup function */
    };
  },
  setPersistence: () => {
    /* empty persistence setter */ return Promise.resolve();
  },
  signOut: () => {
    /* empty sign out function */ return Promise.resolve();
  },
  updateCurrentUser: () => {
    /* empty user update function */ return Promise.resolve();
  },
  beforeAuthStateChanged: () => {
    /* empty before auth state change handler */ return () => {
      /* empty cleanup function */
    };
  },
  authStateReady: () => {
    /* empty auth state ready function */ return Promise.resolve();
  },
  emulatorConfig: null,
  useDeviceLanguage: function () {
    /* empty language setter */
  },
};

const mockFirestore = {
  type: "firestore",
  app: mockApp,
  toJSON: () => ({}),
} as unknown as Firestore;

const mockDocRef = {
  id: "mock-doc-id",
  path: "playerProfiles/mock-user-id",
  type: "document",
  firestore: mockFirestore,
  parent: null,
  converter: null,
  withConverter: () => mockDocRef,
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

// Track if Firestore operations are available
let firestoreAvailable = false; // Start with false until authentication confirms access
let authInitialized = false;
let configLoaded = !isRenderer; // If not in renderer, config is already loaded

// Store the snapshot unsubscribe function
let profileSnapshotUnsubscribe: (() => void) | null = null;

// Create an event system for profile updates
let profileUpdateListeners: Array<(profile: PlayerProfile) => void> = [];

/**
 * Register a listener for profile updates
 * @param listener A function that will be called when the profile is updated
 * @returns A function to unregister the listener
 */
export const onProfileUpdate = (
  listener: (profile: PlayerProfile) => void
): (() => void) => {
  profileUpdateListeners.push(listener);
  return () => {
    profileUpdateListeners = profileUpdateListeners.filter(
      (l) => l !== listener
    );
  };
};

/**
 * Notify all registered listeners about a profile update
 * @param profile The updated profile
 */
const notifyProfileUpdate = (profile: PlayerProfile): void => {
  profileUpdateListeners.forEach((listener) => {
    try {
      listener(profile);
    } catch (err) {
      console.error("Error in profile update listener:", err);
    }
  });
};

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
    console.log("Firebase config set in renderer process");
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
      console.error("Failed to get Firebase config from main process:", error);
      // Use hardcoded config directly in case of error
      setFirebaseConfig(hardcodedConfig);
    }
  }
};

/**
 * Initialize Firebase authentication and verify Firestore access
 * @param email User's email address
 * @param password User's password
 */
export const initializeFirebase = async (
  email?: string,
  password?: string
): Promise<boolean> => {
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
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Successfully authenticated with Firebase");
      console.log("User:", userCredential.user.email);

      // Then verify Firestore access
      try {
        // Check if the user's profile document can be accessed
        const docRef = doc(db, "playerProfiles", email.replace(/[@.]/g, "_"));
        await getDoc(docRef);
        console.log("Firestore access confirmed - remote storage is available");
        firestoreAvailable = true;
      } catch (err: any) {
        if (err.code === "permission-denied") {
          console.warn(
            "Firestore permissions are insufficient - using local storage only"
          );
          console.warn(
            "Make sure to create a Firestore database and deploy proper security rules"
          );
          firestoreAvailable = false;
        } else {
          console.error("Error checking Firestore access:", err);
          firestoreAvailable = false;
        }
      }
    } else {
      // If no credentials provided, just initialize Firebase without authentication
      console.log("Firebase initialized without authentication");
      firestoreAvailable = false;
    }

    authInitialized = true;
    return firestoreAvailable;
  } catch (error: any) {
    console.error("Firebase authentication failed:", error.code, error.message);
    console.warn("Falling back to local storage only");
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
export const authenticateWithFirebase = async (
  email?: string,
  password?: string
): Promise<UserCredential> => {
  // Ensure Firebase is initialized first
  await ensureInitialized();

  if (isTestEnvironment) {
    // Return mock user credentials in test environment
    return {
      user: {
        email: email || "test@example.com",
        uid: "mock-user-id",
      },
    } as UserCredential;
  }

  // Require both email and password
  if (!email || !password) {
    throw new Error("Both email and password are required to authenticate");
  }

  console.log("Attempting to authenticate with Firebase");

  try {
    // First authenticate with Firebase Auth
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log("Successfully authenticated with Firebase Auth");

    // After successful authentication, we need to verify Firestore access
    try {
      // Create a Firestore user ID from email
      const userId = email.replace(/[@.]/g, "_");

      // Check if the user's profile document can be accessed
      const docRef = doc(db, "playerProfiles", userId);
      await getDoc(docRef);

      console.log(
        "Firestore access confirmed after authentication - remote storage is available"
      );
      firestoreAvailable = true;
    } catch (err: any) {
      if (err.code === "permission-denied") {
        console.warn(
          "Firestore permissions are insufficient - using local storage only"
        );
        firestoreAvailable = false;
      } else {
        console.error(
          "Error checking Firestore access after authentication:",
          err
        );
        firestoreAvailable = false;
      }
    }

    // Set authInitialized to true
    authInitialized = true;

    return result;
  } catch (error) {
    console.error("Firebase authentication failed:", error);
    firestoreAvailable = false;
    throw error;
  }
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
export const loadPlayerProfileFromFirestore =
  async (): Promise<PlayerProfile | null> => {
    // Ensure Firebase is initialized first
    await ensureInitialized();

    if (isTestEnvironment || !firestoreAvailable) {
      return null;
    }

    try {
      // Get the current user
      const user = auth.currentUser;
      if (!user || !user.email) {
        console.warn("No authenticated user available for loading profile");
        return null;
      }

      // Create a Firestore user ID from email
      const userId = user.email.replace(/[@.]/g, "_");

      // Get a reference to the user's profile document
      const docRef = doc(db, "playerProfiles", userId);

      // Get the document
      const docSnap = await getDoc(docRef);

      // If document exists, return the data
      if (docSnap.exists()) {
        const profileData = docSnap.data() as PlayerProfile;
        console.log("Loaded player profile from Firestore");

        // Set up real-time listener for profile updates if not already set up
        setupProfileListener(userId);

        return profileData;
      } else {
        console.log("No profile document found for the user");

        // Set up real-time listener for profile updates (for when it's created)
        setupProfileListener(userId);

        return null;
      }
    } catch (error) {
      console.error("Error loading player profile from Firestore:", error);
      return null;
    }
  };

/**
 * Set up a real-time listener for profile updates
 * @param userId The user's ID (email with @ and . replaced by _)
 */
const setupProfileListener = (userId: string): void => {
  // Clean up any existing listener
  if (profileSnapshotUnsubscribe) {
    profileSnapshotUnsubscribe();
    profileSnapshotUnsubscribe = null;
  }

  // Only set up a listener if Firestore is available
  if (!firestoreAvailable) {
    console.log("Firestore not available, skipping profile listener setup");
    return;
  }

  try {
    // Get a reference to the user's profile document
    const docRef = doc(db, "playerProfiles", userId);

    // Set up the real-time listener
    profileSnapshotUnsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const profileData = snapshot.data() as PlayerProfile;
          console.log("Real-time profile update received from Firestore");

          // Notify all listeners about the profile update
          notifyProfileUpdate(profileData);
        }
      },
      (error) => {
        console.error("Error in profile real-time listener:", error);
      }
    );

    console.log("Real-time profile listener set up for user:", userId);
  } catch (error) {
    console.error("Error setting up profile listener:", error);
  }
};

/**
 * Save player profile to Firestore
 * @param profile The player profile to save
 * @returns Promise that resolves when the save is complete
 */
export const savePlayerProfileToFirestore = async (
  profile: PlayerProfile
): Promise<void> => {
  if (isTestEnvironment) {
    // No-op in test environment
    return;
  }

  // Ensure Firebase is initialized first
  await ensureInitialized();

  try {
    // Check if we are authenticated and if Firestore is available
    if (!auth.currentUser) {
      console.log(
        "No authenticated user found, cannot save profile to Firestore"
      );
      return;
    }

    if (!firestoreAvailable) {
      console.log("Firestore connection not available, cannot save profile");
      return;
    }

    // Get the current user's email
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      console.log("No authenticated user found, cannot save profile");
      return;
    }

    // Create user ID from email
    const userId = currentUser.email.replace(/[@.]/g, "_");

    console.log(`Saving player profile to Firestore for user: ${userId}`);
    const docRef = doc(db, "playerProfiles", userId);
    await setDoc(docRef, profile, { merge: true });
  } catch (error) {
    console.error("Error saving player profile to Firestore:", error);
    firestoreAvailable = false;
  }
};

// Export Firebase instances
export { app, auth, db };
