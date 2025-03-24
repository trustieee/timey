// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
// Keep console.error and console.warn as they are important for test failures

// Replace console methods with no-op functions for normal logs
console.log = jest.fn();
console.info = jest.fn();
console.debug = jest.fn();

// Restore original console methods after tests complete
afterAll(() => {
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
}); 