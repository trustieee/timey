#!/bin/bash

# This script runs the profile download tool to download a user's profile from Firebase to local JSON

# Check if the required arguments were provided
if [ -z "$1" ]; then
  echo "Usage: ./tools/downloadProfile.sh <path-to-service-account-key> [output-path] [user-email]"
  echo "Default output-path: ./downloadedProfile.json"
  echo "Default user-email: holdencatchkid@gmail.com"
  exit 1
fi

# Convert to absolute paths if relative
SERVICE_ACCOUNT_KEY=$(realpath "$1")
OUTPUT_PATH="${2:-./downloadedProfile.json}"
USER_EMAIL="${3:-holdencatchkid@gmail.com}"

# Check if firebase-admin is installed
if ! npm list firebase-admin > /dev/null 2>&1; then
  echo "Installing firebase-admin dependency..."
  npm install --save firebase-admin
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Run the download script with ts-node, using absolute path to the TS file
npx ts-node "$SCRIPT_DIR/downloadProfile.ts" "$SERVICE_ACCOUNT_KEY" "$OUTPUT_PATH" "$USER_EMAIL" 