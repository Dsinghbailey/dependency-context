import { parseDependencies } from '../parsers';
import { findGitHubRepository } from '../repositories';
import { fetchDocs } from '../documents';
import { indexDocumentation } from '../vectorstore';
import { getConfig } from '../config';
import path from 'path';
import fs from 'fs-extra';
import { z } from 'zod';

// Define the schema for the tool parameters
const AnalyzeParamsSchema = z.object({
  project_path: z.string().describe("The absolute path to the project directory"),
  env_vars: z.record(z.string()).optional().describe("Environment variables to set during analysis")
});

interface AnalyzeResult {
  status: 'success' | 'failure';
  message: string;
}

/**
 * Analyzes project dependencies, fetches documentation, and indexes it
 */
export async function analyzeAndIndexDependencies(
  params: z.infer<typeof AnalyzeParamsSchema>,
  context?: any
): Promise<string> {
  const log = context?.log || console;
  const reportProgress = context?.reportProgress || (async () => {});
  
  try {
    const { project_path, env_vars } = params;
    
    // Validate project path
    if (!project_path || !fs.existsSync(project_path)) {
      return JSON.stringify({
        status: 'failure',
        message: `Invalid project path: ${project_path}`
      });
    }

    log.info(`Starting dependency analysis for project at ${project_path}`);
    await reportProgress({ progress: 0, total: 100 });

    // Set environment variables if provided via MCP
    if (env_vars) {
      for (const [key, value] of Object.entries(env_vars)) {
        process.env[key] = value;
      }
    }
    
    // Get configuration (includes project-specific .env)
    const config = getConfig(project_path);
    
    if (config.debugMode) {
      log.debug('Config:', { ...config, githubToken: config.githubToken ? '***' : undefined });
    }
    
    // Parse dependencies from project files
    await reportProgress({ progress: 10, total: 100 });
    const dependencies = await parseDependencies(project_path);
    
    if (dependencies.length === 0) {
      return JSON.stringify({
        status: 'failure',
        message: 'No dependencies found in project'
      });
    }

    log.info(`Found ${dependencies.length} dependencies`);
    await reportProgress({ progress: 20, total: 100 });
    
    // Process each dependency
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    const progressIncrement = 70 / dependencies.length; // 70% of the remaining progress distributed among dependencies
    let currentProgress = 20; // Starting from 20%
    
    for (const dep of dependencies) {
      try {
        log.info(`Processing dependency: ${dep.name}@${dep.version}`);
        
        // Find repository
        const repo = await findGitHubRepository(dep, config);
        
        if (!repo) {
          errors.push(`Could not find GitHub repository for ${dep.name}@${dep.version}`);
          errorCount++;
          continue;
        }
        
        currentProgress += progressIncrement / 3;
        await reportProgress({ progress: Math.round(currentProgress), total: 100 });
        
        // Fetch documentation
        const docs = await fetchDocs(repo, config);
        
        if (docs.length === 0) {
          errors.push(`No markdown documentation found for ${dep.name}`);
          errorCount++;
          continue;
        }
        
        currentProgress += progressIncrement / 3;
        await reportProgress({ progress: Math.round(currentProgress), total: 100 });
        
        // Index documentation
        await indexDocumentation(project_path, dep, repo, docs, config);
        successCount++;
        
        currentProgress += progressIncrement / 3;
        await reportProgress({ progress: Math.round(currentProgress), total: 100 });
        
        log.info(`Successfully processed ${dep.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Error processing ${dep.name}: ${errorMessage}`);
        log.error(`Error processing ${dep.name}:`, { error: errorMessage });
        errorCount++;
      }
    }
    
    await reportProgress({ progress: 100, total: 100 });
    
    const result: AnalyzeResult = {
      status: successCount > 0 ? 'success' : 'failure',
      message: `Processed ${dependencies.length} dependencies. Successfully indexed: ${successCount}. Errors: ${errorCount}${errors.length > 0 ? `. Error details: ${errors.join('; ')}` : ''}`
    };
    
    return JSON.stringify(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to analyze dependencies:', { error: errorMessage });
    
    return JSON.stringify({
      status: 'failure',
      message: `Failed to analyze dependencies: ${errorMessage}`
    });
  }
}

// Export the schema for the server to use
export { AnalyzeParamsSchema };