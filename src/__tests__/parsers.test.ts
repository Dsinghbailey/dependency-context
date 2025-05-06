import { parseDependencies } from "../parsers";
import path from "path";
import os from "os";

// We need to mock modules first, before importing anything
jest.mock("fs-extra");
jest.mock("../config");

// Import the modules after mocking
import fs from "fs-extra";
import * as config from "../config";

// Setup mocks
(config.getConfig as jest.Mock).mockReturnValue({
  port: 3000,
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
  storageDir: ".dependency-context",
  debugMode: false,
});

describe("Parser Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should correctly parse package.json dependencies", async () => {
    // Create a temporary directory path
    const tempDir = path.join(os.tmpdir(), "test-project");

    // Mock the package.json content
    const mockPackageJson = {
      dependencies: {
        express: "^4.17.1",
        axios: "1.0.0",
      },
      devDependencies: {
        jest: "^29.0.0",
        typescript: "5.0.0",
      },
    };

    // Set up the mocks
    jest.spyOn(fs, "pathExists").mockImplementation((filePath: any) => {
      return Promise.resolve(filePath.includes("package.json"));
    });

    jest.spyOn(fs, "readJson").mockResolvedValue(mockPackageJson as any);

    // Execute the function
    const result = await parseDependencies(tempDir);

    // Assertions
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "express", type: "npm" }),
        expect.objectContaining({
          name: "axios",
          type: "npm",
          version: "1.0.0",
        }),
        expect.objectContaining({ name: "jest", type: "npm" }),
        expect.objectContaining({
          name: "typescript",
          type: "npm",
          version: "5.0.0",
        }),
      ])
    );
  });

  test("should correctly parse requirements.txt dependencies", async () => {
    // Create a temporary directory path
    const tempDir = path.join(os.tmpdir(), "test-project");

    // Mock the requirements.txt content
    const mockRequirementsTxt =
      "requests==2.26.0\n" +
      "numpy>=1.20.0\n" +
      "pandas\n" +
      "# This is a comment\n" +
      "tensorflow==2.6.0";

    // Set up the mocks
    jest.spyOn(fs, "pathExists").mockImplementation((filePath: any) => {
      return Promise.resolve(filePath.includes("requirements.txt"));
    });

    jest
      .spyOn(fs, "readFile")
      .mockImplementation(async () => mockRequirementsTxt);

    // Execute the function
    const result = await parseDependencies(tempDir);

    // Assertions
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "requests",
          version: "2.26.0",
          type: "python",
        }),
        expect.objectContaining({ name: "numpy", type: "python" }),
        expect.objectContaining({ name: "pandas", type: "python" }),
        expect.objectContaining({
          name: "tensorflow",
          version: "2.6.0",
          type: "python",
        }),
      ])
    );
  });
});
