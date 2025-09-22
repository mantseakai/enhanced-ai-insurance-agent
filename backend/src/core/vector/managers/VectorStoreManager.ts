// File: backend/src/core/vector/managers/VectorStoreManager.ts

import { VectorStoreProvider, VectorStoreConfig } from '../interfaces/VectorStoreProvider';
import { PineconeProvider } from '../providers/PineconeProvider';
import dotenv from 'dotenv';

dotenv.config();
export class VectorStoreManager {
  private static instance: VectorStoreManager;
  private providers: Map<string, VectorStoreProvider> = new Map();
  private activeProvider: VectorStoreProvider | null = null;

  private constructor() {}

  static getInstance(): VectorStoreManager {
    if (!VectorStoreManager.instance) {
      VectorStoreManager.instance = new VectorStoreManager();
    }
    return VectorStoreManager.instance;
  }

  /**
   * Initialize vector store based on environment configuration
   */
  async initialize(): Promise<VectorStoreProvider> {
    const providerType = process.env.VECTOR_STORE_PROVIDER || 'pinecone';
    
    console.log(`🔧 Initializing vector store: ${providerType}`);

    // Get or create provider
    let provider = this.providers.get(providerType);
    
    if (!provider) {
      provider = this.createProvider(providerType);
      this.providers.set(providerType, provider);
    }

    // Initialize provider if not already initialized
    if (!provider.isInitialized) {
      const config = this.getProviderConfig(providerType);
      await provider.initialize(config);
    }

    this.activeProvider = provider;
    console.log(`✅ Vector store ${providerType} is ready`);
    
    return provider;
  }

  /**
   * Get the active vector store provider
   */
  getActiveProvider(): VectorStoreProvider {
    if (!this.activeProvider) {
      throw new Error('No vector store provider is active. Call initialize() first.');
    }
    return this.activeProvider;
  }

  /**
   * Switch to a different vector store provider
   */
  async switchProvider(providerType: string): Promise<VectorStoreProvider> {
    console.log(`🔄 Switching to vector store: ${providerType}`);
    
    let provider = this.providers.get(providerType);
    
    if (!provider) {
      provider = this.createProvider(providerType);
      this.providers.set(providerType, provider);
    }

    if (!provider.isInitialized) {
      const config = this.getProviderConfig(providerType);
      await provider.initialize(config);
    }

    // Disconnect current provider if exists
    if (this.activeProvider && this.activeProvider !== provider) {
      await this.activeProvider.disconnect();
    }

    this.activeProvider = provider;
    console.log(`✅ Switched to vector store: ${providerType}`);
    
    return provider;
  }

  /**
   * Get provider configuration from environment variables
   */
  private getProviderConfig(providerType: string): VectorStoreConfig {
    const baseConfig: VectorStoreConfig = {
      provider: providerType as any,
      dimensions: 1536, // OpenAI ada-002 embedding dimension
      metric: 'cosine'
    };

    switch (providerType) {
      case 'pinecone':
        return {
          ...baseConfig,
          apiKey: process.env.PINECONE_API_KEY,
          environment: process.env.PINECONE_ENVIRONMENT,
          indexName: process.env.PINECONE_INDEX_NAME || 'ai-insure-agent'
        };
      
      case 'weaviate':
        return {
          ...baseConfig,
          host: process.env.WEAVIATE_HOST || 'http://localhost:8080',
          apiKey: process.env.WEAVIATE_API_KEY
        };
      
      case 'qdrant':
        return {
          ...baseConfig,
          host: process.env.QDRANT_HOST || 'http://localhost:6333',
          apiKey: process.env.QDRANT_API_KEY
        };
      
      default:
        throw new Error(`Unsupported vector store provider: ${providerType}`);
    }
  }

  /**
   * Create a provider instance based on type
   */
  private createProvider(providerType: string): VectorStoreProvider {
    switch (providerType) {
      case 'pinecone':
        return new PineconeProvider();
      
      // TODO: Add other providers when implemented
      case 'weaviate':
        throw new Error('Weaviate provider not yet implemented');
      
      case 'qdrant':
        throw new Error('Qdrant provider not yet implemented');
      
      default:
        throw new Error(`Unknown vector store provider: ${providerType}`);
    }
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): string[] {
    return ['pinecone']; // Add more as they're implemented
  }

  /**
   * Clean shutdown of all providers
   */
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down vector store manager...');
    
    for (const [name, provider] of this.providers) {
      if (provider.isInitialized) {
        console.log(`🔌 Disconnecting ${name}...`);
        await provider.disconnect();
      }
    }
    
    this.providers.clear();
    this.activeProvider = null;
    console.log('✅ Vector store manager shutdown complete');
  }
}