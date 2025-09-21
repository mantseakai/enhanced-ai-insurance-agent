// File: backend/src/core/llm/interfaces/LLMProvider.ts

export interface LLMConfig {
  provider: 'openai' | 'claude' | 'local_llama' | 'deepseek';
  apiKey?: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retries?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage?: {
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  isInitialized: boolean;
  
  /**
   * Initialize the LLM provider
   */
  initialize(config: LLMConfig): Promise<void>;
  
  /**
   * Generate a chat completion
   */
  generateCompletion(
    messages: LLMMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      timeout?: number;
    }
  ): Promise<LLMResponse>;
  
  /**
   * Generate embeddings for text
   */
  generateEmbedding(text: string): Promise<EmbeddingResponse>;
  
  /**
   * Check if the provider supports embeddings
   */
  supportsEmbeddings(): boolean;
  
  /**
   * Get provider capabilities
   */
  getCapabilities(): {
    maxContextLength: number;
    supportsStreaming: boolean;
    supportsEmbeddings: boolean;
    costPerToken: number;
    averageLatency: number;
  };
  
  /**
   * Get provider health status
   */
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    errorRate: number;
    lastCheck: Date;
  }>;
  
  /**
   * Estimate cost for a request
   */
  estimateCost(promptTokens: number, completionTokens?: number): number;
  
  /**
   * Cleanup and disconnect
   */
  disconnect(): Promise<void>;
}

export interface LLMProviderFactory {
  createProvider(config: LLMConfig): LLMProvider;
  getSupportedProviders(): string[];
}