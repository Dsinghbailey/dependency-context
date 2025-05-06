import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

// Load environment variables
dotenv.config();

// Configuration with defaults
export interface Config {
  port: number;
  githubToken?: string;
  embeddingModel: string;
  storageDir: string;
  debugMode: boolean;
}

// Default configuration
const defaultConfig: Config = {
  port: 3000,
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  storageDir: '.dependency-context',
  debugMode: false
};

/**
 * Get configuration from environment variables
 */
export function getConfig(projectPath?: string): Config {
  const config = { ...defaultConfig };

  // Server configuration
  if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
  }
  
  // GitHub token
  if (process.env.GITHUB_TOKEN) {
    config.githubToken = process.env.GITHUB_TOKEN;
  }
  
  // Embedding model
  if (process.env.MODEL_NAME) {
    config.embeddingModel = process.env.MODEL_NAME;
  }
  
  // Debug mode
  if (process.env.DEBUG === 'true') {
    config.debugMode = true;
  }

  // Try to load project-specific .env if a project path is provided
  if (projectPath) {
    tryLoadProjectEnv(projectPath, config);
  }
  
  return config;
}

/**
 * Try to load environment variables from a project's .env file
 */
function tryLoadProjectEnv(projectPath: string, config: Config): void {
  const envPaths = [
    path.join(projectPath, '.env'),
    path.join(projectPath, '.env.dependency-context')
  ];
  
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        
        // Update config with project-specific values
        if (envConfig.GITHUB_TOKEN) {
          config.githubToken = envConfig.GITHUB_TOKEN;
        }
        
        if (envConfig.MODEL_NAME) {
          config.embeddingModel = envConfig.MODEL_NAME;
        }
        
        if (envConfig.DEBUG === 'true') {
          config.debugMode = true;
        }
        
        break; // Stop after first valid .env file
      } catch (error) {
        console.warn(`Warning: Error loading env file ${envPath}:`, error);
      }
    }
  }
}