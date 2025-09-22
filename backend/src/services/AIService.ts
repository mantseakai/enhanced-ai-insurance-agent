// File: backend/src/services/AIService.ts
// Fixed version with proper context handling

import { VectorStoreManager } from '../core/vector/managers/VectorStoreManager';
import { VectorStoreProvider } from '../core/vector/interfaces/VectorStoreProvider';
import { LLMManager } from '../core/llm/managers/LLMManager';
import { LLMProvider } from '../core/llm/interfaces/LLMProvider';
import { SimpleCache } from '../core/cache/SimpleCache';
import { CompanyManager } from '../core/companies/CompanyManager';
import { CompanyConfig } from '../types/CompanyTypes';

// FIXED: Simplified imports - only use UnifiedQueryContext
import {
  UnifiedQueryContext,
  ContextBuilder,
  ContextValidator,
  ContextUtils
} from '../types/UnifiedContext';

import {
  AIAnalysis,
  ContextualQueryResult,
  CustomerProfile,
  ConversationContext,
  EnhancedRAGDocument
} from '../types/unified-rag';

export interface AIResponse {
  message: string;
  confidence: number;
  shouldCaptureLead?: boolean;
  leadScore?: number;
  premiumQuote?: any;
  contextualFactors?: any;
  nextActions?: string[];
  conversationStage?: string;
  providerUsed?: string;
  cost?: number;
  responseTime?: number;
  companyId?: string;
}

export class AIService {
  private static instance: AIService; // NEW: Singleton instance property

  private vectorStore: VectorStoreProvider | null = null;
  private vectorManager: VectorStoreManager;
  private llmManager: LLMManager;
  private companyManager: CompanyManager;
  private conversationHistory: Map<string, any[]> = new Map();
  private customerProfiles: Map<string, CustomerProfile> = new Map();
  private currentState: string = 'initial_contact';
  private initialized: boolean = false;
  
  // Performance caches
  private responseCache: SimpleCache;
  private analysisCache: SimpleCache;
  
  // Concurrency control
  private activeRequests: number = 0;
  private maxConcurrentRequests: number = 5;

   constructor() {
    // Get manager instances
    this.vectorManager = VectorStoreManager.getInstance();
    this.llmManager = LLMManager.getInstance();
    this.companyManager = CompanyManager.getInstance();
    
    // Initialize caches
    this.responseCache = SimpleCache.getInstance(200, 300000); // 5 min cache
    this.analysisCache = SimpleCache.getInstance(100, 600000); // 10 min cache
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing AI Service with Multi-Company & Multi-LLM support...');
      
      // Initialize company manager first
      await this.companyManager.initialize();
      
      // Initialize vector store
      this.vectorStore = await this.vectorManager.initialize();
      
      // Initialize LLM manager
      await this.llmManager.initialize();
      
      // Verify setup
      const stats = await this.vectorStore.getStats();
      const providers = this.llmManager.getInitializedProviders();
      const companies = this.companyManager.getActiveCompanies();
      
      console.log(`📊 Vector store ready: ${stats.documentCount} documents available`);
      console.log(`🤖 LLM providers available: ${providers.join(', ')}`);
      console.log(`🏢 Companies configured: ${companies.length}`);
      
      this.initialized = true;
      console.log('✅ AI Service with Multi-Company & Multi-LLM initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      throw error;
    }
  }

  // FIXED: Main processing method with proper context handling
  async processMessage(
    message: string,
    userId: string,
    context: UnifiedQueryContext = {},
    companyId?: string  // Optional for backward compatibility
  ): Promise<AIResponse> {
    // Concurrency control
    if (this.activeRequests >= this.maxConcurrentRequests) {
      console.log('⏳ Request queued due to high load');
      await this.waitForSlot();
    }
    
    this.activeRequests++;
    const startTime = Date.now();
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // FIXED: Determine company context and build unified context
      const effectiveCompanyId = companyId || context.companyId || 'default';
      const companyConfig = await this.companyManager.getCompanyConfig(effectiveCompanyId);
      
      console.log(`🤖 Processing message from ${userId} for company ${effectiveCompanyId}: "${message.substring(0, 50)}..."`);

      // FIXED: Build unified context with company information and auto-enrichment
      const unifiedContext = ContextUtils.enrichContext({
        ...context,
        companyId: effectiveCompanyId,
        companyConfig,
        userId,
        timestamp: context.timestamp || new Date().toISOString(),
        platform: context.platform || 'api',
        customerType: context.customerType || 'individual'
      }, message);

      // FIXED: Company-aware cache key using the properly defined unifiedContext
      const cacheKey = SimpleCache.generateKey('response', message, { 
        companyId: effectiveCompanyId,
        userId,
        stage: unifiedContext.conversationStage 
      });
      
      const cachedResponse = await this.responseCache.get<AIResponse>(cacheKey);
      if (cachedResponse !== null) {
        console.log('⚡ Using cached response for company:', effectiveCompanyId);
        return {
          ...cachedResponse,
          responseTime: Date.now() - startTime,
          companyId: effectiveCompanyId
        };
      }

      // Company-specific LLM provider selection
      await this.selectOptimalProviderForCompany(message, unifiedContext, companyConfig);

      // 1. Analyze user intent with company context
      const analysis = await this.analyzeUserIntentWithCompany(message, unifiedContext);
      
      // 2. Query company-specific knowledge base
      const knowledgeResult = await this.queryCompanyKnowledgeBase(message, unifiedContext, analysis);
      
      // 3. Generate company-branded response
      const response = await this.generateCompanyResponse(
        message, 
        unifiedContext, 
        analysis, 
        knowledgeResult,
        companyConfig
      );

      // 4. Update conversation history with company context
      this.updateConversationHistory(userId, message, response, effectiveCompanyId);

      // Cache the response with company context
      this.responseCache.set(cacheKey, response, 300000);

      return {
        ...response,
        responseTime: Date.now() - startTime,
        companyId: effectiveCompanyId
      };

    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      return {
        message: "I apologize for the technical issue. Our team will assist you shortly.",
        confidence: 0.1,
        responseTime: Date.now() - startTime,
        companyId: companyId || 'default'
      };
      
    } finally {
      this.activeRequests--;
    }
  }

  // Company-specific LLM provider selection
  private async selectOptimalProviderForCompany(
  message: string, 
  context: UnifiedQueryContext, 
  companyConfig: CompanyConfig
): Promise<void> {
  try {
    // FIX: Prefer reliable providers over Local Llama
    let preferredProvider = 'openai'; // Default to OpenAI instead of Local Llama

    // Use company's preferred LLM provider if specified
    if (companyConfig.preferredLLMProvider) {
      const provider = this.llmManager.getProvider(companyConfig.preferredLLMProvider);
      if (provider) {
        preferredProvider = companyConfig.preferredLLMProvider;
        console.log(`🎯 Using company preferred LLM: ${preferredProvider}`);
      }
    } else {
      // Intelligent selection based on company's priorities
      const priority = companyConfig.llmPriority || 'quality';
      
      switch (priority) {
        case 'speed':
          preferredProvider = 'claude'; // OpenAI is fast and reliable
          break;
        case 'cost':
          preferredProvider = 'claude'; // Claude is cost-effective
          break;
        case 'quality':
        default:
          preferredProvider = 'claude'; // OpenAI for quality
          break;
      }
    }

    // FIX: Verify the provider is available before setting it
    const availableProviders = this.llmManager.getInitializedProviders();
    if (!availableProviders.includes(preferredProvider)) {
      console.warn(`⚠️ Preferred provider ${preferredProvider} not available, using openai`);
      preferredProvider = 'openai';
    }

    await this.llmManager.setActiveProvider(preferredProvider);
    console.log(`🎯 Active LLM provider set to: ${preferredProvider}`);
    
  } catch (error) {
    console.warn('⚠️ Provider selection failed, using openai:', error);
    // Fallback to OpenAI (most reliable)
    try {
      await this.llmManager.setActiveProvider('openai');
    } catch (fallbackError) {
      console.error('❌ Even OpenAI fallback failed:', fallbackError);
    }
  }
}

  // Company-specific intent analysis
  private async analyzeUserIntentWithCompany(
  message: string, 
  context: UnifiedQueryContext
): Promise<AIAnalysis> {
  const cacheKey = SimpleCache.generateKey('analysis', message, { companyId: context.companyId });
  const cached = await this.analysisCache.get<AIAnalysis>(cacheKey);
  if (cached !== null) return cached;

  try {
    const llmProvider = this.llmManager.getActiveProvider();
    
    // Enhanced analysis prompt with company context
    const analysisPrompt = `
      Analyze this insurance customer message for ${context.companyConfig?.name || 'insurance company'}:
      
      Message: "${message}"
      Company Context: ${context.companyConfig?.businessType || 'general insurance'}
      Previous Stage: ${context.conversationStage || 'initial'}
      Platform: ${context.platform || 'unknown'}
      Customer Type: ${context.customerType || 'individual'}
      
      Return JSON with:
      {
        "intent": "quote_request|information_seeking|support|comparison|complaint",
        "insuranceType": "auto|health|life|business|property|travel",
        "urgency": "low|medium|high",
        "leadScore": 0-100,
        "extractedInfo": {
          "age": null,
          "location": null,
          "specificNeeds": []
        },
        "nextActions": [],
        "confidence": 0-1
      }
    `;

    // FIX: Reduce timeout from 4000ms to 2000ms and add better error handling
    const response = await Promise.race([
      llmProvider.generateCompletion([
        { role: 'user', content: analysisPrompt }
      ], {
        maxTokens: 200,
        temperature: 0.1
      }),
      this.createTimeoutPromise(2000, 'Analysis timed out') // Reduced timeout
    ]);

    // Safe JSON parsing
    let analysis: AIAnalysis;
    try {
      const cleanContent = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const parsedAnalysis = JSON.parse(cleanContent);
      analysis = { ...this.getDefaultAnalysis(), ...parsedAnalysis };
    } catch (parseError) {
      console.warn('JSON parse failed, using pattern analysis');
      analysis = this.performFastAnalysis(message) || this.getDefaultAnalysis();
    }
    
    // Cache the analysis
    this.analysisCache.set(cacheKey, analysis, 600000);
    
    return analysis;

  } catch (error) {
    console.warn('❌ Analysis failed, using pattern matching:', (error as Error).message);
    return this.performFastAnalysis(message) || this.getDefaultAnalysis();
  }
}

  // Company-specific knowledge base querying
  private async queryCompanyKnowledgeBase(
  query: string,
  context: UnifiedQueryContext,
  analysis: AIAnalysis
): Promise<ContextualQueryResult> {
  try {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    // Build enhanced query with company context
    const enhancedQuery = this.buildCompanyEnhancedQuery(query, analysis, context);

    // FIX: Use the correct method that exists in your PineconeProvider
    let searchResults;
    try {
      // Use searchByText method instead of manual embedding generation
      searchResults = await this.vectorStore.searchByText(enhancedQuery, 3, {
        companyId: context.companyId
      });
    } catch (searchError) {
      console.log('❌ Company-specific search failed, trying general search:', (searchError as Error).message);
      
      // Fallback to general search without company filter
      searchResults = await this.vectorStore.searchByText(enhancedQuery, 3);
    }

    // Convert to ContextualQueryResult format
    const documents = searchResults.map(result => ({
      id: result.document.id,
      content: result.document.content.substring(0, 1200),
      metadata: {
        type: result.document.metadata?.type || 'insurance_document',
        source: result.document.metadata?.source || 'knowledge_base',
        companyId: context.companyId,
        relevanceScore: result.score,
        timestamp: new Date().toISOString()
      }
    }));

    const avgScore = documents.length > 0 
      ? documents.reduce((sum, doc) => sum + (doc.metadata.relevanceScore || 0), 0) / documents.length 
      : 0;

    return {
      documents,
      totalResults: searchResults.length,
      averageScore: avgScore,
      searchQuery: enhancedQuery,
      processingTime: Date.now()
    };

  } catch (error) {
    console.error('❌ Knowledge base query failed:', error);
    return {
      documents: [],
      totalResults: 0,
      averageScore: 0,
      searchQuery: query,
      processingTime: Date.now()
    };
  }
}

  // Company-specific response generation
  private async generateCompanyResponse(
  message: string,
  context: UnifiedQueryContext,
  analysis: AIAnalysis,
  knowledgeResult: ContextualQueryResult,
  companyConfig: CompanyConfig
): Promise<AIResponse> {
  try {
    const llmProvider = this.llmManager.getActiveProvider();
    const startTime = Date.now();

    // Build company-specific context
    const contextDocs = knowledgeResult.documents
      .map(doc => `[${doc.metadata.type}] ${doc.content}`)
      .join('\n\n');

    // Company-specific system prompt
    const systemPrompt = `You are an AI insurance assistant for ${companyConfig.name}.
      
      Company Information:
      - Name: ${companyConfig.name}
      - Business Type: ${companyConfig.businessType || 'insurance'}
      - Brand Voice: ${companyConfig.branding?.brandVoice || 'professional and friendly'}
      - Contact Info: ${companyConfig.contactInfo?.phone || 'Contact us for more details'}
      
      Customer Context:
      - Intent: ${analysis.intent}
      - Insurance Type: ${analysis.insuranceType}
      - Lead Score: ${analysis.leadScore}
      - Platform: ${context.platform}
      
      Available Knowledge:
      ${contextDocs}
      
      Instructions:
      1. Respond in ${companyConfig.branding?.brandVoice || 'professional'} tone
      2. Include company-specific contact information when relevant
      3. Mention ${companyConfig.name} naturally in the response
      4. Focus on ${analysis.insuranceType} insurance if identified
      5. Keep responses concise and actionable
      6. Use Ghana-specific language and context
      `;

    const userPrompt = `Customer message: "${message}"
      
      Generate a helpful response that addresses their needs while representing ${companyConfig.name} professionally.`;

    // FIX: Reduce timeout from 8000ms to 5000ms
    const response = await Promise.race([
      llmProvider.generateCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        maxTokens: 400,
        temperature: 0.7
      }),
      this.createTimeoutPromise(5000, 'Response generation timed out') // Reduced timeout
    ]);

    // Calculate premium quote if relevant
    let premiumQuote = null;
    if (analysis.intent === 'quote_request' && analysis.extractedInfo) {
      try {
        premiumQuote = await this.calculatePremium(analysis, context.companyId || 'default');
      } catch (error) {
        console.warn('Premium calculation failed:', error);
      }
    }

    return {
      message: response.content,
      confidence: analysis.confidence || 0.8,
      shouldCaptureLead: analysis.leadScore > 60,
      leadScore: analysis.leadScore,
      premiumQuote,
      nextActions: analysis.nextActions || [],
      conversationStage: this.determineNextStage(analysis),
      providerUsed: llmProvider.name,
      cost: this.estimateCost(response),
      companyId: context.companyId
    };

  } catch (error) {
    console.error('❌ Response generation failed:', error);
    
    // Fallback company response
    return {
      message: `Thank you for contacting ${companyConfig.name}. We're experiencing technical difficulties but our team will assist you shortly. Please call ${companyConfig.contactInfo?.phone || 'our support line'} for immediate assistance.`,
      confidence: 0.3,
      shouldCaptureLead: true,
      leadScore: 50,
      conversationStage: 'support_needed',
      companyId: context.companyId
    };
  }
}

  // Company-enhanced query building
  private buildCompanyEnhancedQuery(
    originalQuery: string, 
    analysis: AIAnalysis, 
    context: UnifiedQueryContext
  ): string {
    const parts = [originalQuery];
    
    // Add company context
    if (context.companyConfig?.businessType) {
      parts.push(context.companyConfig.businessType);
    }
    
    // Add insurance type context
    if (analysis.insuranceType && analysis.insuranceType !== 'unknown') {
      parts.push(`${analysis.insuranceType} insurance`);
    }
    
    // Add platform context
    if (context.platform) {
      parts.push(`${context.platform} inquiry`);
    }
    
    return parts.join(' ');
  }

  // Update conversation history with company context
  private updateConversationHistory(
    userId: string, 
    message: string, 
    response: AIResponse,
    companyId: string
  ): void {
    const conversationKey = `${userId}_${companyId}`;
    
    if (!this.conversationHistory.has(conversationKey)) {
      this.conversationHistory.set(conversationKey, []);
    }
    
    const history = this.conversationHistory.get(conversationKey)!;
    
    history.push({
      timestamp: new Date().toISOString(),
      userMessage: message,
      botResponse: response.message,
      confidence: response.confidence,
      companyId: companyId,
      metadata: {
        leadScore: response.leadScore,
        conversationStage: response.conversationStage,
        providerUsed: response.providerUsed
      }
    });
    
    // Keep only last 10 messages per company conversation
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  // Helper methods
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateCost(response: any): number {
    const provider = this.llmManager.getActiveProvider();
    const tokens = this.estimateTokens(response.content);
    return provider.estimateCost(tokens, tokens);
  }

  private async createTimeoutPromise(ms: number, message: string): Promise<any> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private getDefaultAnalysis(): AIAnalysis {
    return {
      intent: 'information_seeking',
      insuranceType: 'unknown',
      urgency: 'medium',
      leadScore: 50,
      extractedInfo: {},
      nextActions: ['provide_more_information'],
      confidence: 0.5
    };
  }

  private performFastAnalysis(message: string): AIAnalysis | null {
    // Simple pattern matching for fallback
    const lowerMessage = message.toLowerCase();
    
    let insuranceType = 'unknown';
    if (lowerMessage.includes('car') || lowerMessage.includes('auto')) insuranceType = 'auto';
    else if (lowerMessage.includes('health')) insuranceType = 'health';
    else if (lowerMessage.includes('life')) insuranceType = 'life';
    
    let intent = 'information_seeking';
    if (lowerMessage.includes('quote') || lowerMessage.includes('price')) intent = 'quote_request';
    
    return {
      intent: intent as AIAnalysis['intent'],
      insuranceType: insuranceType as AIAnalysis['insuranceType'],
      urgency: 'medium',
      leadScore: 60,
      extractedInfo: {},
      nextActions: ['provide_quote_form'],
      confidence: 0.6
    };
  }

  private determineNextStage(analysis: AIAnalysis): string {
    if (analysis.intent === 'quote_request') return 'quote_provided';
    if (analysis.leadScore > 80) return 'ready_to_convert';
    return 'information_gathering';
  }

  private async calculatePremium(analysis: AIAnalysis, companyId: string): Promise<any> {
    // Placeholder for premium calculation
    return {
      insuranceType: analysis.insuranceType,
      amount: 1200,
      currency: 'GHS',
      validity: '30 days'
    };
  }

  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.activeRequests < this.maxConcurrentRequests) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  // Get service statistics with company breakdown
  getServiceStats() {
    const vectorStats = this.vectorStore ? 
      { provider: this.vectorStore.name, initialized: this.vectorStore.isInitialized } : 
      { provider: 'none', initialized: false };

    return {
      conversations: {
        activeConversations: this.conversationHistory.size,
        customerProfiles: this.customerProfiles.size
      },
      vectorStore: vectorStats,
      llm: {
        availableProviders: this.llmManager.getInitializedProviders(),
        activeProvider: this.llmManager.getActiveProvider().name,
        embeddingProvider: this.llmManager.getEmbeddingProvider().name
      },
      companies: {
        totalCompanies: this.companyManager.getActiveCompanies().length,
        configuredCompanies: this.companyManager.getActiveCompanies().map(c => c.name)
      },
      caching: {
        responseCache: this.responseCache.getStats(),
        analysisCache: this.analysisCache.getStats()
      },
      concurrency: {
        activeRequests: this.activeRequests,
        maxConcurrentRequests: this.maxConcurrentRequests
      },
      mode: 'enhanced_v2_multi_company_multi_llm'
    };
  }

  getPerformanceAnalytics(): any {
    const vectorStats = this.vectorStore ? 
      { provider: this.vectorStore.name, initialized: this.vectorStore.isInitialized } : 
      { provider: 'none', initialized: false };

    return {
      conversations: {
        activeConversations: this.conversationHistory.size,
        customerProfiles: this.customerProfiles.size
      },
      vectorStore: vectorStats,
      llm: {
        availableProviders: this.llmManager.getInitializedProviders(),
        activeProvider: this.llmManager.getActiveProvider().name,
        embeddingProvider: this.llmManager.getEmbeddingProvider().name
      },
      caching: {
        responseCache: this.responseCache.getStats(),
        analysisCache: this.analysisCache.getStats()
      },
      concurrency: {
        activeRequests: this.activeRequests,
        maxConcurrentRequests: this.maxConcurrentRequests
      },
      mode: 'enhanced_v2_multi_llm'
    };
  }
}
