import * as admin from "firebase-admin";
import { PlayerProfile, ChoreStatus } from "../src/playerProfile";
import fs from "fs";
import path from "path";

// Define interface for chore object
interface Chore {
  id: number;
  text: string;
  status?: ChoreStatus;
  completedAt?: string;
}

// Parse command line arguments
const jsonFilePath = process.argv[2];
const serviceAccountPath = process.argv[3];
const userEmail = process.argv[4] || "foo@bar.com";
const userId = process.argv[5] || "5FvI71bjL8QSNV4UTY4SR5lUaih2";

// Check required arguments
if (!jsonFilePath) {
  console.error("Please provide the path to the JSON file as an argument");
  process.exit(1);
}

if (!serviceAccountPath) {
  console.error(
    "Please provide the path to the service account key file as the second argument"
  );
  process.exit(1);
}

// Create Firestore ID from email
const FIRESTORE_USER_ID = userEmail.replace(/[@.]/g, "_");

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(serviceAccountPath), "utf8")
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Migrate user profile from local JSON to Firebase
 */
async function migrateProfile() {
  try {
    // Read and parse the JSON file
    const jsonData = fs.readFileSync(path.resolve(jsonFilePath), "utf8");
    const localProfile = JSON.parse(jsonData) as PlayerProfile;

    console.log("Read local profile from:", jsonFilePath);
    console.log(`Migrating profile for user: ${userEmail} (${userId})`);
    console.log(`Using Firestore document ID: ${FIRESTORE_USER_ID}`);

    // Validate the profile data
    if (!localProfile.history) {
      throw new Error("Invalid profile data: missing history object");
    }

    // Create a modified profile with new schema structure
    const updatedProfile: any = {
      lastUpdated: new Date().toISOString(),
      uid: FIRESTORE_USER_ID,
      xp: {
        penalties: 0,
        gained: 0,
        bonus: 0,
        final: 0,
        base: 0,
      },
      playTime: {
        sessions: [],
      },
      rewards: localProfile.rewards || { available: 0, permanent: {} },
      history: { ...localProfile.history },
    };

    // Extract all unique chores from history
    const uniqueChores = new Map();

    // Process each day in the history
    Object.keys(updatedProfile.history).forEach((date) => {
      const day = updatedProfile.history[date];

      // Convert playTime.totalMinutes to sessions if needed
      if (
        day.playTime &&
        "totalMinutes" in day.playTime &&
        (!day.playTime.sessions || day.playTime.sessions.length === 0)
      ) {
        day.playTime.sessions = [];
      }

      // Ensure XP fields are present with new structure
      if (!day.xp) {
        day.xp = { gained: 0, penalties: 0, final: 0, bonus: 0, base: 0 };
      } else if (!day.xp.bonus || !day.xp.base) {
        day.xp.bonus = 0;
        day.xp.base = day.xp.gained || 0;
      }

      // Ensure rewardsUsed array exists
      if (!day.rewardsUsed) {
        day.rewardsUsed = [];
      }

      // Collect unique chores from this day
      if (day.chores && Array.isArray(day.chores)) {
        day.chores.forEach((chore: Chore) => {
          if (chore.id !== undefined && chore.text) {
            uniqueChores.set(chore.id, {
              id: chore.id,
              text: chore.text,
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Apply to all days of the week
            });
          }
        });
      }
    });

    // Add the unique chores array to the profile
    updatedProfile.chores = Array.from(uniqueChores.values());

    // Calculate total XP from history for root-level XP
    let totalGained = 0;
    let totalPenalties = 0;

    Object.values(updatedProfile.history).forEach((day: any) => {
      if (day.xp && typeof day.xp.gained === "number") {
        totalGained += day.xp.gained;
      }
      if (day.xp && typeof day.xp.penalties === "number") {
        totalPenalties += day.xp.penalties;
      }
    });

    updatedProfile.xp = {
      penalties: totalPenalties,
      gained: totalGained,
      bonus: 0,
      base: totalGained,
      final: totalGained - totalPenalties,
    };

    // Save to Firestore using admin SDK
    await db
      .collection("playerProfiles")
      .doc(FIRESTORE_USER_ID)
      .set(updatedProfile, { merge: true });

    console.log("Successfully migrated profile to Firebase!");
    console.log(
      `Added ${updatedProfile.chores.length} unique chores to the profile`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error migrating profile:", error);
    process.exit(1);
  }
}

// Run the migration
migrateProfile();
