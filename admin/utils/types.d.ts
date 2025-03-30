// Add type definitions for Electron API to keep TypeScript happy
// This won't be used in the browser environment
import { ElectronAPI } from "../../src/preload";

declare interface Window {
  electronAPI?: ElectronAPI;
}
