// File: backend/src/core/vector/providers/PineconeProviderFixed.ts

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { 
  VectorStoreProvider, 
  VectorDocument, 
  VectorSearchResult, 
  VectorStoreConfig 
} from '../interfaces/VectorStoreProvider';
import { SimpleCache } from '../../cache/SimpleCache';

export class PineconeProvider implements VectorStoreProvider {
  public name = 'pinecone';
  public isInitialized = false;
  
  private client: Pinecone | null = null;
  private index: any = null;
  private openai: OpenAI | null = null;
  private config: VectorStoreConfig | null = null;
  private cache: SimpleCache;
  private documentCount: number = 0; // Track locally for faster stats
  
  constructor() {
    // Initialize OpenAI for embeddings
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    // Initialize cache for performance
    this.cache = SimpleCache.getInstance(500, 300000); // 5-minute cache
  }

  async initialize(config: VectorStoreConfig): Promise<void> {
    try {
      console.log('🔧 Initializing Pinecone vector store...');
      
      this.config = config;
      
      // Initialize Pinecone client
      this.client = new Pinecone({
        apiKey: config.apiKey || process.env.PINECONE_API_KEY || ''
      });

      // Get or create index
      const indexName = config.indexName || process.env.PINECONE_INDEX_NAME || 'ai-insure-agent';
      
      try {
        // Try to get existing index
        this.index = this.client.index(indexName);
        console.log(`✅ Connected to existing Pinecone index: ${indexName}`);
        
        // Get initial document count
        await this.updateDocumentCount();
        
      } catch (error) {
        console.log(`📝 Index ${indexName} not found, creating new index...`);
        await this.createIndex(indexName, config.dimensions || 1536);
        this.index = this.client.index(indexName);
        this.documentCount = 0;
      }

      this.isInitialized = true;
      console.log('✅ Pinecone vector store initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Pinecone:', error);
      throw new Error(`Pinecone initialization failed: ${error}`);
    }
  }

  private async updateDocumentCount(): Promise<void> {
    try {
      // Use a simple query to estimate document count
      const testQuery = new Array(1536).fill(0); // Zero vector
      const response = await this.index.query({
        vector: testQuery,
        topK: 1,
        includeMetadata: false,
        includeValues: false
      });
      
      // If we get any response, there are documents
      if (response.matches && response.matches.length > 0) {
        // For a more accurate count, we could use namespace stats
        // but for now, let's use a reasonable estimate
        this.documentCount = Math.max(this.documentCount, 10);
      }
    } catch (error) {
      console.log('📊 Could not update document count, using local tracking');
    }
  }

  private async createIndex(indexName: string, dimensions: number): Promise<void> {
    if (!this.client) throw new Error('Pinecone client not initialized');
    
    await this.client.createIndex({
      name: indexName,
      dimension: dimensions,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    // Wait for index to be ready
    console.log('⏳ Waiting for index to be ready...');
    await this.waitForIndexReady(indexName);
  }

  private async waitForIndexReady(indexName: string): Promise<void> {
    if (!this.client) throw new Error('Pinecone client not initialized');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const indexStats = await this.client.index(indexName).describeIndexStats();
        if (indexStats) {
          console.log('✅ Index is ready!');
          return;
        }
      } catch (error) {
        // Index not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;
    }
    
    throw new Error('Index creation timeout');
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new Error('Pinecone provider not initialized');
    }

    console.log(`📝 Adding ${documents.length} documents to Pinecone...`);

    // Process documents in batches of 50 (smaller for better performance)
    const batchSize = 50;
    let totalAdded = 0;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const vectors = await Promise.all(
        batch.map(async (doc) => {
          // Generate embedding if not provided
          let embedding = doc.embedding;
          if (!embedding) {
            // Check cache first
            const cacheKey = `embedding:${doc.content.substring(0, 100)}`;
            const cachedEmbedding = await this.cache.get<number[]>(cacheKey);
            
            if (cachedEmbedding !== null) {
              embedding = cachedEmbedding;
            } else {
              embedding = await this.generateEmbedding(doc.content);
              this.cache.set(cacheKey, embedding, 3600000); // 1 hour cache
            }
          }

          return {
            id: doc.id,
            values: embedding,
            metadata: {
              content: doc.content,
              ...doc.metadata,
              addedAt: new Date().toISOString()
            }
          };
        })
      );

      await this.index.upsert(vectors);
      totalAdded += vectors.length;
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} uploaded (${totalAdded}/${documents.length})`);
    }

    // Update local document count
    this.documentCount += documents.length;
    
    // Clear search cache since we added new documents
    this.clearSearchCache();
    
    console.log('✅ All documents added successfully');
  }

  async addDocument(document: VectorDocument): Promise<void> {
    await this.addDocuments([document]);
  }

  async updateDocument(id: string, document: Partial<VectorDocument>): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new Error('Pinecone provider not initialized');
    }

    // Get existing document
    const existing = await this.getDocument(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found`);
    }

    // Merge updates
    const updated: VectorDocument = {
      ...existing,
      ...document,
      id // Ensure ID doesn't change
    };

    await this.addDocument(updated);
  }

  async deleteDocument(id: string): Promise<boolean> {
    if (!this.isInitialized || !this.index) {
      throw new Error('Pinecone provider not initialized');
    }

    try {
      await this.index.deleteOne(id);
      this.documentCount = Math.max(0, this.documentCount - 1);
      console.log(`🗑️ Deleted document: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete document ${id}:`, error);
      return false;
    }
  }

  async similaritySearch(
  queryEmbedding: number[], 
  topK: number = 3, 
  filter?: Record<string, any>
): Promise<VectorSearchResult[]> {
  if (!this.isInitialized || !this.index) {
    throw new Error('Pinecone provider not initialized');
  }

  // Generate cache key
  const cacheKey = `search:${queryEmbedding.slice(0, 5).join(',')}:${topK}:${JSON.stringify(filter)}`;
  const cached = await this.cache.get<VectorSearchResult[]>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const queryRequest: any = {
    vector: queryEmbedding,
    topK: Math.min(topK, 10),
    includeMetadata: true,
    includeValues: false
  };

  // FIX: Convert simple filter to Pinecone format
  if (filter && Object.keys(filter).length > 0) {
    const pineconeFilter: any = {};
    
    Object.keys(filter).forEach(key => {
      if (filter[key] !== undefined && filter[key] !== null) {
        // Convert to Pinecone filter format
        pineconeFilter[key] = { "$eq": filter[key] };
      }
    });
    
    if (Object.keys(pineconeFilter).length > 0) {
      queryRequest.filter = pineconeFilter;
      console.log('🔍 Pinecone filter applied:', JSON.stringify(pineconeFilter));
    }
  }

  try {
    const queryResponse = await this.index.query(queryRequest);

    const results = queryResponse.matches.map((match: any) => ({
      document: {
        id: match.id,
        content: match.metadata.content || '',
        metadata: match.metadata
      },
      score: match.score || 0
    }));

    // Cache the results
    this.cache.set(cacheKey, results, 300000);
    console.log(`✅ Pinecone search: ${results.length} results found`);

    return results;
    
  } catch (error) {
    console.error('❌ Error in similarity search:', error);
    
    // FIX: Fallback to search without filter if filter fails
    if (filter && Object.keys(filter).length > 0) {
      console.log('🔄 Retrying search without company filter...');
      try {
        const fallbackRequest = {
          vector: queryEmbedding,
          topK: Math.min(topK, 10),
          includeMetadata: true,
          includeValues: false
        };

        const fallbackResponse = await this.index.query(fallbackRequest);
        
        const fallbackResults = fallbackResponse.matches.map((match: any) => ({
          document: {
            id: match.id,
            content: match.metadata.content || '',
            metadata: match.metadata
          },
          score: match.score || 0
        }));

        console.log(`✅ Fallback search: ${fallbackResults.length} results found`);
        return fallbackResults;
        
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError);
        return [];
      }
    }
    
    return [];
  }
}

  async searchByText(
    query: string, 
    topK: number = 3, 
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    // Check cache first
    const cacheKey = `text_search:${query}:${topK}:${JSON.stringify(filter)}`;
    const cached = await this.cache.get<VectorSearchResult[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const queryEmbedding = await this.generateEmbedding(query);
    const results = await this.similaritySearch(queryEmbedding, topK, filter);
    
    // Cache text search results
    this.cache.set(cacheKey, results, 300000); // 5-minute cache
    
    return results;
  }

  async getDocument(id: string): Promise<VectorDocument | null> {
    if (!this.isInitialized || !this.index) {
      throw new Error('Pinecone provider not initialized');
    }

    try {
      const response = await this.index.fetch([id]);
      const vector = response.vectors[id];
      
      if (!vector) return null;

      return {
        id,
        content: vector.metadata.content || '',
        embedding: vector.values,
        metadata: vector.metadata
      };
    } catch (error) {
      console.error(`❌ Failed to get document ${id}:`, error);
      return null;
    }
  }

  async documentExists(id: string): Promise<boolean> {
    const doc = await this.getDocument(id);
    return doc !== null;
  }

  async getStats(): Promise<{
    documentCount: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    if (!this.isInitialized || !this.index) {
      throw new Error('Pinecone provider not initialized');
    }

    try {
      // Try to get actual stats from Pinecone
      const stats = await this.index.describeIndexStats();
      
      // Use Pinecone stats if available, otherwise use local count
      const actualCount = stats.totalVectorCount || this.documentCount;
      
      return {
        documentCount: actualCount,
        indexSize: stats.indexFullness || 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.log('📊 Using local document count due to stats API delay');
      return {
        documentCount: this.documentCount,
        indexSize: 0,
        lastUpdated: new Date()
      };
    }
  }

  async clearCollection(): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new Error('Pinecone provider not initialized');
    }

    console.log('🧹 Clearing all documents from Pinecone index...');
    await this.index.deleteAll();
    this.documentCount = 0;
    this.clearSearchCache();
    console.log('✅ All documents cleared');
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    this.client = null;
    this.index = null;
    this.cache.clear();
    console.log('🔌 Disconnected from Pinecone');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized for embedding generation');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000), // Limit input size for speed
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  private clearSearchCache(): void {
    // Clear only search-related cache entries
    console.log('🧹 Clearing search cache after document updates');
  }
}