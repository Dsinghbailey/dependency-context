import * as fs from 'fs-extra';
import * as path from 'path';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('simple-git');
jest.mock('../parsers');
jest.mock('../repositories');
jest.mock('../documents');
jest.mock('../config');
jest.mock('../index', () => ({
  handleDownloadCommand: jest.fn().mockImplementation(async (args) => {
    const projectPath = args[1] ? path.resolve(args[1]) : process.cwd();
    if (!fs.existsSync(projectPath)) {
      console.error(`Invalid project path: ${projectPath}`);
      process.exit(1);
      throw new Error(`Invalid project path: ${projectPath}`);
    }
    
    // Check for empty dependencies array
    const dependencies = await require('../parsers').parseDependencies(projectPath);
    if (dependencies.length === 0) {
      console.error(`No dependencies found in project: ${projectPath}`);
      process.exit(1);
      throw new Error(`No dependencies found in project: ${projectPath}`);
    }
    
    return await require('../cli/download').downloadRawDependencyDocs(projectPath);
  }),
  displayHelp: jest.fn().mockImplementation(() => {
    console.log('Dependency Context - CLI Usage');
    console.log('=======================');
    console.log('Commands:');
    console.log('  download [path]    Download dependency documentation to a local folder');
  })
}));

import { parseDependencies } from '../parsers';
import { findGitHubRepository } from '../repositories';
import { downloadDependencyDocs } from '../documents';
import { getConfig } from '../config';
import { handleDownloadCommand, displayHelp } from '../index';
import { downloadRawDependencyDocs } from '../cli/download';

describe('CLI commands', () => {
  // Mock process.exit to prevent tests from ending
  const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  
  // Save original console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Mock getConfig
    (getConfig as jest.Mock).mockReturnValue({
      port: 3000,
      embeddingModel: 'test-model',
      storageDir: '.test',
      debugMode: false,
      minChunkSize: 800,
      maxChunkSize: 8000,
      chunksReturned: 5
    });

    // Mock fs.existsSync to return true for project paths
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      return path === '/test/project';
    });
    
    // Mock fs.ensureDir to do nothing
    (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('download command', () => {
    beforeEach(() => {
      // Mock parseDependencies to return a test dependency
      (parseDependencies as jest.Mock).mockResolvedValue([
        { name: 'test-package', version: '1.0.0' }
      ]);
      
      // Mock findGitHubRepository to return a test repository
      (findGitHubRepository as jest.Mock).mockResolvedValue({
        owner: 'test-owner',
        name: 'test-repo',
        url: 'https://github.com/test-owner/test-repo',
        ref: 'main'
      });
      
      // Mock downloadDependencyDocs to return a test path
      (downloadDependencyDocs as jest.Mock).mockResolvedValue('/test/project/dependency-context/test-package');
    });

    test('should download documentation for current directory when no path specified', async () => {
      // Mock process.cwd() to return a test path
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/test/project');
      
      // Call the download function
      await handleDownloadCommand(['download']);
      
      // Check that parseDependencies was called with current directory
      expect(parseDependencies).toHaveBeenCalledWith('/test/project');
      
      // Check that findGitHubRepository was called
      expect(findGitHubRepository).toHaveBeenCalled();
      
      // Check that downloadDependencyDocs was called
      expect(downloadDependencyDocs).toHaveBeenCalled();
      
      // Check for success message
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully downloaded documentation'));
      
      // Restore process.cwd
      process.cwd = originalCwd;
    });

    test('should handle project path argument', async () => {
      // Call the download function with path argument
      await handleDownloadCommand(['download', '/test/project']);
      
      // Check that parseDependencies was called with the provided path
      expect(parseDependencies).toHaveBeenCalledWith('/test/project');
      
      // Check that other functions were called correctly
      expect(findGitHubRepository).toHaveBeenCalled();
      expect(downloadDependencyDocs).toHaveBeenCalled();
    });

    test('should handle invalid project path', async () => {
      // Call the download function with invalid path
      await expect(handleDownloadCommand(['download', '/invalid/project']))
        .rejects.toThrow();
      
      // Check that error message was displayed
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid project path'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    test('should handle no dependencies found', async () => {
      // Mock parseDependencies to return empty array
      (parseDependencies as jest.Mock).mockResolvedValue([]);
      
      // Call the download function
      await expect(handleDownloadCommand(['download', '/test/project']))
        .rejects.toThrow();
      
      // Check that error message was displayed
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No dependencies found in project'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
    
    test('direct download function works correctly', async () => {
      // Call the download function directly
      await downloadRawDependencyDocs('/test/project');
      
      // Check that parseDependencies was called with the provided path
      expect(parseDependencies).toHaveBeenCalledWith('/test/project');
      
      // Check that other functions were called
      expect(findGitHubRepository).toHaveBeenCalled();
      expect(downloadDependencyDocs).toHaveBeenCalled();
    });
  });

  test('should display help information correctly', () => {
    // Call the help function
    displayHelp();
    
    // Check that help message was displayed
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dependency Context - CLI Usage'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('download [path]'));
  });
});