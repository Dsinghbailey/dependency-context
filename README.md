# Dependency Context

### by [@darianb](https://x.com/darianbailey14)

An MCP server that provides AI assistants with contextual access to your project's dependency documentation, enabling more accurate responses about libraries and frameworks used in your codebase.

## Configuration

The recommended way to specify which dependencies you want to index is by creating a custom `dependency-context.json` file in your project root. This allows you to:

- Only index the dependencies you're actively using and need help with
- Improve indexing speed by limiting the number of dependencies
- Focus the search results on the libraries that matter most

Create a `dependency-context.json` file in your project root with the following format:

```json
{
  "express": "^4.17.1",
  "axios": "1.0.0"
}
```

If a `dependency-context.json` file is not present, Dependency Context falls back to scanning `package.json` or `requirements.txt`.

## Quick Start

1. Add the MCP config to your editor (Cursor recommended):

```json
{
  "mcpServers": {
    "dependency-context": {
      "command": "npx",
      "args": ["-y", "--package=dependency-context", "dependency-context"],
      "env": {
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN_HERE", // Optional but recommended
        "MODEL_NAME": "Xenova/all-MiniLM-L6-v2", // Optional, default shown
        "DEBUG": "false", // Optional, default shown
        "MIN_CHUNK_SIZE": "800", // Optional, default shown
        "MAX_CHUNK_SIZE": "8000", // Optional, default shown
        "CHUNKS_RETURNED": "5" // Optional, default shown
      }
    }
  }
}
```

2. Enable the MCP in your editor

3. Prompt the AI to initialialize dependency-context

```
Can you initialize dependency-context?
```

4. Prompt the AI like you normally do. It will automatically pull in dependency-context when relevant

## MCP Capabilities

Dependency Context provides two main capabilities through its MCP interface:

### 1. InitializeDependencyIndex

Analyzes a project's dependencies and creates a searchable index of their documentation.

```json
{
  "capability": "InitializeDependencyIndex",
  "parameters": {
    "project_path": "/path/to/your/project",
    "env_vars": {
      "GITHUB_TOKEN": "your_github_token", // Optional but recommended
      "MODEL_NAME": "Xenova/all-MiniLM-L6-v2", // Optional, default shown
      "DEBUG": "true", // Optional
      "MIN_CHUNK_SIZE": "800", // Optional, default shown
      "MAX_CHUNK_SIZE": "8000" // Optional, default shown
    }
  }
}
```

This capability:

- Checks for a custom `dependencies.json` file (recommended)
- Falls back to scanning package.json or requirements.txt if no custom file exists
- Locates the GitHub repositories for each dependency
- Clones repositories and extracts Markdown documentation
- Creates vector embeddings for semantic search

### 2. searchDependencyDocs

Performs semantic search over indexed dependency documentation.

```json
{
  "capability": "searchDependencyDocs",
  "parameters": {
    "project_path": "/path/to/your/project",
    "query": "How do I handle authentication?",
    "repository_context": "express", // Optional: limit to a specific dependency
    "env_vars": {
      "MODEL_NAME": "Xenova/all-MiniLM-L6-v2",
      "CHUNKS_RETURNED": "5" // Optional, default shown
    }
  }
}
```

Returns:

- The most relevant documentation chunks matching your query
- Source information (repository, file path)
- Similarity scores for each result

## Architecture

Dependency Context is built with a modular TypeScript architecture:

- **Core Components**:

  - **Parsers**: Extract dependencies from package.json and requirements.txt
  - **Repository Discovery**: Locate GitHub repositories using registry metadata
  - **Document Fetching**: Clone repositories and extract documentation
  - **Vector Store**: Generate embeddings and enable semantic search
  - **MCP Server**: Provide a standardized interface for AI tools

- **Key Libraries**:
  - **fastmcp**: MCP protocol implementation
  - **@xenova/transformers**: Local embedding model for vector creation
  - **simple-git**: Git client for repository operations
  - **axios**: HTTP client for API requests
  - **fs-extra**: Enhanced file system operations
  - **dotenv**: Environment variable management

## Testing

### Unit Testing

Run the test suite with:

```bash
npm test
```

### Manual Testing

For manual testing, follow these steps:

1. **Set up a Test Project**

```bash
mkdir test-project
cd test-project

# Create a custom dependencies.json file (recommended approach)
echo '{
  "dependencies": {
    "express": "^4.17.1",
    "axios": "^1.0.0"
  }
}' > dependencies.json

# Alternatively, you can use standard dependency files:

# For Node.js projects
echo '{
  "dependencies": {
    "express": "^4.17.1",
    "axios": "^1.0.0"
  }
}' > package.json

# For Python projects
echo 'requests==2.26.0
numpy>=1.20.0' > requirements.txt
```

2. **Use fastmcp dev to test dependency-context**

````bash
# Build and make the CLI executable
cd /path/to/dependency-context
npx fastmcp dev src/index.ts

# Initialize and index dependencies (from your test project directory)
tool(InitializeDependencyIndex)

# Search for information in the indexed dependencies
tool(searchDependencyDocs)


## Troubleshooting

### GitHub API Rate Limits

If you encounter "API rate limit exceeded" errors:

1. Create a GitHub personal access token at https://github.com/settings/tokens
2. Set it as the `GITHUB_TOKEN` environment variable:
   ```bash
   export GITHUB_TOKEN=your_token_here
````

3. Or add it to your `.env` file:

   ```
   # Optional but recommended for higher API rate limits
   GITHUB_TOKEN=your_token_here

   # Optional settings with defaults shown below
   MIN_CHUNK_SIZE=800
   MAX_CHUNK_SIZE=8000
   CHUNKS_RETURNED=5
   ```

### Empty Search Results

If your searches return empty results:

1. Ensure the indexing process completed successfully
2. Check the console output for any error messages
3. Verify that your search query is relevant to the indexed dependencies
4. Try a more general query to see if any results are returned

### Permission Issues

If you encounter permission errors when accessing project directories:

1. Ensure the server has read/write access to the project directory
2. Check that temporary directories are accessible
3. Run the server with appropriate permissions

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/dependency-context.git

# Install dependencies
cd dependency-context
npm install

# Run locally with fastmcp dev
npx fastmcp dev src/index.ts
```

## Future Enhancements

- **Additional Package Managers**: Support for pom.xml, go.mod, and other dependency formats (note: custom dependencies.json is already supported as the recommended approach)
- **Incremental Indexing**: Avoid reprocessing unchanged repositories
- **Configurable Chunking**: Custom strategies for document splitting
- **Alternative Models**: Support for different embedding models
- **Caching Layer**: Improved performance for frequently accessed documentation

## Project Todo List

### High Priority

- [x] Set up basic project structure and dependencies
- [x] Implement dependency parser for package.json and requirements.txt
- [x] Create GitHub repository discovery functionality
- [x] Build documentation fetching and markdown processing
- [x] Implement vector store creation and indexing
- [x] Set up MCP endpoint for semantic search
- [x] Add environment variable support through multiple channels (system, project, MCP params)
- [x] Add parameters for chunk size and top-k returns to functions
- [ ] Add proper error handling and retry mechanisms for GitHub API

### Medium Priority

- [ ] Support for additional package managers (Maven, Go, Rust)
- [ ] Add progress reporting for long-running index operations
- [ ] Enhance chunking algorithm to better respect Markdown structure
- [ ] Support for non-GitHub repositories (GitLab, Bitbucket)

### Low Priority

- [x] Create comprehensive documentation

## License

Dependency Context is licensed under the MIT License with Commons Clause. This means you can:

✅ Allowed:

- Use Dependency Context for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Dependency Context

❌ Not Allowed:

- Sell Dependency Context itself
- Offer Dependency Context as a hosted service
- Create competing products based on Dependency Context

See the [LICENSE](LICENSE) file for the complete license text and licensing details for more information.

Copyright © 2024 DarianB
