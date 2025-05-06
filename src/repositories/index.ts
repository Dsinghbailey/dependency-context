import axios from 'axios';
import { Dependency } from '../parsers';
import { Config } from '../config';

export interface Repository {
  name: string;
  owner: string;
  url: string;
  ref: string; // Git reference (tag, branch, commit)
}

/**
 * Find the GitHub repository for a dependency
 */
export async function findGitHubRepository(
  dependency: Dependency, 
  config?: Config
): Promise<Repository | null> {
  try {
    // First try directly with npm or PyPI registry
    let repo: Repository | null = null;
    
    if (dependency.type === 'npm') {
      repo = await findNpmRepository(dependency, config);
    } else if (dependency.type === 'python') {
      repo = await findPythonRepository(dependency, config);
    }
    
    if (repo) return repo;
    
    // If registry lookup fails, try a GitHub search
    return await findViaGitHubSearch(dependency, config);
  } catch (error) {
    console.error(`Error finding repository for ${dependency.name}:`, error);
    return null;
  }
}

/**
 * Find repository info from npm registry
 */
async function findNpmRepository(
  dependency: Dependency, 
  config?: Config
): Promise<Repository | null> {
  try {
    const url = `https://registry.npmjs.org/${dependency.name}`;
    const response = await axios.get(url);
    const data = response.data;
    
    // Check if repository info exists in the package metadata
    if (data.repository) {
      let repoUrl = '';
      
      if (typeof data.repository === 'string') {
        repoUrl = data.repository;
      } else if (data.repository.url) {
        repoUrl = data.repository.url;
      }
      
      // Convert git URL format to HTTPS format if needed
      repoUrl = repoUrl.replace(/^git\+|\+git$|git:/g, '');
      repoUrl = repoUrl.replace(/^ssh:\/\/git@|^\/\/|^github:/g, '');
      
      if (!repoUrl.startsWith('http')) {
        repoUrl = `https://${repoUrl}`;
      }
      
      // Extract owner and repo name from URL
      const match = repoUrl.match(/github\.com[\/:]([\w.-]+)\/([\w.-]+)/);
      if (match) {
        const owner = match[1];
        const name = match[2].replace(/\.git$/, '');
        
        // Find the best matching version/tag
        const ref = await findBestMatchingRef(owner, name, dependency.version, config);
        
        return {
          name,
          owner,
          url: `https://github.com/${owner}/${name}`,
          ref: ref || 'main' // Default to main if no matching tag is found
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding npm repository for ${dependency.name}:`, error);
    return null;
  }
}

/**
 * Find repository info from PyPI
 */
async function findPythonRepository(
  dependency: Dependency,
  config?: Config
): Promise<Repository | null> {
  try {
    const url = `https://pypi.org/pypi/${dependency.name}/json`;
    const response = await axios.get(url);
    const data = response.data;
    
    // Check various places where repository info might be stored
    let repoUrl = '';
    
    if (data.info.project_urls) {
      // Try common keys that might contain the repository URL
      const sources = [
        data.info.project_urls['Source'],
        data.info.project_urls['Source Code'],
        data.info.project_urls['Code'],
        data.info.project_urls['Repository'],
        data.info.project_urls['GitHub'],
        data.info.home_page
      ];
      
      repoUrl = sources.find(url => url && url.includes('github.com')) || '';
    }
    
    // If no repo URL found in project_urls, try home_page
    if (!repoUrl && data.info.home_page && data.info.home_page.includes('github.com')) {
      repoUrl = data.info.home_page;
    }
    
    if (repoUrl) {
      // Extract owner and repo name from URL
      const match = repoUrl.match(/github\.com[\/:]([\w.-]+)\/([\w.-]+)/);
      if (match) {
        const owner = match[1];
        const name = match[2].replace(/\.git$/, '');
        
        // Find the best matching version/tag
        const ref = await findBestMatchingRef(owner, name, dependency.version, config);
        
        return {
          name,
          owner,
          url: `https://github.com/${owner}/${name}`,
          ref: ref || 'main' // Default to main if no matching tag is found
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding PyPI repository for ${dependency.name}:`, error);
    return null;
  }
}

/**
 * Find repository via GitHub search
 */
async function findViaGitHubSearch(
  dependency: Dependency,
  config?: Config
): Promise<Repository | null> {
  try {
    // Note: You may need a GitHub API token for rate limiting
    const query = encodeURIComponent(`${dependency.name} in:name fork:false`);
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc`;
    
    const githubToken = config?.githubToken || process.env.GITHUB_TOKEN;
    
    const response = await axios.get(url, {
      headers: githubToken ? {
        Authorization: `token ${githubToken}`
      } : {}
    });
    
    const data = response.data;
    
    if (data.items && data.items.length > 0) {
      const repo = data.items[0]; // Get the most popular matching repository
      
      // Find the best matching version/tag
      const ref = await findBestMatchingRef(repo.owner.login, repo.name, dependency.version, config);
      
      return {
        name: repo.name,
        owner: repo.owner.login,
        url: repo.html_url,
        ref: ref || 'main'
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching GitHub for ${dependency.name}:`, error);
    return null;
  }
}

/**
 * Find the best matching Git reference (tag, branch) for a dependency version
 */
async function findBestMatchingRef(
  owner: string, 
  repo: string, 
  version: string, 
  config?: Config
): Promise<string | null> {
  try {
    // Get repository tags
    const url = `https://api.github.com/repos/${owner}/${repo}/tags`;
    
    const githubToken = config?.githubToken || process.env.GITHUB_TOKEN;
    
    const response = await axios.get(url, {
      headers: githubToken ? {
        Authorization: `token ${githubToken}`
      } : {}
    });
    
    const tags = response.data;
    
    if (!tags || tags.length === 0) {
      return null;
    }
    
    // Look for exact version match (with or without leading 'v')
    let exactMatch = tags.find((tag: any) => 
      tag.name === version || 
      tag.name === `v${version}`);
    
    if (exactMatch) {
      return exactMatch.name;
    }
    
    // If no exact match, find the closest match
    // This is a simplified version; a more sophisticated semver comparison could be implemented
    const versionNumbers = version.split('.').map(Number);
    let closestMatch = null;
    let closestDistance = Infinity;
    
    for (const tag of tags) {
      // Clean tag name (remove 'v' prefix if present)
      const cleanTag = tag.name.startsWith('v') ? tag.name.substring(1) : tag.name;
      
      // Skip if not a version number format
      if (!/^\d+(\.\d+)*$/.test(cleanTag)) {
        continue;
      }
      
      const tagNumbers = cleanTag.split('.').map(Number);
      
      // Calculate version distance (simplified)
      let distance = 0;
      for (let i = 0; i < Math.max(versionNumbers.length, tagNumbers.length); i++) {
        const vNum = i < versionNumbers.length ? versionNumbers[i] : 0;
        const tNum = i < tagNumbers.length ? tagNumbers[i] : 0;
        distance += Math.abs(vNum - tNum) * Math.pow(100, 3 - i); // Weight earlier numbers more
      }
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestMatch = tag.name;
      }
    }
    
    return closestMatch;
  } catch (error) {
    console.error(`Error finding matching ref for ${owner}/${repo}@${version}:`, error);
    return null;
  }
}