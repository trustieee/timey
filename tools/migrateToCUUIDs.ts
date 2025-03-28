import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Email to UID mapping with proper type definition
const USER_MAPPINGS: Record<string, string> = {
  "foo@bar.com": "1234567890",
};

// Additional configuration
const DRY_RUN = process.argv.includes("--dry-run");
const DELETE_OLD = !process.argv.includes("--keep-old");

// Parse command line arguments
const serviceAccountPath = process.argv[2];

// Check required arguments
if (!serviceAccountPath) {
  console.error(
    "Please provide the path to the service account key file as the first argument"
  );
  console.error(
    "Usage: npx ts-node migrateToCUUIDs.ts <path-to-service-account> [--dry-run] [--keep-old]"
  );
  console.error("  --dry-run: Show what would happen without making changes");
  console.error("  --keep-old: Don't delete old documents after migration");
  process.exit(1);
}

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
 * Gets email from Firestore ID by reversing the transformation
 * @param firestoreId The Firestore document ID (email with @ and . replaced by _)
 * @returns The original email, or null if it's not a transformed email
 */
function getEmailFromFirestoreId(firestoreId: string): string | null {
  // Check if this ID matches any of our known user emails
  for (const email of Object.keys(USER_MAPPINGS)) {
    const transformedEmail = email.replace(/[@.]/g, "_");
    if (transformedEmail === firestoreId) {
      return email;
    }
  }
  return null;
}

/**
 * Migrate user profiles from email-based IDs to Firebase Auth UIDs
 */
async function migrateProfiles() {
  try {
    console.log(`Running in ${DRY_RUN ? "DRY RUN" : "LIVE"} mode`);
    console.log(
      `Old documents will be ${DELETE_OLD ? "DELETED" : "KEPT"} after migration`
    );

    // Get all documents from the playerProfiles collection
    const snapshot = await db.collection("playerProfiles").get();

    if (snapshot.empty) {
      console.log("No profiles found in the collection");
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} profile document(s)`);

    // Keep track of statistics
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each document
    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const email = getEmailFromFirestoreId(docId);

      // If this doesn't match our email pattern or isn't in our mapping, skip it
      if (!email || !USER_MAPPINGS[email]) {
        console.log(`Skipping document ${docId} - not in email mapping`);
        skippedCount++;
        continue;
      }

      const uid = USER_MAPPINGS[email];
      const data = doc.data();

      console.log(`Migrating ${email} (${docId}) -> ${uid}`);

      if (!DRY_RUN) {
        try {
          // Create new document with UID as the ID
          await db.collection("playerProfiles").doc(uid).set(data);
          console.log(`  ✓ Created document with UID: ${uid}`);

          // Delete old document if specified
          if (DELETE_OLD) {
            await db.collection("playerProfiles").doc(docId).delete();
            console.log(`  ✓ Deleted old document: ${docId}`);
          }

          migratedCount++;
        } catch (error) {
          console.error(`  ✗ Error migrating ${email}:`, error);
          errorCount++;
        }
      } else {
        console.log(`  Would create document with UID: ${uid}`);
        if (DELETE_OLD) {
          console.log(`  Would delete old document: ${docId}`);
        }
        migratedCount++;
      }
    }

    console.log("\nMigration Summary:");
    console.log(`  Documents processed: ${snapshot.size}`);
    console.log(`  Documents migrated: ${migratedCount}`);
    console.log(`  Documents skipped: ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);

    if (DRY_RUN) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log(
        "To perform the actual migration, run without the --dry-run flag."
      );
    }

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

// Run the migration
migrateProfiles();
