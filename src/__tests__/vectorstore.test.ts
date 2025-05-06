import * as vectorstore from '../vectorstore';
import fs from 'fs-extra';
import path from 'path';
import { pipeline } from '@xenova/transformers';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('@xenova/transformers');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

describe('Vector Store Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the pipeline function
    (pipeline as jest.Mock).mockResolvedValue((text: string) => {
      return Promise.resolve({
        data: new Float32Array([0.1, 0.2, 0.3]) // Mock embedding data
      });
    });
    
    // Mock fs functions
    (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    (fs.pathExists as jest.Mock).mockResolvedValue(false);
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });
  
  describe('searchVectorStore', () => {
    test('should return empty results if vector store does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      const results = await vectorstore.searchVectorStore(
        '/test/project',
        'test query'
      );
      
      expect(results).toEqual([]);
    });
    
    test('should calculate similarity scores correctly', async () => {
      // Mock vector store exists
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      
      // Mock vector store content
      (fs.readJson as jest.Mock).mockResolvedValue({
        entries: [
          {
            chunk: 'This is a test chunk',
            embedding: [0.1, 0.2, 0.3],
            metadata: {
              repository: 'https://github.com/test/repo',
              file: '/README.md',
              dependency: 'test-package'
            }
          },
          {
            chunk: 'This is another test chunk',
            embedding: [0.2, 0.3, 0.4],
            metadata: {
              repository: 'https://github.com/test/repo2',
              file: '/docs/guide.md',
              dependency: 'test-package-2'
            }
          }
        ]
      });
      
      const results = await vectorstore.searchVectorStore(
        '/test/project',
        'test query'
      );
      
      // Verify results are sorted by similarity
      expect(results).toHaveLength(2);
      expect(results[0].similarity_score).toBeGreaterThanOrEqual(results[1].similarity_score);
      expect(results[0].text_chunk).toBeDefined();
      expect(results[0].source_repository).toBeDefined();
      expect(results[0].source_file).toBeDefined();
    });
    
    test('should filter by repository context', async () => {
      // Mock vector store exists
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      
      // Mock vector store with multiple repositories
      (fs.readJson as jest.Mock).mockResolvedValue({
        entries: [
          {
            chunk: 'Express documentation',
            embedding: [0.1, 0.2, 0.3],
            metadata: {
              repository: 'https://github.com/expressjs/express',
              file: '/README.md',
              dependency: 'express'
            }
          },
          {
            chunk: 'React documentation',
            embedding: [0.2, 0.3, 0.4],
            metadata: {
              repository: 'https://github.com/facebook/react',
              file: '/docs/readme.md',
              dependency: 'react'
            }
          }
        ]
      });
      
      // Search with repository context
      const results = await vectorstore.searchVectorStore(
        '/test/project',
        'test query',
        'express'
      );
      
      // Verify only express results are returned
      expect(results).toHaveLength(1);
      expect(results[0].source_repository).toContain('express');
    });
    
    test('should limit results to top 5 by default', async () => {
      // Mock vector store exists
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      
      // Create mock vector store with 10 entries
      const mockEntries = Array(10).fill(0).map((_, i) => ({
        chunk: `Test chunk ${i}`,
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          repository: 'https://github.com/test/repo',
          file: `/file${i}.md`,
          dependency: 'test-package'
        }
      }));
      
      (fs.readJson as jest.Mock).mockResolvedValue({
        entries: mockEntries
      });
      
      const results = await vectorstore.searchVectorStore(
        '/test/project',
        'test query'
      );
      
      // Verify only top 5 results are returned by default
      expect(results).toHaveLength(5);
    });
    
    test('should respect chunksReturned config parameter', async () => {
      // Mock vector store exists
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      
      // Create mock vector store with 10 entries
      const mockEntries = Array(10).fill(0).map((_, i) => ({
        chunk: `Test chunk ${i}`,
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          repository: 'https://github.com/test/repo',
          file: `/file${i}.md`,
          dependency: 'test-package'
        }
      }));
      
      (fs.readJson as jest.Mock).mockResolvedValue({
        entries: mockEntries
      });
      
      // Test with custom chunksReturned value
      const results = await vectorstore.searchVectorStore(
        '/test/project',
        'test query',
        undefined, // No repository context
        {
          port: 3000,
          embeddingModel: 'test-model',
          storageDir: '.test',
          debugMode: false,
          minChunkSize: 800,
          maxChunkSize: 8000,
          chunksReturned: 8 // Custom number of results
        }
      );
      
      // Verify custom number of results are returned
      expect(results).toHaveLength(8);
    });
  });
});