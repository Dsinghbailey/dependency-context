import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Repository } from '../repositories';
import { Config } from '../config';

export interface Document {
  content: string;
  path: string;
  filename: string;
}

/**
 * Fetch documentation files from a GitHub repository
 */
export async function fetchDocs(
  repository: Repository, 
  config?: Config
): Promise<Document[]> {
  try {
    const { owner, name, ref } = repository;
    
    // Create temporary directory for cloning
    const tempDir = path.join(os.tmpdir(), `dependency-context-${owner}-${name}-${Date.now()}`);
    await fs.ensureDir(tempDir);
    
    console.log(`Cloning ${owner}/${name} (${ref}) to ${tempDir}`);
    
    // Clone the repository
    const git = simpleGit();
    await git.clone(`https://github.com/${owner}/${name}.git`, tempDir, ['--depth', '1', '--single-branch', '--branch', ref]);
    
    // Find all markdown files
    const docs = await findMarkdownFiles(tempDir);
    
    // Clean up temporary directory
    await fs.remove(tempDir);
    
    return docs;
  } catch (error) {
    console.error(`Error fetching docs for ${repository.owner}/${repository.name}:`, error);
    return [];
  }
}

/**
 * Find all markdown files in a directory
 */
async function findMarkdownFiles(directory: string): Promise<Document[]> {
  const documents: Document[] = [];
  
  async function scanDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .git, and other common non-documentation directories
        if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) {
          continue;
        }
        
        // Recursively scan subdirectories
        await scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        // Read markdown file content
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Skip empty files
        if (!content.trim()) {
          continue;
        }
        
        documents.push({
          content,
          path: fullPath.replace(directory, ''),
          filename: entry.name
        });
      }
    }
  }
  
  await scanDirectory(directory);
  
  return documents;
}