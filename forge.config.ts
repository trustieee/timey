import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// Load environment variables from .env file for build
import * as dotenv from 'dotenv';
dotenv.config();

// Define environment variables to be passed to the app
const env = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
};

// Log environment variables (without revealing the token)
console.log('Building with GitHub token present:', !!env.GITHUB_TOKEN);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.trustieee.timey',
    appCategoryType: 'public.app-category.productivity',
    osxSign: {},
    protocols: [
      {
        name: 'timey',
        schemes: ['timey']
      }
    ]
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: './assets/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/trustieee/timey/main/assets/icon.ico',
      remoteReleases: 'https://github.com/trustieee/timey'
    }), 
    new MakerZIP({}, ['darwin']), 
    new MakerRpm({}), 
    new MakerDeb({})
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'trustieee',
          name: 'timey'
        },
        prerelease: false,
        draft: false,
        // Make sure these files are included in the release
        assets: ['out/make/**/*']
      }
    }
  ]
};

export default config;
