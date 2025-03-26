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
};

module.exports = nextConfig;
