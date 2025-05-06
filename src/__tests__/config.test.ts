import { getConfig } from '../config';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

// Mock fs-extra and dotenv
jest.mock('fs-extra');
jest.mock('dotenv');

describe('Config Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables before each test
    delete process.env.PORT;
    delete process.env.GITHUB_TOKEN;
    delete process.env.MODEL_NAME;
    delete process.env.DEBUG;
  });

  test('should return default config when no environment variables are set', () => {
    const config = getConfig();
    
    expect(config).toEqual({
      port: 3000,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      storageDir: '.dependency-context',
      debugMode: false
    });
  });

  test('should override defaults with environment variables', () => {
    // Set environment variables
    process.env.PORT = '4000';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.MODEL_NAME = 'custom-model';
    process.env.DEBUG = 'true';
    
    const config = getConfig();
    
    expect(config).toEqual({
      port: 4000,
      githubToken: 'test-token',
      embeddingModel: 'custom-model',
      storageDir: '.dependency-context',
      debugMode: true
    });
  });

  test('should load project-specific .env file if it exists', () => {
    // Mock fs.existsSync to return true for project .env file
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath: any) => {
      return filePath.toString().endsWith('.env');
    });
    
    // Mock dotenv.parse to return custom values
    (dotenv.parse as jest.Mock).mockReturnValue({
      GITHUB_TOKEN: 'project-token',
      MODEL_NAME: 'project-model',
      DEBUG: 'true'
    });
    
    // Mock fs.readFileSync
    jest.spyOn(fs, 'readFileSync').mockReturnValue('mock file content' as any);
    
    const config = getConfig('/test/project/path');
    
    // Verify fs.existsSync was called with the right path
    expect(fs.existsSync).toHaveBeenCalledWith(
      path.join('/test/project/path', '.env')
    );
    
    // Verify the config has project-specific values
    expect(config).toEqual({
      port: 3000,
      githubToken: 'project-token',
      embeddingModel: 'project-model',
      storageDir: '.dependency-context',
      debugMode: true
    });
  });

  test('should load from project .env file', () => {
    // Mock fs.existsSync to return true for project .env file
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath: any) => {
      return filePath.toString().endsWith('.env');
    });
    
    // Mock dotenv.parse to return project values
    (dotenv.parse as jest.Mock).mockReturnValue({
      GITHUB_TOKEN: 'project-token',
      MODEL_NAME: 'project-model'
    });
    
    // Mock fs.readFileSync
    jest.spyOn(fs, 'readFileSync').mockReturnValue('mock file content' as any);
    
    const config = getConfig('/test/project/path');
    
    // Verify project variables are used
    expect(config.githubToken).toBe('project-token');
    expect(config.embeddingModel).toBe('project-model');
  });
});