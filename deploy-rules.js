// Script to deploy Firestore rules
// Run this with Node.js after installing the Firebase CLI
// npm install -g firebase-tools

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Check if Firebase CLI is installed
try {
  execSync('firebase --version', { stdio: 'pipe' });
} catch (error) {
  console.error('Firebase CLI is not installed. Install it with: npm install -g firebase-tools');
  process.exit(1);
}

// Project ID from .env file
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('FIREBASE_PROJECT_ID not found in .env file');
  process.exit(1);
}

console.log(`Deploying Firestore rules to project: ${projectId}`);

// Create a temporary firebase.json file for deployment
const firebaseConfig = {
  firestore: {
    rules: 'firestore.rules',
    indexes: 'firestore.indexes.json'
  }
};

// Create indexes file if it doesn't exist
if (!fs.existsSync('firestore.indexes.json')) {
  fs.writeFileSync('firestore.indexes.json', JSON.stringify({ indexes: [], fieldOverrides: [] }, null, 2));
  console.log('Created firestore.indexes.json');
}

// Write firebase.json
fs.writeFileSync('firebase.json', JSON.stringify(firebaseConfig, null, 2));
console.log('Created firebase.json for deployment');

try {
  // Login to Firebase (will open browser for auth)
  console.log('Please login to Firebase CLI if prompted...');
  execSync('firebase login', { stdio: 'inherit' });
  
  // Deploy Firestore rules
  console.log('Deploying Firestore rules...');
  execSync(`firebase deploy --only firestore:rules --project ${projectId}`, { stdio: 'inherit' });
  
  console.log('Firestore rules deployed successfully!');
} catch (error) {
  console.error('Error deploying Firestore rules:', error.message);
} finally {
  // Clean up temporary files
  if (fs.existsSync('firebase.json')) {
    fs.unlinkSync('firebase.json');
  }
} 