import { searchVectorStore } from '../vectorstore';
import { getConfig } from '../config';
import path from 'path';
import { z } from 'zod';

// Define the schema for the tool parameters
const SearchParamsSchema = z.object({
  project_path: z.string().describe("The absolute path to the project directory"),
  query: z.string().describe("The search query"),
  repository_context: z.string().optional().describe("Optional repository name to limit the search to"),
  env_vars: z.record(z.string()).optional().describe("Environment variables to set during search")
});

interface SearchResult {
  text_chunk: string;
  source_repository: string;
  source_file: string;
  similarity_score: number;
}

interface SearchResponse {
  results: SearchResult[];
}

/**
 * Performs semantic search over indexed dependency documentation
 */
export async function searchDependencyDocs(
  params: z.infer<typeof SearchParamsSchema>,
  context?: any
): Promise<string> {
  const log = context?.log || console;
  
  try {
    const { project_path, query, repository_context, env_vars } = params;
    
    log.info(`Searching for "${query}" in project at ${project_path}`);
    
    // Set environment variables if provided via MCP
    if (env_vars) {
      for (const [key, value] of Object.entries(env_vars)) {
        process.env[key] = value;
      }
    }
    
    // Get configuration (includes project-specific .env)
    const config = getConfig(project_path);
    
    if (config.debugMode) {
      log.debug(`Search details:`, { 
        query, 
        repository_context: repository_context || 'all repositories' 
      });
    }
    
    // Perform vector search
    const results = await searchVectorStore(project_path, query, repository_context, config);
    
    log.info(`Found ${results.length} results for search query`);
    
    return JSON.stringify({ results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Error performing search:', { error: errorMessage });
    return JSON.stringify({ 
      results: [],
      error: errorMessage 
    });
  }
}

// Export the schema for the server to use
export { SearchParamsSchema };