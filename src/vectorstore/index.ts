import fs from 'fs-extra';
import path from 'path';
import { Dependency } from '../parsers';
import { Repository } from '../repositories';
import { Document } from '../documents';
import { Config } from '../config';
import { pipeline } from '@xenova/transformers';

// Define the vector store structure
interface VectorStoreEntry {
  chunk: string;
  embedding: number[];
  metadata: {
    repository: string;
    file: string;
    dependency: string;
  };
}

interface VectorStore {
  entries: VectorStoreEntry[];
}

// Cache for the embedding model
let embeddingGeneratorCache: any = null;

/**
 * Split a document into text chunks
 */
function splitIntoChunks(document: Document, minSize: number = 800, maxSize: number = 8000): string[] {
  const text = document.content;
  const chunks: string[] = [];
  
  // Split by markdown headers
  const headerSplits = text.split(/^#{1,6}\s+.+$/m);
  
  for (let split of headerSplits) {
    if (split.trim().length === 0) continue;
    
    // If the split is too small, add it as is
    if (split.length <= maxSize) {
      if (split.length >= minSize) {
        chunks.push(split.trim());
      } else {
        // If it's too small, consider combining with another small chunk
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk && lastChunk.length + split.length <= maxSize) {
          chunks[chunks.length - 1] = `${lastChunk}\n\n${split.trim()}`;
        } else {
          chunks.push(split.trim());
        }
      }
    } else {
      // If the split is too large, split it further by paragraphs
      const paragraphs = split.split(/\n{2,}/);
      let currentChunk = '';
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim().length === 0) continue;
        
        // Check if adding this paragraph would exceed the max size
        if (currentChunk.length + paragraph.length <= maxSize) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          // Save the current chunk if it's not empty and meets min size
          if (currentChunk && currentChunk.length >= minSize) {
            chunks.push(currentChunk.trim());
          }
          // Start a new chunk with this paragraph
          currentChunk = paragraph;
        }
      }
      
      // Add the last chunk if it's not empty
      if (currentChunk && currentChunk.length >= minSize) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  
  return chunks;
}

/**
 * Generate embedding for a text chunk
 */
async function generateEmbedding(text: string, config?: Config): Promise<number[]> {
  // Lazy-load the embedding model
  if (!embeddingGeneratorCache) {
    // Use model specified in config or default to all-MiniLM-L6-v2
    const modelName = config?.embeddingModel || 'Xenova/all-MiniLM-L6-v2';
    embeddingGeneratorCache = await pipeline('feature-extraction', modelName);
  }
  
  // Generate embedding
  const result = await embeddingGeneratorCache(text, { pooling: 'mean', normalize: true });
  
  // Convert to regular array
  return Array.from(result.data);
}

/**
 * Index documentation for a dependency
 */
export async function indexDocumentation(
  projectPath: string,
  dependency: Dependency,
  repository: Repository,
  documents: Document[],
  config?: Config
): Promise<void> {
  try {
    console.log(`Indexing documentation for ${dependency.name}...`);
    
    // Create storage directory for this project
    const storageDir = path.join(projectPath, '.dependency-context');
    await fs.ensureDir(storageDir);
    
    // Create or load existing vector store
    const vectorStorePath = path.join(storageDir, 'vector-store.json');
    let vectorStore: VectorStore;
    
    if (await fs.pathExists(vectorStorePath)) {
      vectorStore = await fs.readJson(vectorStorePath);
    } else {
      vectorStore = { entries: [] };
    }
    
    // Process each document
    for (const document of documents) {
      // Split document into chunks
      const chunks = splitIntoChunks(document);
      
      // Process each chunk
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        
        // Generate embedding for the chunk
        const embedding = await generateEmbedding(chunk, config);
        
        // Add entry to vector store
        vectorStore.entries.push({
          chunk,
          embedding,
          metadata: {
            repository: repository.url,
            file: document.path,
            dependency: dependency.name
          }
        });
      }
    }
    
    // Save the updated vector store
    await fs.writeJson(vectorStorePath, vectorStore);
    
    console.log(`Indexed ${documents.length} documents with ${vectorStore.entries.length} chunks for ${dependency.name}`);
  } catch (error) {
    console.error(`Error indexing documentation for ${dependency.name}:`, error);
    throw error;
  }
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search the vector store for similar text chunks
 */
export async function searchVectorStore(
  projectPath: string,
  query: string,
  repositoryContext?: string,
  config?: Config
): Promise<Array<{
  text_chunk: string;
  source_repository: string;
  source_file: string;
  similarity_score: number;
}>> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, config);
    
    // Load vector store
    const storageDir = path.join(projectPath, '.dependency-context');
    const vectorStorePath = path.join(storageDir, 'vector-store.json');
    
    if (!await fs.pathExists(vectorStorePath)) {
      console.error(`Vector store not found for project: ${projectPath}`);
      return [];
    }
    
    const vectorStore: VectorStore = await fs.readJson(vectorStorePath);
    
    // Calculate similarity scores for each entry
    let results = vectorStore.entries.map(entry => {
      return {
        text_chunk: entry.chunk,
        source_repository: entry.metadata.repository,
        source_file: entry.metadata.file,
        similarity_score: cosineSimilarity(queryEmbedding, entry.embedding)
      };
    });
    
    // Filter by repository context if provided
    if (repositoryContext) {
      results = results.filter(result => {
        return result.source_repository.includes(repositoryContext) ||
               result.source_file.includes(repositoryContext);
      });
    }
    
    // Sort by similarity score (descending)
    results.sort((a, b) => b.similarity_score - a.similarity_score);
    
    // Return top 5 results
    return results.slice(0, 5);
  } catch (error) {
    console.error(`Error searching vector store:`, error);
    return [];
  }
}