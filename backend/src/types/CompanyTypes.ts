// File: backend/src/types/CompanyTypes.ts

export interface CompanyConfig {
  id: string;
  name: string;
  displayName: string;
  businessType: 'general_insurance' | 'life_insurance' | 'health_insurance' | 'auto_insurance' | 'multi_line';
  
  // Branding
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
    brandVoice: 'professional' | 'friendly' | 'casual' | 'authoritative';
  };
  
  // AI Configuration
  preferredLLMProvider?: 'openai' | 'claude' | 'local_llama' | 'deepseek';
  llmPriority: 'cost' | 'speed' | 'quality';
  
  // Vector Store Configuration
  vectorStoreConfig: {
    indexName?: string;
    namespace?: string;
    customFilters?: Record<string, any>;
  };
  
  // Platform Integrations
  platforms: {
    whatsapp?: {
      enabled: boolean;
      phoneNumberId?: string;
      accessToken?: string;
      webhookUrl?: string;
    };
    instagram?: {
      enabled: boolean;
      accessToken?: string;
      webhookSecret?: string;
      businessAccountId?: string;
    };
    facebook?: {
      enabled: boolean;
      pageId?: string;
      accessToken?: string;
    };
    telegram?: {
      enabled: boolean;
      botToken?: string;
    };
    webchat?: {
      enabled: boolean;
      embedCode?: string;
    };
  };
  
  // Contact Information
  contactInfo: {
    phone: string;
    email: string;
    address: string;
    website?: string;
    supportHours: string;
  };
  
  // Business Settings
  businessSettings: {
    currency: 'GHS' | 'USD' | 'EUR';
    timezone: string;
    language: 'en' | 'tw' | 'ga' | 'ee' | 'ha';
    supportedLanguages: string[];
    businessHours: {
      [key: string]: { start: string; end: string; };
    };
  };
  
  // Premium Calculation
  premiumCalculation: {
    enabled: boolean;
    baseRates: {
      auto?: PremiumBaseRate;
      health?: PremiumBaseRate;
      life?: PremiumBaseRate;
      business?: PremiumBaseRate;
    };
    riskFactors: {
      locationMultipliers: Record<string, number>;
      ageFactors: Record<string, number>;
      seasonalAdjustments: Record<string, number>;
    };
  };
  
  // Knowledge Base
  knowledgeBase: {
    documentIds: string[];
    categories: string[];
    lastUpdated: string;
  };
  
  // Analytics & Reporting
  analytics: {
    enabled: boolean;
    dashboardUrl?: string;
    reportingEmail?: string;
  };
  
  // Compliance & Security
  compliance: {
    dataRetentionDays: number;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
    regulatoryLicense?: string;
  };
  
  // Status
  status: 'active' | 'inactive' | 'setup' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface PremiumBaseRate {
  baseAmount: number;
  currency: string;
  coverageType: string[];
  validityPeriod: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  displayName: string;
  businessType: string;
  status: string;
  logo?: string;
  primaryColor: string;
  contactPhone: string;
  contactEmail: string;
  enabledPlatforms: string[];
  createdAt: string;
}

export interface CompanyStats {
  companyId: string;
  totalConversations: number;
  totalLeads: number;
  conversionRate: number;
  avgResponseTime: number;
  topInsuranceTypes: Array<{
    type: string;
    count: number;
  }>;
  platformStats: Array<{
    platform: string;
    conversations: number;
    leads: number;
  }>;
  periodStart: string;
  periodEnd: string;
}

export interface CompanyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
  score: number; // 0-100 completeness score
}

// Context for company-specific operations
export interface CompanyContext {
  companyId: string;
  userId?: string;
  platform?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// Company-specific error types
export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`Company not found: ${companyId}`);
    this.name = 'CompanyNotFoundError';
  }
}

export class CompanyInactiveError extends Error {
  constructor(companyId: string) {
    super(`Company is inactive: ${companyId}`);
    this.name = 'CompanyInactiveError';
  }
}

export class CompanyConfigurationError extends Error {
  constructor(companyId: string, issue: string) {
    super(`Company configuration error for ${companyId}: ${issue}`);
    this.name = 'CompanyConfigurationError';
  }
}