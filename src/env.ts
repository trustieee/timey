import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

/**
 * Helper function to get environment variables in both development and production
 * Tries multiple sources to find the value
 */
export function getEnvVariable(name: string): string | undefined {
  // First check process.env
  if (process.env[name]) {
    return process.env[name];
  }
  
  // Then try to read from .env file in resources directory (for production)
  if (app.isPackaged) {
    try {
      const resourcesPath = process.resourcesPath;
      const envPath = path.join(resourcesPath, '.env');
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          if (line.trim().startsWith('#')) continue; // Skip comments
          
          const match = line.match(new RegExp(`^${name}=(.+)$`));
          if (match) {
            return match[1].trim();
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${name} from .env file:`, error);
    }
  }
  
  return undefined;
}

/**
 * Set a GitHub token for electron-updater
 * This tries multiple sources to find a valid token
 */
export function setupGitHubToken(): void {
  // Try different environment variable names for GitHub tokens
  const token = 
    getEnvVariable('GITHUB_TOKEN') || 
    getEnvVariable('GH_TOKEN');
  
  if (token) {
    // electron-updater specifically looks for GH_TOKEN
    process.env.GH_TOKEN = token;
    console.log('GitHub token has been set for auto-updater');
    return;
  }
  
  console.warn('No GitHub token found! Auto-updates may not work for private repositories.');
} 