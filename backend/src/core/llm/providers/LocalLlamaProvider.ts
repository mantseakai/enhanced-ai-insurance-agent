// File: backend/src/core/llm/providers/LocalLlamaProvider.ts

import { 
  LLMProvider, 
  LLMConfig, 
  LLMMessage, 
  LLMResponse, 
  EmbeddingResponse 
} from '../interfaces/LLMProvider';

export class LocalLlamaProvider implements LLMProvider {
  public name = 'local_llama';
  public isInitialized = false;
  
  private baseURL: string = 'http://127.0.01:11434';
  private config: LLMConfig | null = null;
  private healthMetrics = {
    errorCount: 0,
    requestCount: 0,
    totalLatency: 0,
    lastCheck: new Date()
  };

  async initialize(config: LLMConfig): Promise<void> {
    try {
      console.log('🔧 Initializing Local Llama provider...');
      
      this.config = config;
      this.baseURL = config.baseURL || process.env.LOCAL_LLM_ENDPOINT || 'http://127.0.0.1:11434';

      // Test connection to Ollama
      await this.testConnection();
      
      this.isInitialized = true;
      console.log('✅ Local Llama provider initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Local Llama provider:', error);
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
    if (!this.isInitialized || !this.config) {
      throw new Error('Local Llama provider not initialized');
    }

    const startTime = Date.now();
    this.healthMetrics.requestCount++;

    try {
      // Convert messages to a single prompt for Ollama
      const prompt = this.convertMessagesToPrompt(messages);

      const requestBody = {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          num_predict: options?.maxTokens || this.config.maxTokens || 500,
          top_k: 40,
          top_p: 0.9
        }
      };

      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options?.timeout || this.config.timeout || 60000) // Local models can be slower
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const latency = Date.now() - startTime;
      this.healthMetrics.totalLatency += latency;

      return {
        content: data.response || '',
        usage: {
          promptTokens: this.estimateTokens(prompt),
          completionTokens: this.estimateTokens(data.response || ''),
          totalTokens: this.estimateTokens(prompt) + this.estimateTokens(data.response || '')
        },
        model: data.model || this.config.model,
        finishReason: data.done ? 'stop' : 'length'
      };

    } catch (error) {
      this.healthMetrics.errorCount++;
      console.error('❌ Local Llama completion failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.isInitialized || !this.config) {
      throw new Error('Local Llama provider not initialized');
    }

    try {
      // Use Ollama's embeddings endpoint
      const response = await fetch(`${this.baseURL}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'nomic-embed-text', // Default embedding model for Ollama
          prompt: text
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings error: ${response.status}`);
      }

      const data = await response.json() as any;

      return {
        embedding: data.embedding || [],
        model: 'nomic-embed-text',
        usage: {
          totalTokens: this.estimateTokens(text)
        }
      };

    } catch (error) {
      console.error('❌ Local Llama embedding failed:', error);
      throw error;
    }
  }

  supportsEmbeddings(): boolean {
    return true; // Ollama supports embeddings with nomic-embed-text
  }

  getCapabilities() {
    const model = this.config?.model || 'llama2';
    
    // Model-specific capabilities (approximate)
    const capabilities = {
      'llama2': {
        maxContextLength: 4096,
        costPerToken: 0, // Local model - no cost
        averageLatency: 3000 // Slower than cloud models
      },
      'llama2:13b': {
        maxContextLength: 4096,
        costPerToken: 0,
        averageLatency: 5000
      },
      'llama2:70b': {
        maxContextLength: 4096,
        costPerToken: 0,
        averageLatency: 10000
      },
      'mistral': {
        maxContextLength: 8192,
        costPerToken: 0,
        averageLatency: 2500
      },
      'codellama': {
        maxContextLength: 16384,
        costPerToken: 0,
        averageLatency: 4000
      }
    };

    const modelCaps = capabilities[model as keyof typeof capabilities] || capabilities['llama2'];

    return {
      ...modelCaps,
      supportsStreaming: true,
      supportsEmbeddings: true
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

      // Local models have different thresholds
      if (currentLatency > 15000 || errorRate > 0.1) {
        status = 'degraded';
      }
      if (currentLatency > 30000 || errorRate > 0.3) {
        status = 'unhealthy';
      }

    } catch (error) {
      status = 'unhealthy';
      currentLatency = 60000;
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
    return 0; // Local models have no API cost
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    this.config = null;
    console.log('🔌 Local Llama provider disconnected');
  }

  private async testConnection(): Promise<void> {
    // Check if Ollama is running
    const response = await fetch(`${this.baseURL}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Ollama server not available at ${this.baseURL}`);
    }

    const data = await response.json() as any;
    
    // Check if the model is available
    if (this.config?.model) {
      const modelExists = data.models?.some((m: any) => m.name.startsWith(this.config!.model));
      if (!modelExists) {
        console.warn(`⚠️  Model ${this.config.model} not found. Available models:`, 
          data.models?.map((m: any) => m.name) || []);
      }
    }
  }

  private convertMessagesToPrompt(messages: LLMMessage[]): string {
    // Convert chat messages to a single prompt for Ollama
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * List available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json() as any;
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      console.log(`📥 Pulling model ${modelName}...`);
      
      const response = await fetch(`${this.baseURL}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      console.log(`✅ Model ${modelName} pulled successfully`);
    } catch (error) {
      console.error(`❌ Failed to pull model ${modelName}:`, error);
      throw error;
    }
  }
} 