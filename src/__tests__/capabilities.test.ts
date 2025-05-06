import { analyzeAndIndexDependencies } from '../capabilities/analyze';
import { searchDependencyDocs } from '../capabilities/search';
import * as config from '../config';
import * as parsers from '../parsers';
import * as repositories from '../repositories';
import * as documents from '../documents';
import * as vectorstore from '../vectorstore';
import fs from 'fs-extra';

// Mock all dependencies
jest.mock('../config');
jest.mock('../parsers');
jest.mock('../repositories');
jest.mock('../documents');
jest.mock('../vectorstore');
jest.mock('fs-extra');

describe('MCP Capabilities Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Common mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (parsers.parseDependencies as jest.Mock).mockResolvedValue([
      { name: 'express', version: '4.17.1', type: 'npm' }
    ]);
    (repositories.findGitHubRepository as jest.Mock).mockResolvedValue({
      name: 'express',
      owner: 'expressjs',
      url: 'https://github.com/expressjs/express',
      ref: 'main'
    });
    (documents.fetchDocs as jest.Mock).mockResolvedValue([
      { content: 'Express docs', path: '/README.md', filename: 'README.md' }
    ]);
    (vectorstore.indexDocumentation as jest.Mock).mockResolvedValue(undefined);
    (vectorstore.searchVectorStore as jest.Mock).mockResolvedValue([
      {
        text_chunk: 'Express is a minimal web framework',
        source_repository: 'https://github.com/expressjs/express',
        source_file: '/README.md',
        similarity_score: 0.95
      }
    ]);
  });

  describe('analyzeAndIndexDependencies', () => {
    test('should handle env_vars correctly', async () => {
      // Mock getConfig to verify it's called with the right parameters
      (config.getConfig as jest.Mock).mockImplementation(() => ({
        port: 3000,
        embeddingModel: 'test-model',
        storageDir: '.dependency-context',
        debugMode: false
      }));
      
      // Call the function with env_vars
      const result = await analyzeAndIndexDependencies({
        project_path: '/test/project',
        env_vars: {
          GITHUB_TOKEN: 'test-token',
          MODEL_NAME: 'test-model',
          DEBUG: 'true'
        }
      });
      
      // Verify the environment variables were set
      expect(process.env.GITHUB_TOKEN).toBe('test-token');
      expect(process.env.MODEL_NAME).toBe('test-model');
      expect(process.env.DEBUG).toBe('true');
      
      // Verify getConfig was called with the project path
      expect(config.getConfig).toHaveBeenCalledWith('/test/project');
      
      // Verify success response
      expect(result.status).toBe('success');
    });
    
    test('should handle invalid project path', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await analyzeAndIndexDependencies({
        project_path: '/invalid/path'
      });
      
      expect(result.status).toBe('failure');
      expect(result.message).toContain('Invalid project path');
    });
  });

  describe('searchDependencyDocs', () => {
    test('should handle env_vars correctly', async () => {
      (config.getConfig as jest.Mock).mockImplementation(() => ({
        port: 3000,
        embeddingModel: 'test-model',
        storageDir: '.dependency-context',
        debugMode: true
      }));
      
      // Call the function with env_vars
      const result = await searchDependencyDocs({
        project_path: '/test/project',
        query: 'express features',
        env_vars: {
          MODEL_NAME: 'search-model'
        }
      });
      
      // Verify the environment variable was set
      expect(process.env.MODEL_NAME).toBe('search-model');
      
      // Verify getConfig was called with the project path
      expect(config.getConfig).toHaveBeenCalledWith('/test/project');
      
      // Verify search was called with the right parameters
      expect(vectorstore.searchVectorStore).toHaveBeenCalledWith(
        '/test/project',
        'express features',
        undefined,
        expect.objectContaining({
          embeddingModel: 'test-model',
          debugMode: true
        })
      );
      
      // Verify results were returned
      expect(result.results).toHaveLength(1);
      expect(result.results[0].text_chunk).toBe('Express is a minimal web framework');
    });
    
    test('should handle repository_context correctly', async () => {
      await searchDependencyDocs({
        project_path: '/test/project',
        query: 'express features',
        repository_context: 'express'
      });
      
      // Verify search was called with repository_context
      expect(vectorstore.searchVectorStore).toHaveBeenCalledWith(
        '/test/project',
        'express features',
        'express',
        expect.anything()
      );
    });
  });
});