// Mock for firebase/app module
export const initializeApp = jest.fn().mockImplementation(() => ({
  name: '[DEFAULT]',
  options: {
    apiKey: 'mock-api-key',
    authDomain: 'mock-auth-domain',
    projectId: 'mock-project-id',
    storageBucket: 'mock-storage-bucket',
    messagingSenderId: 'mock-messaging-sender-id',
    appId: 'mock-app-id',
    measurementId: 'mock-measurement-id',
  },
  automaticDataCollectionEnabled: false
}));

export const getApp = jest.fn().mockImplementation(() => initializeApp());
export const getApps = jest.fn().mockImplementation(() => [initializeApp()]);
export const deleteApp = jest.fn().mockResolvedValue(undefined); 