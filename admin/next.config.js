const fs = require('fs');
const path = require('path');

// Read the root package.json
const rootPackageJsonPath = path.resolve(__dirname, '../package.json');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const appVersion = rootPackageJson.version;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    forceSwcTransforms: true, // Force SWC transforms
  },
  // Explicitly set the directory to prevent including files from parent directories
  distDir: ".next",
  onDemandEntries: {
    // Don't try to include parent directory files
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Skip TypeScript type checking
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Add the app version as an environment variable
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

module.exports = nextConfig;
