// File: backend/src/core/vector/interfaces/VectorStoreProvider.ts

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
}

export interface VectorStoreConfig {
  provider: 'pinecone' | 'weaviate' | 'qdrant' | 'postgresql';
  apiKey?: string;
  environment?: string;
  indexName?: string;
  host?: string;
  dimensions?: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface VectorStoreProvider {
  name: string;
  isInitialized: boolean;
  
  /**
   * Initialize the vector store connection
   */
  initialize(config: VectorStoreConfig): Promise<void>;
  
  /**
   * Add documents to the vector store
   */
  addDocuments(documents: VectorDocument[]): Promise<void>;
  
  /**
   * Add a single document
   */
  addDocument(document: VectorDocument): Promise<void>;
  
  /**
   * Update an existing document
   */
  updateDocument(id: string, document: Partial<VectorDocument>): Promise<void>;
  
  /**
   * Delete a document by ID
   */
  deleteDocument(id: string): Promise<boolean>;
  
  /**
   * Perform similarity search
   */
  similaritySearch(
    queryEmbedding: number[], 
    topK: number, 
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]>;
  
  /**
   * Search by text (with embedding generation)
   */
  searchByText(
    query: string, 
    topK: number, 
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]>;
  
  /**
   * Get document by ID
   */
  getDocument(id: string): Promise<VectorDocument | null>;
  
  /**
   * Check if document exists
   */
  documentExists(id: string): Promise<boolean>;
  
  /**
   * Get collection/index statistics
   */
  getStats(): Promise<{
    documentCount: number;
    indexSize: number;
    lastUpdated: Date;
  }>;
  
  /**
   * Clear all documents from collection
   */
  clearCollection(): Promise<void>;
  
  /**
   * Close connection and cleanup
   */
  disconnect(): Promise<void>;
}