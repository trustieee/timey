/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testMatch: [
    "**/*.test.ts"
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Handle module aliases (if needed in the future)
  },
  // Increase timeout for handling open resources
  openHandlesTimeout: 5000,
  // Explicitly identify mocks that should be restored
  restoreMocks: true,
  // Clear mock implementations between tests
  clearMocks: true,
  // Don't reset the modules between tests
  resetModules: false,
  // Use modern worker threads for better process handling
  workerThreads: true,
  // Suppress console.log during tests but keep console.error
  silent: false,
  // Custom silent logger to suppress console output in passing tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
}; 