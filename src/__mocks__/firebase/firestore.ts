// Mock for firebase/firestore module
import { initializeApp } from './app';

const mockApp = initializeApp();

// Create a mock Firestore instance
const mockFirestore = {
  app: mockApp,
  type: 'firestore',
  toJSON: () => ({}),
  _persistenceEnabled: false,
  _databaseId: { projectId: 'mock-project-id' }
};

// Create a mock document data
const mockData = {
  'playerProfiles/mock-user-id': {
    history: {
      '2025-03-24': {
        date: '2025-03-24',
        chores: [
          { id: 0, text: 'Test chore 1', status: 'incomplete' },
          { id: 1, text: 'Test chore 2', status: 'incomplete' }
        ],
        playTime: {
          totalMinutes: 0,
          sessions: []
        },
        xp: {
          gained: 0,
          penalties: 0,
          final: 0
        },
        rewardsUsed: [],
        completed: false
      }
    },
    rewards: {
      available: 0,
      permanent: {}
    }
  }
};

// Create mock document snapshot
const mockDocumentSnapshot = {
  exists: jest.fn().mockReturnValue(true),
  data: jest.fn().mockImplementation(() => mockData['playerProfiles/mock-user-id']),
  get: jest.fn().mockImplementation((field) => {
    const data = mockData['playerProfiles/mock-user-id'];
    return field.split('.').reduce((obj, key) => obj && obj[key], data);
  }),
  id: 'mock-user-id',
  ref: {
    id: 'mock-user-id',
    path: 'playerProfiles/mock-user-id'
  }
};

// Mock document reference
const mockDocumentReference = {
  id: 'mock-user-id',
  path: 'playerProfiles/mock-user-id',
  parent: {
    id: 'playerProfiles',
    path: 'playerProfiles'
  },
  firestore: mockFirestore,
  collection: jest.fn().mockImplementation((path) => ({
    id: path,
    path: `playerProfiles/mock-user-id/${path}`
  })),
  isEqual: jest.fn().mockReturnValue(true),
  withConverter: jest.fn().mockReturnThis()
};

// Export mock functions
export const getFirestore = jest.fn().mockReturnValue(mockFirestore);
export const doc = jest.fn().mockReturnValue(mockDocumentReference);
export const getDoc = jest.fn().mockResolvedValue(mockDocumentSnapshot);
export const setDoc = jest.fn().mockResolvedValue(undefined);
export const enableIndexedDbPersistence = jest.fn().mockResolvedValue(undefined);
export const connectFirestoreEmulator = jest.fn();

// Batch operations
export const writeBatch = jest.fn().mockReturnValue({
  set: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  commit: jest.fn().mockResolvedValue(undefined)
}); 