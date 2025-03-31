import admin from "firebase-admin";
import * as fs from "fs";
import path from "path";

// Function to initialize Firebase Admin SDK
async function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app(); // Return existing app if already initialized
  }
  try {
    // Try to get credentials path from environment variable
    let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // If not set in env, try a common relative path or a specific known path
    if (!credentialsPath) {
      // Check relative path first (assuming script is run from project root)
      const relativePath = path.join(__dirname, "..", "timey-credentials.json");
      if (fs.existsSync(relativePath)) {
        credentialsPath = relativePath;
        console.log(`Using relative credentials path: ${credentialsPath}`);
      } else {
        // Fallback to the hardcoded path if relative one doesn't exist
        credentialsPath = "C:/users/mario/downloads/timey.json"; // <--- CHANGE THIS if needed
        console.log(`Using hardcoded credentials path: ${credentialsPath}`);
      }
    }

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Credentials file not found at: ${credentialsPath}`);
    }

    console.log(`Attempting to read credentials from: ${credentialsPath}`);
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

    if (!serviceAccount.project_id) {
      throw new Error("Service account file does not contain project_id");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    console.log(
      `Firebase Admin initialized successfully with project ID: ${serviceAccount.project_id}`
    );
    return admin.app();
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
    throw new Error("Failed to initialize Firebase Admin SDK.");
  }
}

// Migration function
async function migrateProfileInfo() {
  try {
    await initializeFirebaseAdmin();
    const db = admin.firestore();
    const profilesRef = db.collection("playerProfiles");

    // Check for target UID from command line arguments
    const targetUid = process.argv[2]; // Get the first argument after script name

    let migratedCount = 0;
    const batch = db.batch();

    // Helper function to process a single document
    const processProfile = (
      doc:
        | FirebaseFirestore.DocumentSnapshot
        | FirebaseFirestore.QueryDocumentSnapshot
    ) => {
      const profileData = doc.data();
      if (!profileData) {
        console.log(`  - Profile ${doc.id} has no data. Skipping.`);
        return;
      }
      const docRef = profilesRef.doc(doc.id);
      let needsUpdate = false;

      // Get existing profileInfo or initialize if it doesn't exist
      const existingProfileInfo = profileData.profileInfo || {};
      // Create a working copy to build the potential update
      const finalProfileInfo = { ...existingProfileInfo };

      // Get potential source fields from top level
      const topLevelEmail = profileData.email;
      const topLevelDisplayName = profileData.displayName;
      const topLevelCreatedAt = profileData.createdAt; // Firestore Timestamp or undefined

      // --- Start Conditional Copying ---

      // 1. UID: Always ensure UID is correct based on document ID
      if (finalProfileInfo.uid !== doc.id) {
        finalProfileInfo.uid = doc.id;
        needsUpdate = true;
      }

      // 2. Email: Copy from top level only if it exists there AND is missing in profileInfo
      if (topLevelEmail !== undefined && finalProfileInfo.email === undefined) {
        finalProfileInfo.email = topLevelEmail;
        needsUpdate = true;
      }

      // 3. DisplayName: Copy from top level only if it exists there AND is missing in profileInfo
      if (
        topLevelDisplayName !== undefined &&
        finalProfileInfo.displayName === undefined
      ) {
        finalProfileInfo.displayName = topLevelDisplayName;
        needsUpdate = true;
      }

      // 4. CreatedAt & LastUpdated:
      // Check if profileInfo.createdAt is missing first
      if (finalProfileInfo.createdAt === undefined) {
        // If profileInfo.createdAt is missing, decide how to populate it
        if (topLevelCreatedAt !== undefined) {
          // Option A: Top-level field exists, copy it
          finalProfileInfo.createdAt = topLevelCreatedAt;
          needsUpdate = true;
          // Initialize lastUpdated if missing, using the copied value
          if (finalProfileInfo.lastUpdated === undefined) {
            finalProfileInfo.lastUpdated = topLevelCreatedAt;
          }
        } else {
          // Option B: Top-level field is missing, generate a new server timestamp
          const newTimestamp = admin.firestore.FieldValue.serverTimestamp();
          finalProfileInfo.createdAt = newTimestamp;
          needsUpdate = true;
          // Initialize lastUpdated if missing, using the *new* timestamp
          if (finalProfileInfo.lastUpdated === undefined) {
            finalProfileInfo.lastUpdated = newTimestamp;
          }
        }
      } else {
        // profileInfo.createdAt already exists, do nothing for createdAt/lastUpdated here
        // (lastUpdated might be updated by other processes, don't overwrite)
      }

      // --- End Conditional Copying ---

      if (needsUpdate) {
        // Update the entire profileInfo object with the potentially modified version
        batch.update(docRef, { profileInfo: finalProfileInfo });
        migratedCount++;
        console.log(`  - Marked profile ${doc.id} for profileInfo update.`);
      } else {
        console.log(
          `  - Profile ${doc.id}: No fields needed copying to profileInfo.`
        );
      }
    };

    if (targetUid) {
      // --- Process Single Profile ---
      console.log(`Targeting specific profile with UID: ${targetUid}`);
      const docSnapshot = await profilesRef.doc(targetUid).get();

      if (!docSnapshot.exists) {
        console.log(`Profile with UID ${targetUid} not found.`);
        return;
      } else {
        processProfile(docSnapshot);
      }
    } else {
      // --- Process All Profiles ---
      console.log("No specific UID provided. Processing all profiles...");
      const querySnapshot = await profilesRef.get();

      if (querySnapshot.empty) {
        console.log("No player profiles found.");
        return;
      }

      console.log(
        `Found ${querySnapshot.docs.length} profiles. Starting migration...`
      );
      querySnapshot.forEach(processProfile);
    }

    // Commit the batch
    if (migratedCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${migratedCount} profile(s).`);
    } else {
      console.log(`No profiles required an update.`);
    }
  } catch (error) {
    console.error("\nMigration failed:", error);
    process.exit(1); // Exit with error code
  }
}

// Run the migration
migrateProfileInfo();
