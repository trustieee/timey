// Mock of firebase service for Jest testing
import { UserCredential } from 'firebase/auth';

// Mock app, auth, and db exports
export const app = {};
export const auth = {};
export const db = {};

// Mock for tracking if Firestore is available (always false in tests)
let firestoreAvailable = false;
let authInitialized = false;

// Mock user ID for consistency
export const USER_ID = 'mariocatch_gmail_com';

/**
 * Mock implementation of initializeFirebase
 */
export const initializeFirebase = jest.fn().mockImplementation(async () => {
  if (authInitialized) {
    return firestoreAvailable;
  }

  // Always succeed in test environment but don't enable Firestore
  console.log('Mock Firebase: Successfully authenticated');
  authInitialized = true;
  firestoreAvailable = false;
  return false;
});

/**
 * Mock implementation of authenticateWithFirebase
 */
export const authenticateWithFirebase = jest.fn().mockImplementation(async () => {
  console.log('Mock Firebase: Authenticating with Firebase');
  await initializeFirebase();

  // Return a minimal mock of UserCredential
  return {
    user: {
      email: 'mariocatch@gmail.com',
      uid: 'mock-user-id'
    }
  } as unknown as UserCredential;
});

/**
 * Mock implementation of checkAuthState
 */
export const checkAuthState = jest.fn().mockImplementation(() => {
  return Promise.resolve(true);
});

/**
 * Mock implementation of loadPlayerProfileFromFirestore
 * In tests, this will immediately return null synchronously to avoid Promise issues
 */
export const loadPlayerProfileFromFirestore = jest.fn().mockImplementation(() => {
  console.log('Mock Firebase: Skipping Firestore load in test environment');
  return null;
});

/**
 * Mock implementation of savePlayerProfileToFirestore
 * In tests, this will immediately return undefined synchronously to avoid Promise issues
 */
export const savePlayerProfileToFirestore = jest.fn().mockImplementation(() => {
  console.log('Mock Firebase: Skipping Firestore save in test environment');
  return undefined;
}); 