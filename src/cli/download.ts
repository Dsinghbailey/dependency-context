import { parseDependencies } from "../parsers";
import { findGitHubRepository } from "../repositories";
import { downloadDependencyDocs } from "../documents";
import { getConfig } from "../config";
import fs from "fs-extra";
import path from "path";

/**
 * Downloads raw dependency documentation to a local folder without vectorization
 */
export async function downloadRawDependencyDocs(
  projectPath: string
): Promise<void> {
  try {
    // Validate project path
    if (!projectPath || !fs.existsSync(projectPath)) {
      console.error(`Invalid project path: ${projectPath}`);
      process.exit(1);
    }

    console.log(`Starting dependency documentation download for project at ${projectPath}`);

    // Get configuration (includes project-specific .env)
    const config = getConfig(projectPath);

    // Parse dependencies from project files
    const dependencies = await parseDependencies(projectPath);

    if (dependencies.length === 0) {
      console.error("No dependencies found in project");
      process.exit(1);
    }

    console.log(`Found ${dependencies.length} dependencies`);

    // Create main docs directory
    const docsDir = path.join(projectPath, "dependency-context");
    
    // Only remove if the directory already exists (no need for warning for new download)
    if (await fs.pathExists(docsDir)) {
      console.log(`Found existing dependency-context directory, files will be overwritten`);
    }
    
    await fs.ensureDir(docsDir);

    // Process each dependency
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const dep of dependencies) {
      try {
        console.log(`Processing dependency: ${dep.name}@${dep.version}`);

        // Find repository
        const repo = await findGitHubRepository(dep, config);

        if (!repo) {
          console.error(`Could not find GitHub repository for ${dep.name}@${dep.version}`);
          errorCount++;
          continue;
        }

        // Download documentation
        const depDocsDir = await downloadDependencyDocs(projectPath, dep, repo, config);
        successCount++;

        console.log(`Successfully downloaded documentation for ${dep.name} to ${depDocsDir}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing ${dep.name}: ${errorMessage}`);
        errorCount++;
      }
    }

    console.log("\nSummary:");
    console.log(`- Processed ${dependencies.length} dependencies`);
    console.log(`- Successfully downloaded: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    if (successCount > 0) {
      console.log(`\nDocumentation has been downloaded to: ${docsDir}`);
      console.log("You can now browse the raw markdown files directly in this folder.");
    }
    
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to download dependency documentation:", errorMessage);
    process.exit(1);
  }
}

// Direct execution (called from CLI script)
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectPath = args[0] ? path.resolve(args[0]) : process.cwd();
  
  downloadRawDependencyDocs(projectPath)
    .catch(error => {
      console.error("Error:", error.message);
      process.exit(1);
    });
}