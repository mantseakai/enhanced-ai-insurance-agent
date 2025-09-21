// File: backend/src/core/llm/managers/LLMManager.ts

import { LLMProvider, LLMConfig, LLMProviderFactory } from '../interfaces/LLMProvider';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ClaudeProvider } from '../providers/ClaudeProvider';
import { LocalLlamaProvider } from '../providers/LocalLlamaProvider';
import { DeepSeekProvider } from '../providers/DeepSeekProvider';

class LLMProviderFactoryImpl implements LLMProviderFactory {
  createProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider();
      case 'claude':
        return new ClaudeProvider();
      case 'local_llama':
        return new LocalLlamaProvider();
      case 'deepseek':
        return new DeepSeekProvider();
      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
  }

  getSupportedProviders(): string[] {
    return ['openai', 'claude', 'local_llama', 'deepseek'];
  }
}

export class LLMManager {
  private static instance: LLMManager;
  private providers: Map<string, LLMProvider> = new Map();
  private activeProvider: LLMProvider | null = null;
  private embeddingProvider: LLMProvider | null = null;
  private factory: LLMProviderFactory;
  private configs: Map<string, LLMConfig> = new Map();

  private constructor() {
    this.factory = new LLMProviderFactoryImpl();
    this.loadConfigsFromEnvironment();
  }

  static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  /**
   * Initialize LLM manager with default providers
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing LLM Manager...');

    // Initialize available providers based on environment variables
    const availableProviders = this.getAvailableProviders();
    
    for (const providerName of availableProviders) {
      const config = this.configs.get(providerName);
      if (config) {
        try {
          await this.initializeProvider(providerName, config);
        } catch (error) {
          console.warn(`⚠️  Failed to initialize ${providerName}:`, (error as Error).message);
        }
      }
    }

    // Set default active provider
    await this.setActiveProvider(process.env.DEFAULT_LLM_PROVIDER || 'openai');
    
    // Set embedding provider (prefer OpenAI for embeddings)
    await this.setEmbeddingProvider('openai');

    console.log('✅ LLM Manager initialized successfully');
  }

  /**
   * Initialize a specific provider
   */
  async initializeProvider(providerName: string, config: LLMConfig): Promise<void> {
    console.log(`🔧 Initializing ${providerName} provider...`);

    const provider = this.factory.createProvider(config);
    await provider.initialize(config);
    
    this.providers.set(providerName, provider);
    console.log(`✅ ${providerName} provider initialized`);
  }

  /**
   * Set the active provider for chat completions
   */
  async setActiveProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      // Try to initialize it if config exists
      const config = this.configs.get(providerName);
      if (config) {
        await this.initializeProvider(providerName, config);
        this.activeProvider = this.providers.get(providerName)!;
      } else {
        throw new Error(`Provider ${providerName} not available or configured`);
      }
    } else {
      this.activeProvider = provider;
    }

    console.log(`🎯 Active LLM provider set to: ${providerName}`);
  }

  /**
   * Set the embedding provider
   */
  async setEmbeddingProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Provider ${providerName} not available`);
    }

    if (!provider.supportsEmbeddings()) {
      console.warn(`⚠️  ${providerName} doesn't support embeddings, keeping current embedding provider`);
      return;
    }

    this.embeddingProvider = provider;
    console.log(`🎯 Embedding provider set to: ${providerName}`);
  }

  /**
   * Get the active provider for completions
   */
  getActiveProvider(): LLMProvider {
    if (!this.activeProvider) {
      throw new Error('No active LLM provider set. Call initialize() first.');
    }
    return this.activeProvider;
  }

  /**
   * Get the embedding provider
   */
  getEmbeddingProvider(): LLMProvider {
    if (!this.embeddingProvider) {
      throw new Error('No embedding provider set. Call initialize() first.');
    }
    return this.embeddingProvider;
  }

  /**
   * Get a specific provider by name
   */
  getProvider(providerName: string): LLMProvider | null {
    return this.providers.get(providerName) || null;
  }

  /**
   * List all initialized providers
   */
  getInitializedProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider health status for all providers
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      try {
        status[name] = await provider.getHealthStatus();
      } catch (error) {
        status[name] = {
          status: 'unhealthy',
          latency: 30000,
          errorRate: 1.0,
          error: (error as Error).message,
          lastCheck: new Date()
        };
      }
    }

    return status;
  }

  /**
   * Get cost estimates for all providers
   */
  getCostEstimates(promptTokens: number, completionTokens: number): Record<string, number> {
    const costs: Record<string, number> = {};

    for (const [name, provider] of this.providers) {
      costs[name] = provider.estimateCost(promptTokens, completionTokens);
    }

    return costs;
  }

  /**
   * Switch to the cheapest available provider
   */
  async switchToCheapestProvider(promptTokens: number, completionTokens: number = 100): Promise<string> {
    const costs = this.getCostEstimates(promptTokens, completionTokens);
    const healthStatus = await this.getHealthStatus();

    // Filter to only healthy providers
    const healthyProviders = Object.keys(costs).filter(
      name => healthStatus[name]?.status === 'healthy'
    );

    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    // Find cheapest healthy provider
    const cheapestProvider = healthyProviders.reduce((cheapest, current) => 
      costs[current] < costs[cheapest] ? current : cheapest
    );

    await this.setActiveProvider(cheapestProvider);
    return cheapestProvider;
  }

  /**
   * Switch to the fastest available provider
   */
  async switchToFastestProvider(): Promise<string> {
    const healthStatus = await this.getHealthStatus();

    const healthyProviders = Object.keys(healthStatus).filter(
      name => healthStatus[name]?.status === 'healthy'
    );

    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    // Find fastest healthy provider
    const fastestProvider = healthyProviders.reduce((fastest, current) => 
      healthStatus[current].latency < healthStatus[fastest].latency ? current : fastest
    );

    await this.setActiveProvider(fastestProvider);
    return fastestProvider;
  }

  /**
   * Automatic provider selection based on criteria
   */
  async autoSelectProvider(criteria: {
    prioritize: 'cost' | 'speed' | 'quality';
    promptTokens: number;
    completionTokens?: number;
  }): Promise<string> {
    switch (criteria.prioritize) {
      case 'cost':
        return await this.switchToCheapestProvider(criteria.promptTokens, criteria.completionTokens);
      
      case 'speed':
        return await this.switchToFastestProvider();
      
      case 'quality':
        // Prefer Claude for quality, fallback to GPT-4
        const qualityProviders = ['claude', 'openai'];
        for (const provider of qualityProviders) {
          if (this.providers.has(provider)) {
            const health = await this.providers.get(provider)!.getHealthStatus();
            if (health.status === 'healthy') {
              await this.setActiveProvider(provider);
              return provider;
            }
          }
        }
        throw new Error('No quality providers available');
      
      default:
        throw new Error(`Unknown prioritization criteria: ${criteria.prioritize}`);
    }
  }

  /**
   * Load provider configurations from environment variables
   */
  private loadConfigsFromEnvironment(): void {
    // OpenAI configuration
    if (process.env.OPENAI_API_KEY) {
      this.configs.set('openai', {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000')
      });
    }

    // Claude configuration
    if (process.env.ANTHROPIC_API_KEY) {
      this.configs.set('claude', {
        provider: 'claude',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
        maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000')
      });
    }

    // Local Llama configuration
    if (process.env.LOCAL_LLM_ENDPOINT || process.env.OLLAMA_ENABLED === 'true') {
      this.configs.set('local_llama', {
        provider: 'local_llama',
        baseURL: process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:11434',
        model: process.env.LOCAL_LLM_MODEL || 'llama2',
        maxTokens: parseInt(process.env.LOCAL_LLM_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.LOCAL_LLM_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.LOCAL_LLM_TIMEOUT || '60000')
      });
    }

    // DeepSeek configuration
    if (process.env.DEEPSEEK_API_KEY) {
      this.configs.set('deepseek', {
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.DEEPSEEK_TIMEOUT || '30000')
      });
    }
  }

  /**
   * Get available providers based on environment configuration
   */
  private getAvailableProviders(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Shutdown all providers
   */
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down LLM Manager...');

    for (const [name, provider] of this.providers) {
      try {
        await provider.disconnect();
        console.log(`🔌 ${name} provider disconnected`);
      } catch (error) {
        console.error(`❌ Error disconnecting ${name}:`, error);
      }
    }

    this.providers.clear();
    this.activeProvider = null;
    this.embeddingProvider = null;

    console.log('✅ LLM Manager shutdown complete');
  }
}