import {
  analyzeAndIndexDependencies,
  AnalyzeParamsSchema,
} from "../tools/analyze";
import { searchDependencyDocs, SearchParamsSchema } from "../tools/search";
import * as parsers from "../parsers";
import * as repositories from "../repositories";
import * as documents from "../documents";
import * as vectorstore from "../vectorstore";
import * as config from "../config";
import path from "path";
import fs from "fs-extra";

// Mock dependencies
jest.mock("../parsers");
jest.mock("../repositories");
jest.mock("../documents");
jest.mock("../vectorstore");
jest.mock("../config");
jest.mock("fs-extra");

describe("Tools Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getConfig
    (config.getConfig as jest.Mock).mockReturnValue({
      port: 3000,
      githubToken: "mock-token",
      embeddingModel: "Xenova/all-MiniLM-L6-v2",
      storageDir: ".dependency-context",
      debugMode: false,
    });

    // Mock for fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe("analyzeAndIndexDependencies", () => {
    test("should return failure when project path is invalid", async () => {
      // Mock fs.existsSync to return false for project path
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await analyzeAndIndexDependencies({
        project_path: "/invalid/path",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("failure");
      expect(parsedResult.message).toContain("Invalid project path");
    });

    test("should return failure when no dependencies are found", async () => {
      // Mock parseDependencies to return empty array
      (parsers.parseDependencies as jest.Mock).mockResolvedValue([]);

      const result = await analyzeAndIndexDependencies({
        project_path: "/valid/path",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("failure");
      expect(parsedResult.message).toContain("No dependencies found");
    });

    test("should process dependencies successfully", async () => {
      // Mock dependencies
      const mockDependencies = [
        { name: "express", version: "4.17.1", type: "npm" as const },
        { name: "axios", version: "1.0.0", type: "npm" as const },
      ];

      // Mock repositories
      const mockRepo = {
        name: "express",
        owner: "expressjs",
        url: "https://github.com/expressjs/express",
        ref: "main",
      };

      // Mock documents
      const mockDocs = [
        { content: "Express docs", path: "/README.md", filename: "README.md" },
      ];

      // Setup mocks
      (parsers.parseDependencies as jest.Mock).mockResolvedValue(
        mockDependencies
      );
      (repositories.findGitHubRepository as jest.Mock).mockResolvedValue(
        mockRepo
      );
      (documents.fetchDocs as jest.Mock).mockResolvedValue(mockDocs);
      (vectorstore.indexDocumentation as jest.Mock).mockResolvedValue(
        undefined
      );

      // Create mock context with log and reportProgress
      const mockContext = {
        log: {
          info: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
        reportProgress: jest.fn().mockResolvedValue(undefined),
      };

      const result = await analyzeAndIndexDependencies(
        { project_path: "/valid/path" },
        mockContext
      );

      const parsedResult = JSON.parse(result);

      // Check result status
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.message).toContain("Successfully indexed: 2");

      // Verify function calls
      expect(parsers.parseDependencies).toHaveBeenCalledWith("/valid/path");
      expect(repositories.findGitHubRepository).toHaveBeenCalledTimes(2);
      expect(documents.fetchDocs).toHaveBeenCalledTimes(2);
      expect(vectorstore.indexDocumentation).toHaveBeenCalledTimes(2);

      // Verify progress reporting
      expect(mockContext.reportProgress).toHaveBeenCalledTimes(10); // Initial + 20% + 3 steps per 2 dependencies + final 100%
    });

    test("should handle errors during dependency processing", async () => {
      // Mock dependencies
      const mockDependencies = [
        { name: "express", version: "4.17.1", type: "npm" as const },
        { name: "axios", version: "1.0.0", type: "npm" as const },
      ];

      // Setup mocks with one success and one failure
      (parsers.parseDependencies as jest.Mock).mockResolvedValue(
        mockDependencies
      );

      // First dependency succeeds
      (repositories.findGitHubRepository as jest.Mock)
        .mockResolvedValueOnce({
          name: "express",
          owner: "expressjs",
          url: "https://github.com/expressjs/express",
          ref: "main",
        })
        // Second dependency fails
        .mockResolvedValueOnce(null);

      (documents.fetchDocs as jest.Mock).mockResolvedValue([
        { content: "Express docs", path: "/README.md", filename: "README.md" },
      ]);

      (vectorstore.indexDocumentation as jest.Mock).mockResolvedValue(
        undefined
      );

      const result = await analyzeAndIndexDependencies({
        project_path: "/valid/path",
      });

      const parsedResult = JSON.parse(result);

      // Check result
      expect(parsedResult.status).toBe("success"); // Still success because at least one dependency succeeded
      expect(parsedResult.message).toContain("Successfully indexed: 1");
      expect(parsedResult.message).toContain("Errors: 1");
    });

    test("should handle environment variables from params", async () => {
      // Mock dependencies
      (parsers.parseDependencies as jest.Mock).mockResolvedValue([
        { name: "express", version: "4.17.1", type: "npm" as const },
      ]);

      // Other necessary mocks
      (repositories.findGitHubRepository as jest.Mock).mockResolvedValue({
        name: "express",
        owner: "expressjs",
        url: "https://github.com/expressjs/express",
        ref: "main",
      });

      (documents.fetchDocs as jest.Mock).mockResolvedValue([
        { content: "Express docs", path: "/README.md", filename: "README.md" },
      ]);

      // Store original env
      const originalEnv = { ...process.env };

      try {
        // Call function with env_vars
        await analyzeAndIndexDependencies({
          project_path: "/valid/path",
          env_vars: {
            GITHUB_TOKEN: "test-token",
            DEBUG: "true",
          },
        });

        // Check that environment variables were set
        expect(process.env.GITHUB_TOKEN).toBe("test-token");
        expect(process.env.DEBUG).toBe("true");
      } finally {
        // Restore original env
        process.env = originalEnv;
      }
    });
  });

  describe("searchDependencyDocs", () => {
    test("should return search results", async () => {
      // Mock vector store search results
      const mockResults = [
        {
          text_chunk:
            "Express is a minimal and flexible Node.js web application framework",
          source_repository: "https://github.com/expressjs/express",
          source_file: "/README.md",
          similarity_score: 0.92,
        },
        {
          text_chunk:
            "Express provides a robust set of features for web applications",
          source_repository: "https://github.com/expressjs/express",
          source_file: "/docs/features.md",
          similarity_score: 0.85,
        },
      ];

      // Setup mocks
      (vectorstore.searchVectorStore as jest.Mock).mockResolvedValue(
        mockResults
      );

      // Create mock context with log
      const mockContext = {
        log: {
          info: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
      };

      const result = await searchDependencyDocs(
        {
          project_path: "/valid/path",
          query: "express routing",
        },
        mockContext
      );

      const parsedResult = JSON.parse(result);

      // Check result
      expect(parsedResult.results).toEqual(mockResults);
      expect(mockContext.log.info).toHaveBeenCalledTimes(2);

      // Verify function calls
      expect(vectorstore.searchVectorStore).toHaveBeenCalledWith(
        "/valid/path",
        "express routing",
        undefined,
        expect.any(Object)
      );
    });

    test("should handle repository context filtering", async () => {
      // Setup mocks
      (vectorstore.searchVectorStore as jest.Mock).mockResolvedValue([]);

      await searchDependencyDocs({
        project_path: "/valid/path",
        query: "express routing",
        repository_context: "express",
      });

      // Verify repository context was passed through
      expect(vectorstore.searchVectorStore).toHaveBeenCalledWith(
        "/valid/path",
        "express routing",
        "express",
        expect.any(Object)
      );
    });

    test("should handle search errors", async () => {
      // Setup mock to throw error
      (vectorstore.searchVectorStore as jest.Mock).mockRejectedValue(
        new Error("Search failed")
      );

      const result = await searchDependencyDocs({
        project_path: "/valid/path",
        query: "express routing",
      });

      const parsedResult = JSON.parse(result);

      // Check result contains empty results and error
      expect(parsedResult.results).toEqual([]);
      expect(parsedResult.error).toBe("Search failed");
    });

    test("should handle environment variables from params", async () => {
      // Mock vector store search results
      (vectorstore.searchVectorStore as jest.Mock).mockResolvedValue([]);

      // Store original env
      const originalEnv = { ...process.env };

      try {
        // Call function with env_vars
        await searchDependencyDocs({
          project_path: "/valid/path",
          query: "express routing",
          env_vars: {
            GITHUB_TOKEN: "search-token",
            DEBUG: "true",
          },
        });

        // Check that environment variables were set
        expect(process.env.GITHUB_TOKEN).toBe("search-token");
        expect(process.env.DEBUG).toBe("true");
      } finally {
        // Restore original env
        process.env = originalEnv;
      }
    });

    test("should log debug information when debug mode is enabled", async () => {
      // Setup config with debug mode enabled
      (config.getConfig as jest.Mock).mockReturnValue({
        port: 3000,
        githubToken: "mock-token",
        embeddingModel: "Xenova/all-MiniLM-L6-v2",
        storageDir: ".dependency-context",
        debugMode: true,
      });

      // Mock vector store search results
      (vectorstore.searchVectorStore as jest.Mock).mockResolvedValue([]);

      // Create mock context with log
      const mockContext = {
        log: {
          info: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
      };

      await searchDependencyDocs(
        {
          project_path: "/valid/path",
          query: "express routing",
          repository_context: "express",
        },
        mockContext
      );

      // Verify debug log was called
      expect(mockContext.log.debug).toHaveBeenCalledWith(
        "Search details:",
        expect.objectContaining({
          query: "express routing",
          repository_context: "express",
        })
      );
    });
  });
});
