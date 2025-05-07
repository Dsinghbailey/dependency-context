#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { z } from "zod";
import path from "path";
import { analyzeAndIndexDependencies } from "./tools/analyze";
import { searchDependencyDocs } from "./tools/search";
import { downloadRawDependencyDocs } from "./cli/download";

// Server configuration
const PORT = process.env.DC_PORT ? parseInt(process.env.DC_PORT, 10) : 3006;

// Check for direct CLI commands
const args = process.argv.slice(2);

// Function to handle download command
export function handleDownloadCommand(args: string[]) {
  const projectPath = args[1] ? path.resolve(args[1]) : process.cwd();

  console.log(`Dependency Context - Documentation Downloader`);
  console.log(`======================================`);

  // Execute the download function
  return downloadRawDependencyDocs(projectPath);
}

// Function to display help
export function displayHelp() {
  console.log(`Dependency Context - CLI Usage`);
  console.log(`=======================`);
  console.log(`Commands:`);
  console.log(
    `  download [path]    Download dependency documentation to a local folder`
  );
  console.log(
    `                     If path is not specified, current directory is used`
  );
  console.log(
    `                     Files are saved to: <project>/dependency-context/`
  );
  console.log(`  --http-stream      Start as HTTP streaming server (for MCP)`);
  console.log(`  --help, -h         Display this help message`);
  console.log(``);
  console.log(`Environment Variables:`);
  console.log(`  GITHUB_TOKEN       GitHub token for API access`);
  console.log(`  MODEL_NAME         Custom embedding model`);
  console.log(`  MIN_CHUNK_SIZE     Minimum chunk size (default: 800)`);
  console.log(`  MAX_CHUNK_SIZE     Maximum chunk size (default: 8000)`);
  console.log(
    `  CHUNKS_RETURNED    Number of chunks returned in search (default: 5)`
  );
}

// Handle command line arguments (when directly executed)
if (require.main === module) {
  if (args[0] === "download") {
    // If download command is specified, run in CLI mode
    handleDownloadCommand(args)
      .then(() => {
        // Function handles its own exit codes
      })
      .catch((error) => {
        console.error("Error:", error.message);
        process.exit(1);
      });
  } else if (args[0] === "--help" || args[0] === "-h") {
    // Display help information
    displayHelp();
    process.exit(0);
  } else {
    // Start as MCP server
    const server = new FastMCP({
      name: "Dependency Documentation Server",
      version: "1.2.0",
    });

    // Define parameters for the analyze tool using Zod
    const AnalyzeParamsZod = z.object({
      project_path: z
        .string()
        .describe("The absolute path to the project directory"),
      env_vars: z
        .record(z.string())
        .optional()
        .describe("Environment variables to set during analysis"),
    });

    // Register MCP tools
    server.addTool({
      name: "InitializeDependencyIndex",
      description:
        "Initializes the dependency index for a project. Analyzes project dependencies, fetches docs, and creates/updates the local vector index.",
      parameters: AnalyzeParamsZod,
      execute: analyzeAndIndexDependencies,
    });

    // Define parameters for the search tool using Zod
    const SearchParamsZod = z.object({
      project_path: z
        .string()
        .describe("The absolute path to the project directory"),
      query: z.string().describe("The search query"),
      repository_context: z
        .string()
        .optional()
        .describe("Optional repository name to limit the search to"),
      env_vars: z
        .record(z.string())
        .optional()
        .describe("Environment variables to set during search"),
    });

    server.addTool({
      name: "searchDependencyDocs",
      description:
        "Performs semantic search over indexed dependency documentation.",
      parameters: SearchParamsZod,
      execute: searchDependencyDocs,
    });

    // Select transport type based on command line arguments
    const transportType = process.argv.includes("--http-stream")
      ? "httpStream"
      : "stdio";

    if (transportType === "httpStream") {
      // Log that the server is starting *before* the await
      // Start the server
      server.start({
        transportType: "httpStream",
        httpStream: {
          endpoint: "/stream",
          port: PORT,
        },
      });
    } else {
      //   // Start the server in stdio mode
      server.start({
        transportType: "stdio",
      });
    }
  }
}
