import { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";
import * as fs from "fs";

// Initialize Firebase Admin if it hasn't been initialized yet
if (!admin.apps.length) {
  try {
    // Try to get the credentials path from environment variable
    let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // If not set in environment, use the known path
    if (!credentialsPath) {
      credentialsPath = "C:/users/mario/downloads/timey.json";
      console.log("Using hardcoded credentials path:", credentialsPath);
    }

    console.log("Attempting to read credentials from:", credentialsPath);

    // Read the service account JSON file
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

    if (!serviceAccount.project_id) {
      throw new Error("Service account file does not contain project_id");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    console.log(
      "Firebase Admin initialized successfully with project ID:",
      serviceAccount.project_id
    );
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!admin.apps.length) {
      return res.status(500).json({
        error: "Firebase Admin SDK not initialized",
        message: "The server failed to initialize Firebase Admin SDK",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Create the user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
    });

    // Create an empty profile in Firestore
    await admin
      .firestore()
      .collection("playerProfiles")
      .doc(userRecord.uid)
      .set({
        email: email,
        displayName: email.split("@")[0], // Default display name from email
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.status(201).json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      error: "Failed to create user",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
