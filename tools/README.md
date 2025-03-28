# Profile Migration Tool

This tool migrates user profiles from the local JSON storage format to Firebase Firestore.

## How to Use

The migration tool requires a Firebase service account key for authentication:

1. Generate a service account key from the Firebase console:

   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely

2. Run the migration script:

```bash
./migrateProfile.sh <path-to-json-file> <path-to-service-account-key> [user-email] [user-id]
```

### Arguments

- `path-to-json-file`: Path to the local JSON profile data file
- `path-to-service-account-key`: Path to the Firebase service account key JSON file
- `user-email` (optional): Email of the user to migrate (default: holdencatchkid@gmail.com)
- `user-id` (optional): Firebase UID of the user (default: 5FvI71bjL8QSNV4UTY4SR5lUaih2)

### Example

To migrate the included example profile:

```bash
./migrateProfile.sh ./oldProfile.json ./service-account-key.json
```

To migrate for a different user:

```bash
./migrateProfile.sh ./oldProfile.json ./service-account-key.json custom-user@example.com custom-user-firebase-id
```

## Profile Data Format

The migration tool handles transforming the old profile format to match the current Firestore structure:

- Converts `playTime.totalMinutes` to session format if needed
- Ensures all required fields like XP, rewards, etc. are present
- Maintains all historical data including completed chores, XP, and rewards

## Notes

- The migrated user must already have a Firebase account
- The email is converted to a Firestore document ID by replacing `@` and `.` with `_`
- After migration, users may need to log out and log back in to see their migrated data

## Migrating A User Profile

To migrate a user profile from a local JSON file to Firebase:

1. Make sure you have a service account key file. See [SERVICE_ACCOUNT_STEPS.md](./SERVICE_ACCOUNT_STEPS.md) for instructions.
2. Run the migration script:
   ```sh
   ./tools/migrateProfile.sh path/to/profile.json path/to/serviceAccount.json [user-email] [user-id]
   ```

## Downloading A User Profile

To download a user profile from Firebase to a local JSON file:

1. Make sure you have a service account key file. See [SERVICE_ACCOUNT_STEPS.md](./SERVICE_ACCOUNT_STEPS.md) for instructions.
2. Run the download script:
   ```sh
   ./tools/downloadProfile.sh path/to/serviceAccount.json [output-path] [user-email]
   ```
   - Default output path: `./downloadedProfile.json`
   - Default user email: `holdencatchkid@gmail.com`
