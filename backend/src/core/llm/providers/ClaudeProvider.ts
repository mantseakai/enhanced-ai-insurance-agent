// File: backend/src/core/llm/providers/ClaudeProvider.ts

import { 
  LLMProvider, 
  LLMConfig, 
  LLMMessage, 
  LLMResponse, 
  EmbeddingResponse 
} from '../interfaces/LLMProvider';

export class ClaudeProvider implements LLMProvider {
  public name = 'claude';
  public isInitialized = false;
  
  private apiKey: string | null = null;
  private config: LLMConfig | null = null;
  private healthMetrics = {
    errorCount: 0,
    requestCount: 0,
    totalLatency: 0,
    lastCheck: new Date()
  };

  async initialize(config: LLMConfig): Promise<void> {
    try {
      console.log('🔧 Initializing Claude provider...');
      
      this.config = config;
      this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || null;
      
      if (!this.apiKey) {
        throw new Error('Anthropic API key is required');
      }

      // Test connection
      await this.testConnection();
      
      this.isInitialized = true;
      console.log('✅ Claude provider initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Claude provider:', error);
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
      throw new Error('Claude provider not initialized');
    }

    const startTime = Date.now();
    this.healthMetrics.requestCount++;

    try {
      // Convert messages to Claude format
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const requestBody = {
        model: this.config.model,
        max_tokens: options?.maxTokens || this.config.maxTokens || 500,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        system: systemMessage,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options?.timeout || this.config.timeout || 30000)
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const latency = Date.now() - startTime;
      this.healthMetrics.totalLatency += latency;

      return {
        content: data.content[0]?.text || '',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        model: data.model,
        finishReason: data.stop_reason || 'stop'
      };

    } catch (error) {
      this.healthMetrics.errorCount++;
      console.error('❌ Claude completion failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    // Claude doesn't provide embeddings, fall back to OpenAI
    throw new Error('Claude provider does not support embeddings. Use OpenAI or another provider for embeddings.');
  }

  supportsEmbeddings(): boolean {
    return false;
  }

  getCapabilities() {
    const model = this.config?.model || 'claude-3-haiku-20240307';
    
    // Model-specific capabilities
    const capabilities = {
      'claude-3-opus-20240229': {
        maxContextLength: 200000,
        costPerToken: 0.000015, // $0.015 per 1K tokens input
        averageLatency: 4000
      },
      'claude-3-sonnet-20240229': {
        maxContextLength: 200000,
        costPerToken: 0.000003, // $0.003 per 1K tokens input
        averageLatency: 2500
      },
      'claude-3-haiku-20240307': {
        maxContextLength: 200000,
        costPerToken: 0.00000025, // $0.00025 per 1K tokens input
        averageLatency: 1500
      }
    };

    const modelCaps = capabilities[model as keyof typeof capabilities] || capabilities['claude-3-haiku-20240307'];

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

      if (currentLatency > 10000 || errorRate > 0.1) {
        status = 'degraded';
      }
      if (currentLatency > 20000 || errorRate > 0.3) {
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
    // Claude has different pricing for input/output tokens
    const inputCost = promptTokens * capabilities.costPerToken;
    const outputCost = completionTokens * capabilities.costPerToken * 3; // Output is ~3x more expensive
    return inputCost + outputCost;
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    this.apiKey = null;
    this.config = null;
    console.log('🔌 Claude provider disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.apiKey || !this.config) {
      throw new Error('Claude provider not properly configured');
    }

    // Simple test request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Claude API test failed: ${response.status}`);
    }
  }
}