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

This application uses GitHub Actions for automated builds and releases.

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

## Configuration

### Forge Configuration

Build settings are configured in `forge.config.ts`.

### Publishing Options

- `prerelease`: Set to `false` to publish as a full release, `true` for a prerelease
- `draft`: Set to `true` to create draft releases (not published until manually published)

## Required Setup

For building and publishing:

1. Place an icon file at `assets/icon.ico` for Windows builds
2. Ensure your GitHub repository is set up correctly
3. The GitHub Actions workflow uses `secrets.GITHUB_TOKEN` which is automatically provided by GitHub 