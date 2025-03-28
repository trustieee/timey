// Set test environment
process.env.NODE_ENV = "test";

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Replace console methods with no-op for normal logs
console.log = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};
// Keep error logging for test failures
// console.error = () => {};

// Mock Firebase environment variables
process.env.FIREBASE_API_KEY = "mock-api-key";
process.env.FIREBASE_AUTH_DOMAIN = "mock-auth-domain";
process.env.FIREBASE_PROJECT_ID = "mock-project-id";
process.env.FIREBASE_STORAGE_BUCKET = "mock-storage-bucket";
process.env.FIREBASE_MESSAGING_SENDER_ID = "mock-messaging-sender-id";
process.env.FIREBASE_APP_ID = "mock-app-id";
process.env.FIREBASE_MEASUREMENT_ID = "mock-measurement-id";

// Mock Firebase modules
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn().mockReturnValue({}),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn().mockReturnValue({}),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { email: "foo@bar.com", uid: "mock-user-id" },
  }),
  onAuthStateChanged: jest.fn().mockImplementation((_auth, callback) => {
    callback({ email: "foo@bar.com", uid: "mock-user-id" });
    return jest.fn(); // Return mock unsubscribe function
  }),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn().mockReturnValue({}),
  doc: jest.fn().mockReturnValue({}),
  getDoc: jest.fn().mockResolvedValue({
    exists: jest.fn().mockReturnValue(false),
    data: jest.fn().mockReturnValue(null),
  }),
  setDoc: jest.fn().mockResolvedValue({}),
  enableIndexedDbPersistence: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
}));

// Tell Jest to use our mocks
jest.mock("./src/playerProfile");

// Restore console methods after tests
afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});
