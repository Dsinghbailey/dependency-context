#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { z } from "zod";
import { analyzeAndIndexDependencies } from "./capabilities/analyze";
import { searchDependencyDocs } from "./capabilities/search";

// Server configuration
const PORT = process.env.DC_PORT ? parseInt(process.env.DC_PORT, 10) : 3006;

const server = new FastMCP({
  name: "Dependency Documentation Server",
  version: "1.0.4",
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
