// File: backend/src/core/llm/providers/OpenAIProvider.ts

import OpenAI from 'openai';
import { 
  LLMProvider, 
  LLMConfig, 
  LLMMessage, 
  LLMResponse, 
  EmbeddingResponse 
} from '../interfaces/LLMProvider';

export class OpenAIProvider implements LLMProvider {
  public name = 'openai';
  public isInitialized = false;
  
  private client: OpenAI | null = null;
  private config: LLMConfig | null = null;
  private healthMetrics = {
    errorCount: 0,
    requestCount: 0,
    totalLatency: 0,
    lastCheck: new Date()
  };

  async initialize(config: LLMConfig): Promise<void> {
    try {
      console.log('🔧 Initializing OpenAI provider...');
      
      this.config = config;
      
      this.client = new OpenAI({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
        timeout: config.timeout || 30000,
        maxRetries: config.retries || 2
      });

      // Test connection
      await this.testConnection();
      
      this.isInitialized = true;
      console.log('✅ OpenAI provider initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI provider:', error);
      throw error;
    }
  }

  async generateCompletion(
    messages: LLMMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      timeout?: number;
    }
  ): Promise<LLMResponse> {
    if (!this.isInitialized || !this.client || !this.config) {
      throw new Error('OpenAI provider not initialized');
    }

    const startTime = Date.now();
    this.healthMetrics.requestCount++;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_tokens: options?.maxTokens || this.config.maxTokens || 500,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7
      });

      const latency = Date.now() - startTime;
      this.healthMetrics.totalLatency += latency;

      return {
        content: response.choices[0]?.message?.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || 'stop'
      };

    } catch (error) {
      this.healthMetrics.errorCount++;
      console.error('❌ OpenAI completion failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.isInitialized || !this.client) {
      throw new Error('OpenAI provider not initialized');
    }

    const startTime = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
        encoding_format: 'float'
      });

      const latency = Date.now() - startTime;
      this.healthMetrics.totalLatency += latency;
      this.healthMetrics.requestCount++;

      return {
        embedding: response.data[0].embedding,
        model: response.model,
        usage: {
          totalTokens: response.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      this.healthMetrics.errorCount++;
      console.error('❌ OpenAI embedding failed:', error);
      throw error;
    }
  }

  supportsEmbeddings(): boolean {
    return true;
  }

  getCapabilities() {
    const model = this.config?.model || 'gpt-3.5-turbo';
    
    // Model-specific capabilities
    const capabilities = {
      'gpt-4': {
        maxContextLength: 8192,
        costPerToken: 0.00003, // $0.03 per 1K tokens
        averageLatency: 3000
      },
      'gpt-4-turbo': {
        maxContextLength: 128000,
        costPerToken: 0.00001, // $0.01 per 1K tokens
        averageLatency: 2000
      },
      'gpt-3.5-turbo': {
        maxContextLength: 4096,
        costPerToken: 0.0000015, // $0.0015 per 1K tokens
        averageLatency: 1000
      }
    };

    const modelCaps = capabilities[model as keyof typeof capabilities] || capabilities['gpt-3.5-turbo'];

    return {
      ...modelCaps,
      supportsStreaming: true,
      supportsEmbeddings: true
    };
  }

  async getHealthStatus() {
    const now = Date.now();
    const avgLatency = this.healthMetrics.requestCount > 0 
      ? this.healthMetrics.totalLatency / this.healthMetrics.requestCount 
      : 0;
    const errorRate = this.healthMetrics.requestCount > 0 
      ? this.healthMetrics.errorCount / this.healthMetrics.requestCount 
      : 0;

    // Perform health check
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let currentLatency = 0;

    try {
      const testStart = Date.now();
      await this.testConnection();
      currentLatency = Date.now() - testStart;

      if (currentLatency > 10000 || errorRate > 0.1) {
        status = 'degraded';
      }
      if (currentLatency > 20000 || errorRate > 0.3) {
        status = 'unhealthy';
      }

    } catch (error) {
      status = 'unhealthy';
      currentLatency = 30000; // Max timeout
    }

    this.healthMetrics.lastCheck = new Date();

    return {
      status,
      latency: currentLatency,
      errorRate,
      lastCheck: this.healthMetrics.lastCheck
    };
  }

  estimateCost(promptTokens: number, completionTokens: number = 0): number {
    const capabilities = this.getCapabilities();
    return (promptTokens + completionTokens) * capabilities.costPerToken;
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    this.client = null;
    this.config = null;
    console.log('🔌 OpenAI provider disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    // Simple test request
    await this.client.chat.completions.create({
      model: this.config?.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1,
      temperature: 0
    });
  }
}