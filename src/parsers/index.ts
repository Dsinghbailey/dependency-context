import fs from "fs-extra";
import path from "path";

export interface Dependency {
  name: string;
  version: string;
  type: "npm" | "python";
}

/**
 * Parse dependencies from project files
 */
export async function parseDependencies(
  projectPath: string
): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];

  // Check for custom dependency file
  const customDependencyPath = path.join(
    projectPath,
    "dependency-context.json"
  );
  if (await fs.pathExists(customDependencyPath)) {
    const customDeps = await parseDependencyContextJson(customDependencyPath);
    dependencies.push(...customDeps);
    return dependencies;
  }

  // Check for package.json (Node.js projects)
  const packageJsonPath = path.join(projectPath, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    const npmDeps = await parsePackageJson(packageJsonPath);
    dependencies.push(...npmDeps);
    return dependencies;
  }

  // Check for requirements.txt (Python projects)
  const requirementsPath = path.join(projectPath, "requirements.txt");
  if (await fs.pathExists(requirementsPath)) {
    const pythonDeps = await parseRequirementsTxt(requirementsPath);
    dependencies.push(...pythonDeps);
    return dependencies;
  }

  return dependencies;
}

/**
 * Parse dependencies from dependency-context.json
 */
async function parseDependencyContextJson(
  filePath: string
): Promise<Dependency[]> {
  try {
    const content = await fs.readJson(filePath);
    const dependencies: Dependency[] = [];

    // Process regular dependencies
    if (content) {
      Object.entries(content).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: String(version).replace(/[^0-9.]/g, ""),
          type: "npm",
        });
      });
    }

    return dependencies;
  } catch (error) {
    console.error("Error parsing dependency-context.json:", error);
    return [];
  }
}

/**
 * Parse dependencies from package.json
 */
async function parsePackageJson(filePath: string): Promise<Dependency[]> {
  try {
    const content = await fs.readJson(filePath);
    const dependencies: Dependency[] = [];

    // Process regular dependencies
    if (content.dependencies) {
      Object.entries(content.dependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: String(version).replace(/[^0-9.]/g, ""),
          type: "npm",
        });
      });
    }

    // Process dev dependencies
    if (content.devDependencies) {
      Object.entries(content.devDependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: String(version).replace(/[^0-9.]/g, ""),
          type: "npm",
        });
      });
    }

    return dependencies;
  } catch (error) {
    console.error("Error parsing package.json:", error);
    return [];
  }
}

/**
 * Parse dependencies from requirements.txt
 */
async function parseRequirementsTxt(filePath: string): Promise<Dependency[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const dependencies: Dependency[] = [];

    // Split by lines and process each line
    const lines = content.split("\n");

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      // Basic parsing for package==version or package>=version formats
      const equalMatch = trimmedLine.match(/^([\w.-]+)[=<>~!]=+([\w.-]+)/);

      if (equalMatch) {
        dependencies.push({
          name: equalMatch[1],
          version: equalMatch[2],
          type: "python",
        });
        continue;
      }

      // Handle simple package names without version specifiers
      const packageMatch = trimmedLine.match(/^([\w.-]+)/);
      if (packageMatch) {
        dependencies.push({
          name: packageMatch[1],
          version: "latest",
          type: "python",
        });
      }
    }

    return dependencies;
  } catch (error) {
    console.error("Error parsing requirements.txt:", error);
    return [];
  }
}
