// File: backend/src/services/AIServiceMultiLLM.ts
// Replace your current AIService.ts with this version

import { VectorStoreManager } from '../core/vector/managers/VectorStoreManager';
import { VectorStoreProvider } from '../core/vector/interfaces/VectorStoreProvider';
import { LLMManager } from '../core/llm/managers/LLMManager';
import { LLMProvider } from '../core/llm/interfaces/LLMProvider';
import { SimpleCache } from '../core/cache/SimpleCache';

// Import existing types for backward compatibility
import {
  QueryContext,
  EnhancedQueryContext,
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
}

export class AIService {
  private vectorStore: VectorStoreProvider | null = null;
  private vectorManager: VectorStoreManager;
  private llmManager: LLMManager;
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
    
    // Initialize caches
    this.responseCache = SimpleCache.getInstance(200, 300000); // 5 min cache
    this.analysisCache = SimpleCache.getInstance(100, 600000); // 10 min cache
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing AI Service with Multi-LLM support...');
      
      // Initialize vector store
      this.vectorStore = await this.vectorManager.initialize();
      
      // Initialize LLM manager
      await this.llmManager.initialize();
      
      // Verify setup
      const stats = await this.vectorStore.getStats();
      const providers = this.llmManager.getInitializedProviders();
      
      console.log(`📊 Vector store ready: ${stats.documentCount} documents available`);
      console.log(`🤖 LLM providers available: ${providers.join(', ')}`);
      console.log(`🎯 Active LLM provider: ${this.llmManager.getActiveProvider().name}`);
      
      this.initialized = true;
      console.log('✅ AI Service with Multi-LLM initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      throw error;
    }
  }

  async processMessage(
    message: string,
    userId: string,
    context: QueryContext | EnhancedQueryContext = {}
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

      console.log(`🤖 Processing message from ${userId}: "${message.substring(0, 50)}..."`);

      // Check response cache first
      const cacheKey = SimpleCache.generateKey('response', message, context);
      const cachedResponse = this.responseCache.get(cacheKey);
      if (cachedResponse) {
        console.log('⚡ Using cached response');
        return {
          ...cachedResponse,
          responseTime: Date.now() - startTime
        } as AIResponse;
      }

      // Auto-select optimal LLM provider
      await this.selectOptimalProvider(message, context);

      // 1. Analyze user input (simplified for speed)
      const analysis = await this.analyzeUserInputFast(message, context);

      // 2. Query knowledge base
      const knowledgeResults = await this.queryKnowledgeBase(message, context, analysis);

      // 3. Update conversation history
      this.updateConversationHistory(userId, message, analysis);

      // 4. Generate contextual response with current LLM
      const response = await this.generateResponseWithLLM(message, knowledgeResults, analysis, context);

      // 5. Update customer profile (async)
      setImmediate(() => this.updateCustomerProfile(userId, analysis, context));

      // Add metadata
      const finalResponse = {
        ...response,
        responseTime: Date.now() - startTime,
        providerUsed: this.llmManager.getActiveProvider().name
      };

      // Cache the response
      this.responseCache.set(cacheKey, finalResponse, 300000);

      console.log(`✅ Response generated for ${userId} via ${finalResponse.providerUsed} (${finalResponse.responseTime}ms)`);
      return finalResponse;

    } catch (error) {
      console.error('❌ Error processing message:', error);
      return this.generateFallbackResponse(message, Date.now() - startTime);
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Select optimal LLM provider based on context
   */
  private async selectOptimalProvider(
    message: string,
    context: QueryContext | EnhancedQueryContext
  ): Promise<void> {
    try {
      // Default selection criteria
      let criteria: 'cost' | 'speed' | 'quality' = 'speed';
      
      // Analyze message to determine optimal provider
      const lowerMessage = message.toLowerCase();
      
      // Use quality provider for complex or important queries
      if (lowerMessage.includes('premium') || 
          lowerMessage.includes('calculate') || 
          lowerMessage.includes('complex') ||
          (context as any).stage === 'decision') {
        criteria = 'quality';
      }
      // Use fast provider for simple queries
      else if (lowerMessage.includes('hello') || 
               lowerMessage.includes('yes') || 
               lowerMessage.includes('no') ||
               lowerMessage.length < 20) {
        criteria = 'speed';
      }
      // Use cost-effective provider for general queries
      else {
        criteria = 'cost';
      }

      const estimatedTokens = Math.ceil(message.length / 4) + 100; // Rough estimate
      
      await this.llmManager.autoSelectProvider({
        prioritize: criteria,
        promptTokens: estimatedTokens,
        completionTokens: 100
      });

    } catch (error) {
      console.warn('⚠️ Provider auto-selection failed, using current provider:', (error as Error).message);
    }
  }

  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
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

  private async analyzeUserInputFast(
    message: string,
    context: QueryContext | EnhancedQueryContext
  ): Promise<AIAnalysis> {
    try {
      // Check analysis cache
      const cacheKey = SimpleCache.generateKey('analysis', message);
      const cached = this.analysisCache.get(cacheKey);
      if (cached) {
        return { ...this.getDefaultAnalysis(), ...cached };
      }

      // Fast pattern-based analysis first
      const fastAnalysis = this.performFastAnalysis(message);
      if (fastAnalysis) {
        this.analysisCache.set(cacheKey, fastAnalysis, 600000);
        return fastAnalysis;
      }

      // Use LLM for complex analysis
      const llmProvider = this.llmManager.getActiveProvider();
      
      const analysisPrompt = [
        {
          role: 'user' as const,
          content: `Analyze: "${message}" Return JSON: {"primaryIntent":"information|quote|purchase|claim","insuranceType":"auto|health|life|business|general","urgencyLevel":"high|medium|low","leadReadiness":"hot|warm|cold","confidence":0.8}`
        }
      ];

      const response = await Promise.race([
        llmProvider.generateCompletion(analysisPrompt, {
          maxTokens: 150,
          temperature: 0.1
        }),
        this.createTimeoutPromise(4000, 'Analysis timed out')
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

  private async queryKnowledgeBase(
    query: string,
    context: QueryContext | EnhancedQueryContext,
    analysis: AIAnalysis
  ): Promise<ContextualQueryResult> {
    try {
      if (!this.vectorStore) {
        throw new Error('Vector store not initialized');
      }

      // Build enhanced query
      const enhancedQuery = this.buildEnhancedQuery(query, analysis, context);

      // Search vector store
      const topK = 2; // Reduced for speed
      const searchResults = await this.vectorStore.searchByText(enhancedQuery, topK);

      // Convert to ContextualQueryResult format
      const documents = searchResults.map(result => ({
        id: result.document.id,
        content: result.document.content.substring(0, 1000),
        metadata: {
          type: result.document.metadata.type || 'product',
          category: result.document.metadata.category || 'general',
          priority: result.document.metadata.priority || 'medium',
          companyId: result.document.metadata.companyId || 'default',
          version: result.document.metadata.version || '1.0',
          lastUpdated: result.document.metadata.lastUpdated || new Date(),
          ...result.document.metadata
        }
      })) as EnhancedRAGDocument[];

      return {
        documents,
        context: documents.map(doc => doc.content).join('\n\n---\n\n'),
        confidence: this.calculateConfidence(searchResults),
        relevanceScore: this.calculateRelevanceScore(searchResults),
        metadata: this.extractMetadata(documents),
        contextualFactors: this.calculateContextualFactors(searchResults, analysis),
        recommendations: this.generateRecommendations(searchResults, analysis),
        premiumCalculation: this.extractPremiumCalculationInfo(documents)
      };

    } catch (error) {
      console.error('❌ Error querying knowledge base:', error);
      return this.getFallbackKnowledgeResult();
    }
  }

  private async generateResponseWithLLM(
    message: string,
    knowledgeResults: ContextualQueryResult,
    analysis: AIAnalysis,
    context: QueryContext | EnhancedQueryContext
  ): Promise<AIResponse> {
    try {
      // Check for template responses first
      const templateResponse = this.generateTemplateResponse(message, analysis, knowledgeResults);
      if (templateResponse) {
        return templateResponse;
      }

      // Use current LLM provider
      const llmProvider = this.llmManager.getActiveProvider();
      
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful Ghana insurance agent. Be concise and professional.'
        },
        {
          role: 'user' as const,
          content: `Customer: "${message}"
Knowledge: ${knowledgeResults.context.substring(0, 800)}
Response (max 150 words):`
        }
      ];

      const response = await llmProvider.generateCompletion(messages, {
        maxTokens: 200,
        temperature: 0.7
      });

      // Calculate estimated cost
      const cost = llmProvider.estimateCost(
        response.usage?.promptTokens || 0,
        response.usage?.completionTokens || 0
      );

      return {
        message: response.content || 'I understand you need help with insurance. How can I assist you today?',
        confidence: knowledgeResults.confidence,
        shouldCaptureLead: analysis.leadReadiness === 'hot' || analysis.leadReadiness === 'warm',
        leadScore: this.calculateLeadScore(analysis),
        contextualFactors: knowledgeResults.contextualFactors,
        nextActions: knowledgeResults.recommendations.nextBestActions,
        conversationStage: analysis.conversationStage,
        cost
      };

    } catch (error) {
      console.error('❌ Error generating LLM response:', error);
      return this.generateFallbackResponse(message);
    }
  }

  // Helper methods (same as before but simplified)
  private performFastAnalysis(message: string): AIAnalysis | null {
    const lowerMessage = message.toLowerCase();
    
    const patterns = {
      quote: /cost|price|premium|how much|quote|afford/,
      auto: /car|vehicle|auto|toyota|camry|driving|accident/,
      health: /health|medical|hospital|nhis|doctor/,
      payment: /pay|momo|mobile money|mtn|vodafone|cash/,
      claim: /claim|accident|damage|emergency/,
      urgent: /urgent|emergency|now|asap|immediately/
    };

    const defaultAnalysis = this.getDefaultAnalysis();
    let analysis: AIAnalysis = { ...defaultAnalysis };

    if (patterns.quote.test(lowerMessage)) {
      analysis.primaryIntent = 'quote';
      analysis.leadReadiness = 'warm';
    } else if (patterns.claim.test(lowerMessage)) {
      analysis.primaryIntent = 'claim';
      analysis.urgencyLevel = 'high';
    } else {
      analysis.primaryIntent = 'information';
      analysis.leadReadiness = 'cold';
    }

    if (patterns.auto.test(lowerMessage)) {
      analysis.insuranceType = 'auto';
    } else if (patterns.health.test(lowerMessage)) {
      analysis.insuranceType = 'health';
    } else {
      analysis.insuranceType = 'general';
    }

    if (patterns.urgent.test(lowerMessage)) {
      analysis.urgencyLevel = 'high';
    } else if (patterns.quote.test(lowerMessage)) {
      analysis.urgencyLevel = 'medium';
    } else {
      analysis.urgencyLevel = 'low';
    }

    if (analysis.primaryIntent && analysis.insuranceType) {
      return {
        ...defaultAnalysis,
        ...analysis,
        confidence: 0.8,
        conversationStage: analysis.primaryIntent === 'quote' ? 'consideration' : 'awareness'
      };
    }

    return null;
  }

  private generateTemplateResponse(
    message: string,
    analysis: AIAnalysis,
    knowledgeResults: ContextualQueryResult
  ): AIResponse | null {
    const lowerMessage = message.toLowerCase();

    if (analysis.insuranceType === 'auto' && analysis.primaryIntent === 'information') {
      return {
        message: `Hello! I'd be happy to help you with auto insurance in Ghana. Our comprehensive coverage includes third-party liability (mandatory), own damage protection, theft coverage, and natural disaster protection. For a vehicle like yours, premiums typically range from GHS 800-3000 annually depending on the vehicle value and your location. Would you like a personalized quote?`,
        confidence: 0.9,
        shouldCaptureLead: true,
        leadScore: 7,
        conversationStage: 'consideration'
      };
    }

    if (lowerMessage.includes('momo') || lowerMessage.includes('pay')) {
      return {
        message: `Yes, you can definitely pay your insurance premiums using MTN MoMo, Vodafone Cash, or AirtelTigo Money. Mobile money is very popular in Ghana - over 60% of our customers use it! The transaction fee is typically GHS 0.75, and payment is instant with SMS confirmation. You can also set up auto-renewal for continuous coverage. Would you like me to help you get started?`,
        confidence: 0.95,
        shouldCaptureLead: true,
        leadScore: 8,
        conversationStage: 'decision'
      };
    }

    return null;
  }

  private createTimeoutPromise(ms: number, message: string = 'Operation timed out'): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${message} after ${ms}ms`)), ms);
    });
  }

  private buildEnhancedQuery(
    originalQuery: string,
    analysis: AIAnalysis,
    context: QueryContext | EnhancedQueryContext
  ): string {
    let enhancedQuery = originalQuery;

    if (analysis.insuranceType && analysis.insuranceType !== 'general') {
      enhancedQuery += ` ${analysis.insuranceType}`;
    }

    enhancedQuery += ' Ghana';

    return enhancedQuery;
  }

  // Simplified helper methods
  private calculateConfidence(searchResults: any[]): number {
    if (searchResults.length === 0) return 0.4;
    const avgScore = searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length;
    return Math.min(avgScore + 0.1, 0.95);
  }

  private calculateRelevanceScore(searchResults: any[]): number {
    return this.calculateConfidence(searchResults);
  }

  private extractMetadata(documents: any[]): any {
    return {
      hasProductInfo: documents.some(d => d.metadata.type === 'product'),
      hasObjectionHandling: documents.some(d => d.metadata.type === 'objection'),
      hasMarketContext: documents.some(d => d.metadata.type === 'market_context'),
      hasPremiumCalculation: documents.some(d => d.metadata.type === 'premium_calculation'),
      hasRiskFactors: documents.some(d => d.metadata.type === 'risk_factors'),
      hasClaimsInfo: documents.some(d => d.metadata.type === 'claims'),
      hasLocalRelevance: documents.some(d => d.metadata.region === 'ghana'),
      seasonalRelevance: true
    };
  }

  private calculateContextualFactors(searchResults: any[], analysis: AIAnalysis): any {
    return {
      customerMatch: 0.8,
      situationalRelevance: searchResults.length > 0 ? 0.9 : 0.5,
      marketAlignment: 0.85,
      urgencyMatch: analysis.urgencyLevel === 'high' ? 0.9 : 0.6
    };
  }

  private generateRecommendations(searchResults: any[], analysis: AIAnalysis): any {
    const actions = [];
    
    if (analysis.primaryIntent === 'quote') {
      actions.push('calculate_premium');
    } else {
      actions.push('provide_info');
    }

    return {
      nextBestActions: actions,
      followUpQuestions: ['Would you like a quote?'],
      additionalInfo: ['payment_options']
    };
  }

  private extractPremiumCalculationInfo(documents: any[]): any {
    return {
      canCalculate: true,
      requiredFields: ['vehicle_type', 'age'],
      estimatedRange: { min: 200, max: 2000 }
    };
  }

  private calculateLeadScore(analysis: AIAnalysis): number {
    let score = 5;
    
    if (analysis.leadReadiness === 'hot') score += 3;
    else if (analysis.leadReadiness === 'warm') score += 2;
    
    if (analysis.primaryIntent === 'quote') score += 2;
    if (analysis.urgencyLevel === 'high') score += 1;
    
    return Math.min(score, 10);
  }

  private updateConversationHistory(userId: string, message: string, analysis: AIAnalysis): void {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const history = this.conversationHistory.get(userId)!;
    history.push({
      message,
      analysis,
      timestamp: new Date()
    });

    if (history.length > 5) {
      history.splice(0, history.length - 5);
    }
  }

  private updateCustomerProfile(
    userId: string,
    analysis: AIAnalysis,
    context: QueryContext | EnhancedQueryContext
  ): void {
    if (!this.customerProfiles.has(userId)) {
      this.customerProfiles.set(userId, {
        location: 'ghana',
        riskTolerance: 'medium',
        previousClaims: false
      } as CustomerProfile);
    }

    const profile = this.customerProfiles.get(userId)!;
    
    // Update profile based on analysis
    if (analysis.insuranceType === 'auto') {
      profile.vehicleType = 'sedan'; // Default, could be enhanced with more analysis
    }
    
    if (analysis.leadReadiness === 'hot') {
      profile.riskTolerance = 'high';
    } else if (analysis.leadReadiness === 'cold') {
      profile.riskTolerance = 'low';
    }
  }

  // Fallback methods
  private getDefaultAnalysis(): AIAnalysis {
    return {
      primaryIntent: 'information',
      insuranceType: 'general',
      urgencyLevel: 'medium',
      budgetSignals: [],
      personalityIndicators: [],
      buyingSignals: [],
      emotionalState: 'neutral',
      informationNeeds: [],
      nextBestAction: 'provide_info',
      confidence: 0.5,
      leadReadiness: 'cold',
      conversationStage: 'awareness'
    };
  }

  private getFallbackKnowledgeResult(): ContextualQueryResult {
    return {
      documents: [],
      context: 'General insurance information available.',
      confidence: 0.5,
      relevanceScore: 0.5,
      metadata: {
        hasProductInfo: false,
        hasObjectionHandling: false,
        hasMarketContext: false,
        hasPremiumCalculation: false,
        hasRiskFactors: false,
        hasClaimsInfo: false,
        hasLocalRelevance: false,
        seasonalRelevance: false
      },
      contextualFactors: {
        customerMatch: 0.5,
        situationalRelevance: 0.5,
        marketAlignment: 0.5,
        urgencyMatch: 0.5
      },
      recommendations: {
        nextBestActions: ['provide_info'],
        followUpQuestions: ['How can I help you with insurance?'],
        additionalInfo: ['general_info']
      }
    };
  }

  private generateFallbackResponse(message: string, responseTime?: number): AIResponse {
    return {
      message: `I understand you need help with insurance. I can assist you with auto, health, life, or business insurance in Ghana. What specific information would you like to know?`,
      confidence: 0.5,
      shouldCaptureLead: false,
      leadScore: 3,
      conversationStage: 'awareness',
      providerUsed: 'fallback',
      responseTime: responseTime || 0
    };
  }

  // Public API methods
  async updateKnowledgeBase(newDocuments: any[]): Promise<void> {
    if (!this.vectorStore) {
      await this.initialize();
    }

    const vectorDocuments = newDocuments.map((doc, index) => ({
      id: doc.id || `doc_${Date.now()}_${index}`,
      content: doc.content,
      metadata: doc.metadata || {}
    }));

    await this.vectorStore!.addDocuments(vectorDocuments);
    
    this.responseCache.clear();
    this.analysisCache.clear();
    
    console.log(`📚 Added ${vectorDocuments.length} new documents to knowledge base`);
  }

  /**
   * Switch to a specific LLM provider
   */
  async switchLLMProvider(providerName: string): Promise<void> {
    await this.llmManager.setActiveProvider(providerName);
    console.log(`🔄 Switched to LLM provider: ${providerName}`);
  }

  /**
   * Get available LLM providers
   */
  getAvailableLLMProviders(): string[] {
    return this.llmManager.getInitializedProviders();
  }

  /**
   * Get current LLM provider
   */
  getCurrentLLMProvider(): string {
    return this.llmManager.getActiveProvider().name;
  }

  /**
   * Get LLM provider health status
   */
  async getLLMHealthStatus(): Promise<Record<string, any>> {
    return await this.llmManager.getHealthStatus();
  }

  /**
   * Get cost estimates for different providers
   */
  getLLMCostEstimates(promptTokens: number, completionTokens: number = 100): Record<string, number> {
    return this.llmManager.getCostEstimates(promptTokens, completionTokens);
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