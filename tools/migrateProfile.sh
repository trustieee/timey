#!/bin/bash

# This script runs the profile migration tool to transfer a user's profile from local JSON to Firebase

# Check if the required arguments were provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./tools/migrateProfile.sh <path-to-json-file> <path-to-service-account-key> [user-email] [user-id]"
  echo "Default user-email: holdencatchkid@gmail.com"
  echo "Default user-id: 5FvI71bjL8QSNV4UTY4SR5lUaih2"
  exit 1
fi

# Convert to absolute paths if relative
JSON_FILE=$(realpath "$1")
SERVICE_ACCOUNT_KEY=$(realpath "$2")
USER_EMAIL="${3:-holdencatchkid@gmail.com}"
USER_ID="${4:-5FvI71bjL8QSNV4UTY4SR5lUaih2}"

# Check if firebase-admin is installed
if ! npm list firebase-admin > /dev/null 2>&1; then
  echo "Installing firebase-admin dependency..."
  npm install --save firebase-admin
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Run the migration script with ts-node, using absolute path to the TS file
npx ts-node "$SCRIPT_DIR/migrateProfile.ts" "$JSON_FILE" "$SERVICE_ACCOUNT_KEY" "$USER_EMAIL" "$USER_ID" 