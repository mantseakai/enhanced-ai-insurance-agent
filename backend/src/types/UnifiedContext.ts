// File: backend/src/types/UnifiedContext.ts
// Consolidated context types to eliminate conflicts

export interface UnifiedQueryContext {
  // Company Context (NEW)
  companyId?: string;
  companyConfig?: any; // Will be typed properly when CompanyConfig is imported
  
  // User Context
  userId?: string;
  customerType?: 'individual' | 'business' | 'agent';
  contactName?: string;
  phoneNumber?: string;
  
  // Platform Context
  platform?: 'whatsapp' | 'instagram' | 'facebook' | 'telegram' | 'webchat' | 'api';
  messageId?: string;
  messageType?: string;
  
  // Conversation Context
  conversationStage?: 'greeting' | 'information_gathering' | 'quote_request' | 'comparison' | 'ready_to_buy' | 'support_needed';
  previousMessages?: number;
  sessionId?: string;
  
  // Temporal Context
  timestamp?: string;
  timezone?: string;
  
  // Business Context
  insuranceType?: 'auto' | 'health' | 'life' | 'business' | 'property' | 'travel' | 'unknown';
  urgency?: 'low' | 'medium' | 'high';
  leadScore?: number;
  
  // Geographic Context
  location?: string;
  region?: string;
  country?: string;
  
  // Technical Context
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  language?: string;
  
  // Custom Metadata
  metadata?: Record<string, any>;
  
  // Legacy fields for backward compatibility
  customerProfile?: any;
  conversationHistory?: any[];
  extractedInfo?: Record<string, any>;
  
  // Analytics Context
  campaignId?: string;
  referralSource?: string;
  trackingData?: Record<string, any>;
}

// Specific context creators for different scenarios
export class ContextBuilder {
  private context: UnifiedQueryContext = {};

  // Company context
  withCompany(companyId: string, companyConfig?: any): ContextBuilder {
    this.context.companyId = companyId;
    this.context.companyConfig = companyConfig;
    return this;
  }

  // User context
  withUser(userId: string, contactName?: string, phoneNumber?: string): ContextBuilder {
    this.context.userId = userId;
    this.context.contactName = contactName;
    this.context.phoneNumber = phoneNumber;
    return this;
  }

  // Platform context
  withPlatform(platform: UnifiedQueryContext['platform'], messageId?: string): ContextBuilder {
    this.context.platform = platform;
    this.context.messageId = messageId;
    return this;
  }

  // Conversation context
  withConversation(stage: UnifiedQueryContext['conversationStage'], sessionId?: string): ContextBuilder {
    this.context.conversationStage = stage;
    this.context.sessionId = sessionId;
    return this;
  }

  // Insurance context
  withInsurance(type: UnifiedQueryContext['insuranceType'], urgency?: UnifiedQueryContext['urgency']): ContextBuilder {
    this.context.insuranceType = type;
    this.context.urgency = urgency;
    return this;
  }

  // Location context
  withLocation(location: string, region?: string, country?: string): ContextBuilder {
    this.context.location = location;
    this.context.region = region;
    this.context.country = country || 'GH'; // Default to Ghana
    return this;
  }

  // Metadata
  withMetadata(metadata: Record<string, any>): ContextBuilder {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  // Analytics
  withAnalytics(campaignId?: string, referralSource?: string, trackingData?: Record<string, any>): ContextBuilder {
    this.context.campaignId = campaignId;
    this.context.referralSource = referralSource;
    this.context.trackingData = trackingData;
    return this;
  }

  // Auto-populate timestamp and request ID
  withDefaults(): ContextBuilder {
    this.context.timestamp = new Date().toISOString();
    this.context.requestId = this.generateRequestId();
    return this;
  }

  // Build the final context
  build(): UnifiedQueryContext {
    return { ...this.context };
  }

  // Static factory methods for common scenarios
  static forWhatsApp(companyId: string, userId: string, messageId: string): ContextBuilder {
    return new ContextBuilder()
      .withCompany(companyId)
      .withUser(userId)
      .withPlatform('whatsapp', messageId)
      .withDefaults();
  }

  static forWebChat(companyId: string, sessionId: string): ContextBuilder {
    return new ContextBuilder()
      .withCompany(companyId)
      .withPlatform('webchat')
      .withConversation('greeting', sessionId)
      .withDefaults();
  }

  static forAPI(companyId: string, requestId?: string): ContextBuilder {
    return new ContextBuilder()
      .withCompany(companyId)
      .withPlatform('api')
      .withDefaults();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type guards for context validation
export class ContextValidator {
  static isValidContext(context: any): context is UnifiedQueryContext {
    return typeof context === 'object' && context !== null;
  }

  static hasCompanyContext(context: UnifiedQueryContext): boolean {
    return !!(context.companyId || context.companyConfig);
  }

  static hasUserContext(context: UnifiedQueryContext): boolean {
    return !!(context.userId || context.contactName || context.phoneNumber);
  }

  static hasPlatformContext(context: UnifiedQueryContext): boolean {
    return !!(context.platform || context.messageId);
  }

  static isWhatsAppContext(context: UnifiedQueryContext): boolean {
    return context.platform === 'whatsapp' && !!(context.messageId || context.phoneNumber);
  }

  static validateRequiredFields(context: UnifiedQueryContext, requiredFields: (keyof UnifiedQueryContext)[]): string[] {
    const missing: string[] = [];
    
    for (const field of requiredFields) {
      if (!context[field]) {
        missing.push(field);
      }
    }
    
    return missing;
  }
}

// Context utilities
export class ContextUtils {
  static extractInsuranceType(message: string): UnifiedQueryContext['insuranceType'] {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('auto') || lowerMessage.includes('car') || lowerMessage.includes('vehicle')) {
      return 'auto';
    }
    if (lowerMessage.includes('health') || lowerMessage.includes('medical')) {
      return 'health';
    }
    if (lowerMessage.includes('life')) {
      return 'life';
    }
    if (lowerMessage.includes('business') || lowerMessage.includes('commercial')) {
      return 'business';
    }
    if (lowerMessage.includes('property') || lowerMessage.includes('home')) {
      return 'property';
    }
    if (lowerMessage.includes('travel')) {
      return 'travel';
    }
    
    return 'unknown';
  }

  static determineConversationStage(message: string): UnifiedQueryContext['conversationStage'] {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('start')) {
      return 'greeting';
    }
    if (lowerMessage.includes('quote') || lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      return 'quote_request';
    }
    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('yes')) {
      return 'ready_to_buy';
    }
    if (lowerMessage.includes('compare') || lowerMessage.includes('difference')) {
      return 'comparison';
    }
    if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('problem')) {
      return 'support_needed';
    }
    
    return 'information_gathering';
  }

  static determineUrgency(message: string, context: UnifiedQueryContext): UnifiedQueryContext['urgency'] {
    const lowerMessage = message.toLowerCase();
    
    // High urgency indicators
    if (lowerMessage.includes('urgent') || lowerMessage.includes('emergency') || 
        lowerMessage.includes('asap') || lowerMessage.includes('immediately')) {
      return 'high';
    }
    
    // Medium urgency indicators
    if (lowerMessage.includes('soon') || lowerMessage.includes('quickly') || 
        context.conversationStage === 'ready_to_buy') {
      return 'medium';
    }
    
    return 'low';
  }

  static calculateLeadScore(context: UnifiedQueryContext, message: string): number {
    let score = 50; // Base score
    
    // Platform scoring
    if (context.platform === 'whatsapp') score += 10;
    if (context.platform === 'webchat') score += 5;
    
    // Conversation stage scoring
    switch (context.conversationStage) {
      case 'ready_to_buy': score += 30; break;
      case 'quote_request': score += 20; break;
      case 'comparison': score += 15; break;
      case 'information_gathering': score += 10; break;
      case 'greeting': score += 5; break;
    }
    
    // Urgency scoring
    switch (context.urgency) {
      case 'high': score += 20; break;
      case 'medium': score += 10; break;
      case 'low': score += 0; break;
    }
    
    // Message content scoring
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('need') || lowerMessage.includes('want')) score += 10;
    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase')) score += 15;
    if (lowerMessage.includes('today') || lowerMessage.includes('now')) score += 10;
    
    // Cap the score
    return Math.min(100, Math.max(0, score));
  }

  static enrichContext(context: UnifiedQueryContext, message: string): UnifiedQueryContext {
    const enriched = { ...context };
    
    // Auto-detect insurance type if not provided
    if (!enriched.insuranceType || enriched.insuranceType === 'unknown') {
      enriched.insuranceType = ContextUtils.extractInsuranceType(message);
    }
    
    // Auto-detect conversation stage if not provided
    if (!enriched.conversationStage) {
      enriched.conversationStage = ContextUtils.determineConversationStage(message);
    }
    
    // Auto-detect urgency if not provided
    if (!enriched.urgency) {
      enriched.urgency = ContextUtils.determineUrgency(message, enriched);
    }
    
    // Calculate lead score if not provided
    if (!enriched.leadScore) {
      enriched.leadScore = ContextUtils.calculateLeadScore(enriched, message);
    }
    
    // Set timestamp if not provided
    if (!enriched.timestamp) {
      enriched.timestamp = new Date().toISOString();
    }
    
    // Set default country if location exists but country doesn't
    if (enriched.location && !enriched.country) {
      enriched.country = 'GH'; // Default to Ghana
    }
    
    return enriched;
  }
}

// Export type alias for backward compatibility during migration
export type QueryContext = UnifiedQueryContext;
export type EnhancedQueryContext = UnifiedQueryContext;
export type CompanyQueryContext = UnifiedQueryContext;