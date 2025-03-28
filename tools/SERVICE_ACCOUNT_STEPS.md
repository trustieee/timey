# How to Get a Firebase Service Account Key

To use the migration tool, you'll need a Firebase service account key. Here's how to get one:

1. Go to the [Firebase Console](https://console.firebase.google.com/)

2. Select your project

3. Click on the gear icon (⚙️) next to "Project Overview" to go to Project settings

4. Go to the "Service accounts" tab

5. Click "Generate new private key" button

6. Save the JSON file to a secure location (do not commit this to Git!)

7. Use this file as the second parameter to the migration script:

```bash
./tools/migrateProfile.sh ./tools/oldProfile.json /path/to/serviceAccountKey.json
```

## Security Note

The service account key gives full access to your Firebase project. Keep it secure and never commit it to version control.
