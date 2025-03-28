import * as admin from "firebase-admin";
import { PlayerProfile } from "../src/playerProfile";
import fs from "fs";
import path from "path";

// Parse command line arguments
const serviceAccountPath = process.argv[2];
const outputPath = process.argv[3] || "./downloadedProfile.json";
const userEmail = process.argv[4] || "holdencatchkid@gmail.com";

// Check required arguments
if (!serviceAccountPath) {
  console.error(
    "Please provide the path to the service account key file as the first argument"
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
 * Download user profile from Firebase to local JSON
 */
async function downloadProfile() {
  try {
    console.log(`Downloading profile for user: ${userEmail}`);
    console.log(`Using Firestore document ID: ${FIRESTORE_USER_ID}`);

    // Get profile from Firestore using admin SDK
    const docSnapshot = await db
      .collection("playerProfiles")
      .doc(FIRESTORE_USER_ID)
      .get();

    if (!docSnapshot.exists) {
      console.error(`No profile found for user: ${userEmail}`);
      process.exit(1);
    }

    // Get the profile data
    const profileData = docSnapshot.data() as PlayerProfile;

    // Save to local file
    const outputFilePath = path.resolve(outputPath);
    fs.writeFileSync(
      outputFilePath,
      JSON.stringify(profileData, null, 2),
      "utf8"
    );

    console.log(`Successfully downloaded profile to: ${outputFilePath}`);
    process.exit(0);
  } catch (error) {
    console.error("Error downloading profile:", error);
    process.exit(1);
  }
}

// Run the download
downloadProfile();
