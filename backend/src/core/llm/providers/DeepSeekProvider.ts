// File: backend/src/core/llm/providers/DeepSeekProvider.ts

import { 
  LLMProvider, 
  LLMConfig, 
  LLMMessage, 
  LLMResponse, 
  EmbeddingResponse 
} from '../interfaces/LLMProvider';

export class DeepSeekProvider implements LLMProvider {
  public name = 'deepseek';
  public isInitialized = false;
  
  private apiKey: string | null = null;
  private config: LLMConfig | null = null;
  private baseURL: string = 'https://api.deepseek.com/v1';
  private healthMetrics = {
    errorCount: 0,
    requestCount: 0,
    totalLatency: 0,
    lastCheck: new Date()
  };

  async initialize(config: LLMConfig): Promise<void> {
    try {
      console.log('🔧 Initializing DeepSeek provider...');
      
      this.config = config;
      this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || null;
      this.baseURL = config.baseURL || 'https://api.deepseek.com/v1';
      
      if (!this.apiKey) {
        throw new Error('DeepSeek API key is required');
      }

      // Test connection
      await this.testConnection();
      
      this.isInitialized = true;
      console.log('✅ DeepSeek provider initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize DeepSeek provider:', error);
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
    if (!this.isInitialized || !this.apiKey || !this.config) {
      throw new Error('DeepSeek provider not initialized');
    }

    const startTime = Date.now();
    this.healthMetrics.requestCount++;

    try {
      const requestBody = {
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_tokens: options?.maxTokens || this.config.maxTokens || 500,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        stream: false
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options?.timeout || this.config.timeout || 30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const latency = Date.now() - startTime;
      this.healthMetrics.totalLatency += latency;

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        model: data.model,
        finishReason: data.choices[0]?.finish_reason || 'stop'
      };

    } catch (error) {
      this.healthMetrics.errorCount++;
      console.error('❌ DeepSeek completion failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    // DeepSeek doesn't provide embeddings API, fall back to OpenAI
    throw new Error('DeepSeek provider does not support embeddings. Use OpenAI or another provider for embeddings.');
  }

  supportsEmbeddings(): boolean {
    return false;
  }

  getCapabilities() {
    const model = this.config?.model || 'deepseek-chat';
    
    // Model-specific capabilities
    const capabilities = {
      'deepseek-chat': {
        maxContextLength: 32768,
        costPerToken: 0.0000014, // $0.0014 per 1K tokens
        averageLatency: 2000
      },
      'deepseek-coder': {
        maxContextLength: 16384,
        costPerToken: 0.0000014,
        averageLatency: 2500
      }
    };

    const modelCaps = capabilities[model as keyof typeof capabilities] || capabilities['deepseek-chat'];

    return {
      ...modelCaps,
      supportsStreaming: true,
      supportsEmbeddings: false
    };
  }

  async getHealthStatus() {
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

      if (currentLatency > 8000 || errorRate > 0.1) {
        status = 'degraded';
      }
      if (currentLatency > 15000 || errorRate > 0.3) {
        status = 'unhealthy';
      }

    } catch (error) {
      status = 'unhealthy';
      currentLatency = 30000;
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
    this.apiKey = null;
    this.config = null;
    console.log('🔌 DeepSeek provider disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.apiKey || !this.config) {
      throw new Error('DeepSeek provider not properly configured');
    }

    // Simple test request
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        temperature: 0
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API test failed: ${response.status}`);
    }
  }
}