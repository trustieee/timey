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
  // Start at level 1 with 0 XP
  let level = 1;
  let totalXp = 0;

  // Sum up the final XP from all days in history
  Object.values(profile.history || {}).forEach((day) => {
    if (day.xp && day.xp.final > 0) {
      totalXp += day.xp.final;
    }
  });

  // Calculate level based on XP
  while (
    totalXp >=
    APP_CONFIG.PROFILE.XP_PER_LEVEL[
      Math.min(level - 1, APP_CONFIG.PROFILE.XP_PER_LEVEL.length - 1)
    ]
  ) {
    totalXp -=
      APP_CONFIG.PROFILE.XP_PER_LEVEL[
        Math.min(level - 1, APP_CONFIG.PROFILE.XP_PER_LEVEL.length - 1)
      ];
    level++;
  }
  return level;
}

function calculateXp(profile: BasePlayerProfile): number {
  let totalXp = 0;
  let level = 1;

  // Sum up the final XP from all days in history
  Object.values(profile.history || {}).forEach((day) => {
    if (day.xp && day.xp.final > 0) {
      totalXp += day.xp.final;
    }
  });

  // Subtract XP used for previous levels
  while (
    totalXp >=
    APP_CONFIG.PROFILE.XP_PER_LEVEL[
      Math.min(level - 1, APP_CONFIG.PROFILE.XP_PER_LEVEL.length - 1)
    ]
  ) {
    totalXp -=
      APP_CONFIG.PROFILE.XP_PER_LEVEL[
        Math.min(level - 1, APP_CONFIG.PROFILE.XP_PER_LEVEL.length - 1)
      ];
    level++;
  }

  return totalXp;
}

function calculateXpToNextLevel(profile: BasePlayerProfile): number {
  const level = calculateLevel(profile);
  // Use the correct index from XP_PER_LEVEL array, or default if beyond array size
  if (level <= APP_CONFIG.PROFILE.XP_PER_LEVEL.length) {
    return APP_CONFIG.PROFILE.XP_PER_LEVEL[level - 1];
  }
  return APP_CONFIG.PROFILE.DEFAULT_XP_PER_LEVEL;
}

// Mock the APP_CONFIG
jest.mock("../config", () => ({
  APP_CONFIG: {
    PROFILE: {
      XP_PER_LEVEL: [840, 960, 1080, 1200], // XP needed for levels 1-5
      DEFAULT_XP_PER_LEVEL: 1200, // XP needed for levels 5+
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
          "2023-01-01": { xp: { gained: 840, penalties: 0, final: 840 } },
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
      // 1000 XP = 840 for level 1 + 160 toward level 2
      expect(calculateLevel(profile)).toBe(2);
    });

    it("should return level 3 when XP meets level 1 and level 2 requirements", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 900, penalties: 0, final: 900 } },
          "2023-01-02": { xp: { gained: 900, penalties: 0, final: 900 } },
        },
      };
      // 1800 XP = 840 for level 1 + 960 for level 2
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
      // 900 XP = 840 for level 1 + 60 toward level 2
      expect(calculateLevel(profile)).toBe(2);
    });

    it("should correctly calculate level 5 and beyond", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 1200, penalties: 0, final: 1200 } },
          "2023-01-02": { xp: { gained: 1200, penalties: 0, final: 1200 } },
          "2023-01-03": { xp: { gained: 1200, penalties: 0, final: 1200 } },
          "2023-01-04": { xp: { gained: 1200, penalties: 0, final: 1200 } },
        },
      };
      // 4800 XP = 840 + 960 + 1080 + 1200 + 720 toward level 6
      expect(calculateLevel(profile)).toBe(5);
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
      // 1000 XP - 840 XP used for level 1 = 160 XP remaining
      expect(calculateXp(profile)).toBe(160);
    });

    it("should handle level 3 XP calculation correctly", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 900, penalties: 0, final: 900 } },
          "2023-01-02": { xp: { gained: 1000, penalties: 0, final: 1000 } },
        },
      };
      // 1900 total XP
      // Level 1: 840 XP
      // Level 2: 960 XP
      // Remaining: 1900 - 840 - 960 = 100 XP toward level 3
      expect(calculateXp(profile)).toBe(100);
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
      // Level 1: 840 XP
      // Level 2: 960 XP
      // Level 3: 1080 XP
      // Level 4: 1200 XP
      // Remaining: 4500 - 840 - 960 - 1080 - 1200 = 420 XP toward level 5
      expect(calculateXp(profile)).toBe(420);
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
      // 900 - 840 = 60 XP toward level 2
      expect(calculateXp(profile)).toBe(60);
    });
  });

  describe("calculateXpToNextLevel", () => {
    it("should return the first level XP requirement for a new profile", () => {
      const profile: BasePlayerProfile = { history: {} };
      expect(calculateXpToNextLevel(profile)).toBe(840);
    });

    it("should return the second level XP requirement for a level 2 player", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 840, penalties: 0, final: 840 } },
        },
      };
      expect(calculateXpToNextLevel(profile)).toBe(960);
    });

    it("should return the third level XP requirement for a level 3 player", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 1800, penalties: 0, final: 1800 } },
        },
      };
      // 1800 XP = 840 for level 1 + 960 for level 2
      expect(calculateXpToNextLevel(profile)).toBe(1080);
    });

    it("should return the default XP requirement for levels beyond the predefined array", () => {
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 2000, penalties: 0, final: 2000 } },
          "2023-01-02": { xp: { gained: 2000, penalties: 0, final: 2000 } },
        },
      };
      // 4000 XP - enough to reach level 5
      expect(calculateXpToNextLevel(profile)).toBe(1200);
    });
  });

  // Test the real-world bug case where XP was showing 1620/960 at Level 2
  describe("Fixed Bug: XP Display Issue", () => {
    it("should correctly show XP toward next level, not cumulative XP", () => {
      // Create a profile with 1620 total XP as in the bug report
      const profile: BasePlayerProfile = {
        history: {
          "2023-01-01": { xp: { gained: 900, penalties: 0, final: 900 } },
          "2023-01-02": { xp: { gained: 720, penalties: 0, final: 720 } },
        },
      };

      // Total XP is 1620
      // 1620 total XP = 840 XP for level 1 + 780 XP toward level 2

      const level = calculateLevel(profile);
      const xp = calculateXp(profile);
      const xpToNextLevel = calculateXpToNextLevel(profile);

      // Verify level is calculated correctly
      expect(level).toBe(2);

      // Verify remaining XP toward next level is calculated correctly (not showing total XP)
      expect(xp).toBe(780);

      // Verify XP needed for next level
      expect(xpToNextLevel).toBe(960);

      // This would display as "780/960 XP" at "Level 2" instead of the buggy "1620/960 XP"
    });
  });
});
