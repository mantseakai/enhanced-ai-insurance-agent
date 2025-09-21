// File: backend/src/types/unified-rag.ts
// Updated to use UnifiedQueryContext and remove conflicts

import { UnifiedQueryContext, ContextBuilder, ContextValidator, ContextUtils } from './UnifiedContext';

// Import the unified context
export { 
  UnifiedQueryContext as QueryContext,
  UnifiedQueryContext as EnhancedQueryContext,
  UnifiedQueryContext as CompanyQueryContext,
  UnifiedQueryContext,
  ContextBuilder,
  ContextValidator,
  ContextUtils
} from './UnifiedContext';

// Existing interfaces that don't conflict
export interface CustomerProfile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  age?: number;
  location?: string;
  insuranceHistory?: InsuranceHistory[];
  preferences?: CustomerPreferences;
  riskProfile?: RiskProfile;
  communicationPreferences?: CommunicationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceHistory {
  policyId: string;
  insuranceType: 'auto' | 'health' | 'life' | 'business' | 'property' | 'travel';
  provider: string;
  startDate: string;
  endDate?: string;
  premiumAmount: number;
  claimsHistory: ClaimRecord[];
  status: 'active' | 'expired' | 'cancelled';
}

export interface ClaimRecord {
  claimId: string;
  date: string;
  amount: number;
  status: 'pending' | 'approved' | 'denied' | 'settled';
  description: string;
}

export interface CustomerPreferences {
  preferredContactMethod: 'whatsapp' | 'email' | 'phone' | 'sms';
  languagePreference: string;
  communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'as_needed';
  marketingOptIn: boolean;
  reminderPreferences: ReminderPreferences;
}

export interface ReminderPreferences {
  policyRenewal: boolean;
  paymentDue: boolean;
  claimUpdates: boolean;
  promotionalOffers: boolean;
}

export interface RiskProfile {
  overallRiskScore: number; // 0-100
  factors: RiskFactor[];
  lastUpdated: string;
  assessmentMethod: 'automated' | 'manual' | 'hybrid';
}

export interface RiskFactor {
  category: 'age' | 'location' | 'occupation' | 'lifestyle' | 'health' | 'driving' | 'financial';
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-1
  description: string;
}

export interface CommunicationPreferences {
  channels: string[];
  timeZone: string;
  availableHours: {
    start: string;
    end: string;
  };
  doNotDisturbHours: {
    start: string;
    end: string;
  };
  emergencyContact: boolean;
}

export interface ConversationContext {
  conversationId: string;
  sessionId: string;
  userId: string;
  companyId: string;
  platform: string;
  startTime: string;
  lastActivity: string;
  messageCount: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  context: UnifiedQueryContext;
}

export interface ConversationMessage {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    processingTime?: number;
    llmProvider?: string;
    cost?: number;
    [key: string]: any;
  };
}

export interface AIAnalysis {
  intent: 'quote_request' | 'information_seeking' | 'support' | 'comparison' | 'complaint' | 'greeting' | 'unknown';
  insuranceType: 'auto' | 'health' | 'life' | 'business' | 'property' | 'travel' | 'unknown';
  urgency: 'low' | 'medium' | 'high';
  leadScore: number; // 0-100
  extractedInfo: {
    age?: number;
    location?: string;
    specificNeeds?: string[];
    budget?: number;
    timeline?: string;
    currentProvider?: string;
    [key: string]: any;
  };
  nextActions: string[];
  confidence: number; // 0-1
  reasoning?: string;
  suggestedResponses?: string[];
}

export interface ContextualQueryResult {
  documents: EnhancedRAGDocument[];
  totalResults: number;
  averageScore: number;
  searchQuery: string;
  processingTime: number;
  searchMetadata?: {
    vectorStoreProvider: string;
    indexUsed: string;
    filters?: Record<string, any>;
    reranked?: boolean;
  };
}

export interface EnhancedRAGDocument {
  id: string;
  content: string;
  metadata: {
    type: 'policy' | 'faq' | 'guide' | 'regulation' | 'template' | 'knowledge_base';
    source: string;
    companyId?: string;
    insuranceType?: string;
    relevanceScore?: number;
    lastUpdated?: string;
    version?: string;
    language?: string;
    tags?: string[];
    [key: string]: any;
  };
  embedding?: number[];
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  chunkId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

export interface PremiumQuote {
  quoteId: string;
  companyId: string;
  userId: string;
  insuranceType: string;
  coverageDetails: CoverageDetails;
  premiumAmount: number;
  currency: string;
  validityPeriod: string;
  expiryDate: string;
  factors: PremiumFactor[];
  discounts: Discount[];
  additionalOptions: AdditionalOption[];
  terms: string[];
  generatedAt: string;
  generatedBy: 'ai' | 'manual' | 'hybrid';
}

export interface CoverageDetails {
  coverageType: string;
  coverageAmount: number;
  deductible: number;
  beneficiaries?: string[];
  exclusions: string[];
  inclusions: string[];
  policyPeriod: string;
}

export interface PremiumFactor {
  category: 'age' | 'location' | 'risk' | 'seasonal' | 'vehicle' | 'health' | 'occupation';
  factor: string;
  multiplier: number;
  impact: number; // Amount added/subtracted
  description: string;
}

export interface Discount {
  type: 'loyalty' | 'no_claims' | 'multi_policy' | 'payment_method' | 'promotional';
  name: string;
  percentage: number;
  amount: number;
  conditions: string[];
  validUntil?: string;
}

export interface AdditionalOption {
  optionId: string;
  name: string;
  description: string;
  additionalPremium: number;
  recommended: boolean;
  category: 'coverage' | 'service' | 'convenience';
}

export interface LeadCapture {
  leadId: string;
  companyId: string;
  sourceData: {
    platform: string;
    campaignId?: string;
    referralSource?: string;
    initialMessage: string;
    context: UnifiedQueryContext;
  };
  customerData: {
    contactInfo: ContactInfo;
    preferences: Partial<CustomerPreferences>;
    insuranceNeeds: InsuranceNeeds;
  };
  leadScore: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'converted' | 'lost';
  assignedAgent?: string;
  followUpScheduled?: string;
  notes: LeadNote[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  preferredContactMethod?: string;
  bestTimeToCall?: string;
  address?: string;
}

export interface InsuranceNeeds {
  primaryType: string;
  secondaryTypes: string[];
  budget?: number;
  timeline: string;
  currentProvider?: string;
  specificRequirements: string[];
  urgency: 'low' | 'medium' | 'high';
}

export interface LeadNote {
  noteId: string;
  author: string;
  content: string;
  type: 'interaction' | 'observation' | 'follow_up' | 'decision';
  timestamp: string;
  internal: boolean;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  companyId: string;
  platform: string;
  status: 'active' | 'idle' | 'ended';
  startTime: string;
  lastActivity: string;
  messageCount: number;
  context: UnifiedQueryContext;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    location?: string;
  };
}

export interface SystemMetrics {
  timestamp: string;
  aiService: {
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    errorRate: number;
    activeProviders: string[];
  };
  vectorStore: {
    totalDocuments: number;
    totalQueries: number;
    averageQueryTime: number;
    hitRate: number;
  };
  cache: {
    hitRate: number;
    totalKeys: number;
    memoryUsage: number;
    errorRate: number;
  };
  companies: {
    totalCompanies: number;
    activeCompanies: number;
    platformDistribution: Record<string, number>;
  };
  conversations: {
    totalConversations: number;
    activeConversations: number;
    averageConversationLength: number;
    conversionRate: number;
  };
}

// Legacy type aliases for backward compatibility
export type QueryContextLegacy = UnifiedQueryContext;
export type EnhancedQueryContextLegacy = UnifiedQueryContext;
export type CompanyQueryContextLegacy = UnifiedQueryContext;

// Utility type for AI service responses
export interface AIServiceResponse {
  message: string;
  confidence: number;
  shouldCaptureLead?: boolean;
  leadScore?: number;
  premiumQuote?: PremiumQuote;
  contextualFactors?: any;
  nextActions?: string[];
  conversationStage?: string;
  providerUsed?: string;
  cost?: number;
  responseTime?: number;
  companyId?: string;
  metadata?: Record<string, any>;
}