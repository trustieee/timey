// Mock for firebase/auth module
import { initializeApp } from './app';

const mockUser = {
  email: 'test@example.com',
  uid: 'mock-user-id',
  emailVerified: true,
  displayName: 'Test User',
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: 'mock-refresh-token',
  tenantId: null,
  delete: jest.fn().mockResolvedValue(undefined),
  getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
  getIdTokenResult: jest.fn().mockResolvedValue({
    token: 'mock-id-token',
    expirationTime: new Date(Date.now() + 3600 * 1000).toISOString(),
    issuedAtTime: new Date().toISOString(),
    signInProvider: 'password',
    signInSecondFactor: null,
    claims: {}
  }),
  reload: jest.fn().mockResolvedValue(undefined),
  toJSON: jest.fn().mockReturnValue({})
};

const createMockAuth = () => ({
  app: initializeApp(),
  name: 'auth',
  config: {
    apiKey: 'mock-api-key',
    apiHost: 'mock-host',
    apiScheme: 'https',
    tokenApiHost: 'mock-token-host',
    sdkClientVersion: 'mock-version'
  },
  currentUser: mockUser,
  languageCode: null,
  tenantId: null,
  settings: { appVerificationDisabledForTesting: false },
  onAuthStateChanged: jest.fn().mockImplementation((callback) => {
    callback(mockUser);
    return () => {};
  }),
  onIdTokenChanged: jest.fn().mockImplementation((callback) => {
    callback(mockUser);
    return () => {};
  }),
  setPersistence: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  updateCurrentUser: jest.fn().mockResolvedValue(undefined)
});

export const getAuth = jest.fn().mockImplementation(() => createMockAuth());

export const signInWithEmailAndPassword = jest.fn().mockImplementation(() => 
  Promise.resolve({
    user: mockUser,
    providerId: 'password',
    operationType: 'signIn',
  })
);

export const onAuthStateChanged = jest.fn().mockImplementation((auth, callback) => {
  callback(mockUser);
  return () => {};
});

export const USER_CREDENTIAL = {
  user: mockUser,
  providerId: 'password',
  operationType: 'signIn',
}; 