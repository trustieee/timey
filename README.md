# Timey

A time tracking application built with Electron.

## Development

```bash
# Install dependencies
npm install

# Start the app in development mode
npm start
```

## Releasing Updates

This application uses GitHub Actions for automated builds and releases, and electron-updater for automatic updates.

### How to Release a New Version

1. Update the version number in `package.json`
2. Commit all changes to the repository
3. Create a new tag with the version number:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. The GitHub Actions workflow will automatically build and publish the release

### Manual Workflow Trigger

You can also manually trigger the build and publish workflow from the GitHub Actions tab.

## Auto-Update Behavior

The app will automatically check for updates when it starts up. When an update is available:

1. Users will see a notification that an update is available
2. The update will be downloaded in the background
3. After download, users will be prompted to restart the app to apply the update

## Configuration

### Environment Variables

The app uses a `.env` file for environment variables like GitHub tokens. This file is gitignored for security.

1. Create a `.env` file in the project root with:
   ```
   GITHUB_TOKEN=your_github_personal_access_token
   ```
2. Make sure the token has `repo` scope access to the repository

### Forge Configuration

Auto-update settings are configured in `forge.config.ts`. The app uses GitHub's releases as its update server.

### Publishing Options

- `prerelease`: Set to `false` to publish as a full release, `true` for a prerelease
- `draft`: Set to `true` to create draft releases (not published until manually published)

## Required Setup

To enable automatic updates and publishing:

1. Place an icon file at `assets/icon.ico` for Windows builds
2. Ensure your GitHub repository is set up correctly
3. The GitHub Actions workflow uses `secrets.GITHUB_TOKEN` which is automatically provided by GitHub 