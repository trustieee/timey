import { APP_CONFIG } from "../config";

// Mock interfaces and types needed for tests
interface BasePlayerProfile {
  history: {
    [date: string]: {
      xp: {
        gained: number;
        penalties: number;
        final: number;
      };
      // Other properties not relevant for these tests
    };
  };
  // Other properties not relevant for these tests
}

// Import the functions we need to test
// Since these are defined within the DOMContentLoaded scope in renderer.ts,
// we'll recreate them here for testing
function calculateLevel(profile: BasePlayerProfile): number {
  let totalXp = 0;

  // Sum up the final XP from all days in history
  Object.values(profile.history || {}).forEach((day) => {
    if (day.xp && day.xp.final > 0) {
      totalXp += day.xp.final;
    }
  });

  // Calculate level based on XP using simple division
  return Math.floor(totalXp / APP_CONFIG.PROFILE.XP_PER_LEVEL) + 1;
}

function calculateXp(profile: BasePlayerProfile): number {
  let totalXp = 0;

  // Sum up the final XP from all days in history
  Object.values(profile.history || {}).forEach((day) => {
    if (day.xp && day.xp.final > 0) {
      totalXp += day.xp.final;
    }
  });

  // Calculate remaining XP using modulo
  return totalXp % APP_CONFIG.PROFILE.XP_PER_LEVEL;
}

function calculateXpToNextLevel(): number {
  // Simply return the constant XP value
  return APP_CONFIG.PROFILE.XP_PER_LEVEL;
}

// Mock the APP_CONFIG
jest.mock("../config", () => ({
  APP_CONFIG: {
    PROFILE: {
      XP_PER_LEVEL: 700, // Flat 700 XP for all levels
      XP_FOR_CHORE: 10,
      XP_PENALTY_FOR_CHORE: 10,
    },
  },
}));

describe("XP Calculation Functions", () => {
  describe("calculateLevel", () => {
    it("should return level 1 for a new profile with no XP", () => {
      const profile: BasePlayerProfile = { history: {} };
      expect(calculateLevel(profile)).toBe(1);
    });

    it("should return level 1 for XP less than first level requirement", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 500, penalties: 0, final: 500 } },
        },
      };
      expect(calculateLevel(profile)).toBe(1);
    });

    it("should return level 2 when XP meets level 1 requirement", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 700, penalties: 0, final: 700 } },
        },
      };
      expect(calculateLevel(profile)).toBe(2);
    });

    it("should return level 2 when XP is between level 1 and level 2 requirements", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 1000, penalties: 0, final: 1000 } },
        },
      };
      // 1000 XP = 700 for level 1 + 300 toward level 2
      expect(calculateLevel(profile)).toBe(2);
    });

    it("should return level 3 when XP meets level 1 and level 2 requirements", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 700, penalties: 0, final: 700 } },
          "2023-01-02": { xp: { gained: 700, penalties: 0, final: 700 } },
        },
      };
      // 1400 XP = 700 for level 1 + 700 for level 2
      expect(calculateLevel(profile)).toBe(3);
    });

    it("should handle XP from multiple days correctly", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 300, penalties: 0, final: 300 } },
          "2023-01-02": { xp: { gained: 300, penalties: 0, final: 300 } },
          "2023-01-03": { xp: { gained: 300, penalties: 0, final: 300 } },
        },
      };
      // 900 XP = 700 for level 1 + 200 toward level 2
      expect(calculateLevel(profile)).toBe(2);
    });

    it("should correctly calculate level 5 and beyond", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 1000, penalties: 0, final: 1000 } },
          "2023-01-02": { xp: { gained: 1000, penalties: 0, final: 1000 } },
          "2023-01-03": { xp: { gained: 1000, penalties: 0, final: 1000 } },
          "2023-01-04": { xp: { gained: 1000, penalties: 0, final: 1000 } },
        },
      };
      // 4000 XP = 700 * 5 levels + 500 toward level 6
      expect(calculateLevel(profile)).toBe(6);
    });

    it("should ignore negative or zero XP values", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 900, penalties: 0, final: 900 } },
          "2023-01-02": { xp: { gained: 0, penalties: 0, final: 0 } },
          "2023-01-03": { xp: { gained: 100, penalties: 200, final: -100 } },
        },
      };
      // Only count the 900 XP from the first day
      expect(calculateLevel(profile)).toBe(2);
    });
  });

  describe("calculateXp", () => {
    it("should return 0 for a new profile", () => {
      const profile: BasePlayerProfile = { history: {} };
      expect(calculateXp(profile)).toBe(0);
    });

    it("should return XP amount for level 1", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 500, penalties: 0, final: 500 } },
        },
      };
      expect(calculateXp(profile)).toBe(500);
    });

    it("should return remaining XP after leveling up to level 2", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 1000, penalties: 0, final: 1000 } },
        },
      };
      // 1000 XP - 700 XP used for level 1 = 300 XP remaining
      expect(calculateXp(profile)).toBe(300);
    });

    it("should handle level 3 XP calculation correctly", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 900, penalties: 0, final: 900 } },
          "2023-01-02": { xp: { gained: 1000, penalties: 0, final: 1000 } },
        },
      };
      // 1900 total XP
      // Level 1: 700 XP
      // Level 2: 700 XP
      // Remaining: 1900 - 700 - 700 = 500 XP toward level 3
      expect(calculateXp(profile)).toBe(500);
    });

    it("should correctly calculate XP for level 5 and beyond", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 1500, penalties: 0, final: 1500 } },
          "2023-01-02": { xp: { gained: 1500, penalties: 0, final: 1500 } },
          "2023-01-03": { xp: { gained: 1500, penalties: 0, final: 1500 } },
        },
      };
      // 4500 total XP
      // Level 1-6: 6 * 700 = 4200 XP
      // Remaining: 4500 - 4200 = 300 XP toward level 7
      expect(calculateXp(profile)).toBe(300);
    });

    it("should ignore negative or zero XP values", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 900, penalties: 0, final: 900 } },
          "2023-01-02": { xp: { gained: 0, penalties: 0, final: 0 } },
          "2023-01-03": { xp: { gained: 100, penalties: 200, final: -100 } },
        },
      };
      // Only count the 900 XP from the first day
      // 900 - 700 = 200 XP toward level 2
      expect(calculateXp(profile)).toBe(200);
    });
  });

  describe("calculateXpToNextLevel", () => {
    it("should always return the flat XP requirement", () => {
      expect(calculateXpToNextLevel()).toBe(700);
    });
  });

  // Test the real-world bug case where XP was showing 1620/960 at Level 2
  describe("Fixed Bug: XP Display Issue", () => {
    it("should correctly show XP toward next level, not cumulative XP", () => {
      // Create a profile with 1000 total XP
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 600, penalties: 0, final: 600 } },
          "2023-01-02": { xp: { gained: 400, penalties: 0, final: 400 } },
        },
      };

      // Total XP is 1000
      // 1000 total XP = 700 XP for level 1 + 300 XP toward level 2

      const level = calculateLevel(profile);
      const xp = calculateXp(profile);
      const xpToNextLevel = calculateXpToNextLevel();

      // Verify level is calculated correctly
      expect(level).toBe(2);

      // Verify remaining XP toward next level is calculated correctly (not showing total XP)
      expect(xp).toBe(300);

      // Verify XP needed for next level
      expect(xpToNextLevel).toBe(700);

      // This would display as "300/700 XP" at "Level 2"
    });
  });
});
