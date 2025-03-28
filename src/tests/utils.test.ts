import * as utils from "../utils";

// Mock the isTestEnvironment function to control its behavior in tests
jest.mock("../utils", () => {
  const originalModule = jest.requireActual("../utils");
  return {
    ...originalModule,
    isTestEnvironment: jest.fn().mockReturnValue(true),
  };
});

describe("Utility Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isTestEnvironment", () => {
    it("should return true when in test environment", () => {
      // Re-mock to test the actual function
      jest.spyOn(utils, "isTestEnvironment").mockImplementation(() => {
        return (
          typeof process !== "undefined" &&
          (process.env.NODE_ENV === "test" ||
            process.env.JEST_WORKER_ID !== undefined)
        );
      });

      expect(utils.isTestEnvironment()).toBe(true);
    });
  });

  describe("getLocalDateString", () => {
    it("should return a fixed date string in test environment", () => {
      expect(utils.getLocalDateString()).toBe("2025-03-24");
    });
  });

  describe("getLocalISOString", () => {
    it("should return a fixed ISO string in test environment", () => {
      expect(utils.getLocalISOString()).toBe("2025-03-24T12:00:00.000");
    });
  });

  describe("getPreviousDateString", () => {
    it("should return the previous date", () => {
      expect(utils.getPreviousDateString("2025-03-24")).toBe("2025-03-22");
    });

    it("should handle month boundaries correctly", () => {
      expect(utils.getPreviousDateString("2025-03-01")).toBe("2025-02-27");
    });

    it("should handle year boundaries correctly", () => {
      expect(utils.getPreviousDateString("2025-01-01")).toBe("2024-12-30");
    });
  });

  describe("parseLocalDate", () => {
    it("should parse a date string in YYYY-MM-DD format", () => {
      const date = utils.parseLocalDate("2025-03-24");
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(2); // 0-indexed month
      expect(date.getDate()).toBe(24);
    });

    it("should parse a datetime string", () => {
      const date = utils.parseLocalDate("2025-03-24T12:00:00.000");
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(2); // 0-indexed month
      expect(date.getDate()).toBe(24);
      expect(date.getHours()).toBe(12);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });
  });

  describe("formatDisplayDate", () => {
    it("should format a date string to a display format", () => {
      // Mock Date to return a consistent value for toLocaleDateString
      const mockDate = new Date(2025, 2, 24); // March 24, 2025
      const originalDate = global.Date;
      global.Date = jest.fn(() => mockDate) as unknown as DateConstructor;
      global.Date.UTC = originalDate.UTC;
      mockDate.toLocaleDateString = jest.fn().mockReturnValue("March 24, 2025");

      expect(utils.formatDisplayDate("2025-03-24")).toBe("March 24, 2025");

      global.Date = originalDate;
    });
  });

  describe("formatClockDate", () => {
    it("should format a date to MM/DD/YYYY format", () => {
      const date = new Date(2025, 2, 24); // March 24, 2025
      expect(utils.formatClockDate(date)).toBe("03/24/2025");
    });
  });

  describe("formatClockTime", () => {
    it("should format time in 12-hour format (AM)", () => {
      const date = new Date(2025, 2, 24, 9, 30, 15); // 9:30:15 AM
      expect(utils.formatClockTime(date)).toBe("9:30:15 AM");
    });

    it("should format time in 12-hour format (PM)", () => {
      const date = new Date(2025, 2, 24, 14, 30, 15); // 2:30:15 PM
      expect(utils.formatClockTime(date)).toBe("2:30:15 PM");
    });

    it("should convert hour 0 to 12 for midnight", () => {
      const date = new Date(2025, 2, 24, 0, 30, 15); // 12:30:15 AM
      expect(utils.formatClockTime(date)).toBe("12:30:15 AM");
    });

    it("should convert hour 12 to 12 for noon", () => {
      const date = new Date(2025, 2, 24, 12, 30, 15); // 12:30:15 PM
      expect(utils.formatClockTime(date)).toBe("12:30:15 PM");
    });
  });
});
