/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    }
  },
  moduleNameMapper: {
    "^firebase/app$": "<rootDir>/src/__mocks__/firebase/app.ts",
    "^firebase/auth$": "<rootDir>/src/__mocks__/firebase/auth.ts",
    "^firebase/firestore$": "<rootDir>/src/__mocks__/firebase/firestore.ts"
  },
  testMatch: [
    "<rootDir>/src/tests/**/*.test.ts"
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/__mocks__/**/*",
    "!src/tests/**/*"
  ],
  workerThreads: true,
  // Force Jest to exit after all tests are complete
  forceExit: true,
  // Increase timeout for handling open resources
  testTimeout: 10000,
  // Clear mocks between each test
  clearMocks: true,
  // Restore mocks between tests
  restoreMocks: true,
  // Don't capture console output during tests, keep only console.error
  silent: true
}; 