#!/bin/bash

# This script runs the migration tool to move profiles from email-based IDs to Firebase Auth UIDs

# Check if the required argument was provided
if [ -z "$1" ]; then
  echo "Usage: ./tools/migrateToCUUIDs.sh <path-to-service-account-key> [--dry-run] [--keep-old]"
  echo "  --dry-run: Show what would happen without making changes"
  echo "  --keep-old: Don't delete old documents after migration"
  exit 1
fi

# Convert to absolute path if relative
SERVICE_ACCOUNT_KEY=$(realpath "$1")
shift  # Remove the first argument

# Check if firebase-admin is installed
if ! npm list firebase-admin > /dev/null 2>&1; then
  echo "Installing firebase-admin dependency..."
  npm install --save-dev firebase-admin
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "Starting migration from email-based IDs to Firebase Auth UIDs..."

# Run the migration script with ts-node, using absolute path to the TS file
npx ts-node "$SCRIPT_DIR/migrateToCUUIDs.ts" "$SERVICE_ACCOUNT_KEY" "$@" 