// File: backend/src/core/companies/CompanyConfigLoader.ts

import { CompanyConfig } from '../../types/CompanyTypes';
import Joi from 'joi';

export class CompanyConfigLoader {
  private validationSchema: Joi.ObjectSchema;

  constructor() {
    this.validationSchema = this.buildValidationSchema();
  }

  /**
   * Load and validate a company configuration
   */
  async loadCompany(data: any): Promise<CompanyConfig> {
    try {
      // Validate the data structure
      const { error, value } = this.validationSchema.validate(data, {
        allowUnknown: true,
        stripUnknown: true
      });

      if (error) {
        throw new Error(`Company validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      // Apply defaults
      const company = this.applyDefaults(value);

      // Perform additional business logic validation
      await this.validateBusinessLogic(company);

      return company;

    } catch (error) {
      console.error(`❌ Failed to load company ${data?.id || 'unknown'}:`, error);
      throw error;
    }
  }

  /**
   * Build Joi validation schema for company configuration
   */
  private buildValidationSchema(): Joi.ObjectSchema {
    return Joi.object({
      id: Joi.string().required().pattern(/^[a-zA-Z0-9_-]+$/),
      name: Joi.string().required().min(1).max(100),
      displayName: Joi.string().required().min(1).max(100),
      businessType: Joi.string().valid(
        'general_insurance', 
        'life_insurance', 
        'health_insurance', 
        'auto_insurance', 
        'multi_line'
      ).default('multi_line'),

      branding: Joi.object({
        primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#007bff'),
        secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#6c757d'),
        logo: Joi.string().uri().optional(),
        brandVoice: Joi.string().valid('professional', 'friendly', 'casual', 'authoritative').default('professional')
      }).default(),

      preferredLLMProvider: Joi.string().valid('openai', 'claude', 'local_llama', 'deepseek').optional(),
      llmPriority: Joi.string().valid('cost', 'speed', 'quality').default('cost'),

      vectorStoreConfig: Joi.object({
        indexName: Joi.string().optional(),
        namespace: Joi.string().optional(),
        customFilters: Joi.object().optional()
      }).default({}),

      platforms: Joi.object({
        whatsapp: Joi.object({
          enabled: Joi.boolean().default(false),
          phoneNumberId: Joi.string().optional(),
          accessToken: Joi.string().optional(),
          webhookUrl: Joi.string().uri().optional()
        }).optional(),
        instagram: Joi.object({
          enabled: Joi.boolean().default(false),
          accessToken: Joi.string().optional()
        }).optional(),
        facebook: Joi.object({
          enabled: Joi.boolean().default(false),
          pageId: Joi.string().optional(),
          accessToken: Joi.string().optional()
        }).optional(),
        telegram: Joi.object({
          enabled: Joi.boolean().default(false),
          botToken: Joi.string().optional()
        }).optional(),
        webchat: Joi.object({
          enabled: Joi.boolean().default(false),
          embedCode: Joi.string().optional()
        }).optional()
      }).default({}),

      contactInfo: Joi.object({
        phone: Joi.string().required(),
        email: Joi.string().email().required(),
        address: Joi.string().required(),
        website: Joi.string().uri().optional(),
        supportHours: Joi.string().default('Mon-Fri 8AM-6PM GMT')
      }).required(),

      businessSettings: Joi.object({
        currency: Joi.string().valid('GHS', 'USD', 'EUR').default('GHS'),
        timezone: Joi.string().default('Africa/Accra'),
        language: Joi.string().valid('en', 'tw', 'ga', 'ee', 'ha').default('en'),
        supportedLanguages: Joi.array().items(Joi.string()).default(['en']),
        businessHours: Joi.object().pattern(
          Joi.string(), 
          Joi.object({
            start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
            end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
          })
        ).default({})
      }).default(),

      premiumCalculation: Joi.object({
        enabled: Joi.boolean().default(true),
        baseRates: Joi.object({
          auto: Joi.object({
            baseAmount: Joi.number().positive(),
            currency: Joi.string(),
            coverageType: Joi.array().items(Joi.string()),
            validityPeriod: Joi.string()
          }).optional(),
          health: Joi.object({
            baseAmount: Joi.number().positive(),
            currency: Joi.string(),
            coverageType: Joi.array().items(Joi.string()),
            validityPeriod: Joi.string()
          }).optional(),
          life: Joi.object({
            baseAmount: Joi.number().positive(),
            currency: Joi.string(),
            coverageType: Joi.array().items(Joi.string()),
            validityPeriod: Joi.string()
          }).optional(),
          business: Joi.object({
            baseAmount: Joi.number().positive(),
            currency: Joi.string(),
            coverageType: Joi.array().items(Joi.string()),
            validityPeriod: Joi.string()
          }).optional()
        }).default({}),
        riskFactors: Joi.object({
          locationMultipliers: Joi.object().pattern(Joi.string(), Joi.number()).default({}),
          ageFactors: Joi.object().pattern(Joi.string(), Joi.number()).default({}),
          seasonalAdjustments: Joi.object().pattern(Joi.string(), Joi.number()).default({})
        }).default({})
      }).default(),

      knowledgeBase: Joi.object({
        documentIds: Joi.array().items(Joi.string()).default([]),
        categories: Joi.array().items(Joi.string()).default([]),
        lastUpdated: Joi.string().isoDate().default(() => new Date().toISOString())
      }).default(),

      analytics: Joi.object({
        enabled: Joi.boolean().default(true),
        dashboardUrl: Joi.string().uri().optional(),
        reportingEmail: Joi.string().email().optional()
      }).default(),

      compliance: Joi.object({
        dataRetentionDays: Joi.number().integer().min(30).max(2555).default(365), // Max ~7 years
        privacyPolicyUrl: Joi.string().uri().optional(),
        termsOfServiceUrl: Joi.string().uri().optional(),
        regulatoryLicense: Joi.string().optional()
      }).default(),

      status: Joi.string().valid('active', 'inactive', 'setup', 'suspended').default('setup'),
      createdAt: Joi.string().isoDate().default(() => new Date().toISOString()),
      updatedAt: Joi.string().isoDate().default(() => new Date().toISOString())
    });
  }

  /**
   * Apply default values and transformations
   */
  private applyDefaults(data: any): CompanyConfig {
    const now = new Date().toISOString();

    // Ensure timestamps
    if (!data.createdAt) data.createdAt = now;
    if (!data.updatedAt) data.updatedAt = now;

    // Ensure vector store namespace matches company ID
    if (!data.vectorStoreConfig.namespace) {
      data.vectorStoreConfig.namespace = data.id;
    }

    // Set default business hours if not provided
    if (!data.businessSettings.businessHours || Object.keys(data.businessSettings.businessHours).length === 0) {
      data.businessSettings.businessHours = {
        monday: { start: '08:00', end: '18:00' },
        tuesday: { start: '08:00', end: '18:00' },
        wednesday: { start: '08:00', end: '18:00' },
        thursday: { start: '08:00', end: '18:00' },
        friday: { start: '08:00', end: '18:00' },
        saturday: { start: '09:00', end: '15:00' },
        sunday: { start: '10:00', end: '14:00' }
      };
    }

    // Set default risk factors for Ghana market
    if (!data.premiumCalculation.riskFactors.locationMultipliers || 
        Object.keys(data.premiumCalculation.riskFactors.locationMultipliers).length === 0) {
      data.premiumCalculation.riskFactors.locationMultipliers = {
        'accra': 1.2,
        'kumasi': 1.1,
        'tamale': 1.0,
        'cape_coast': 1.05,
        'takoradi': 1.05,
        'tema': 1.15,
        'ho': 1.0,
        'koforidua': 1.0,
        'sunyani': 0.95,
        'wa': 0.9,
        'bolgatanga': 0.9,
        'rural': 0.85
      };
    }

    if (!data.premiumCalculation.riskFactors.ageFactors || 
        Object.keys(data.premiumCalculation.riskFactors.ageFactors).length === 0) {
      data.premiumCalculation.riskFactors.ageFactors = {
        '18-25': 1.3,
        '26-35': 1.0,
        '36-45': 0.9,
        '46-55': 0.95,
        '56-65': 1.1,
        '65+': 1.4
      };
    }

    if (!data.premiumCalculation.riskFactors.seasonalAdjustments || 
        Object.keys(data.premiumCalculation.riskFactors.seasonalAdjustments).length === 0) {
      data.premiumCalculation.riskFactors.seasonalAdjustments = {
        'harmattan': 1.1,  // December - February (dry, dusty season)
        'dry': 1.0,        // March - May 
        'rainy': 1.2,      // June - September (heavy rains, flooding)
        'minor_dry': 1.05  // October - November
      };
    }

    // Ensure knowledge base categories include defaults
    if (!data.knowledgeBase.categories || data.knowledgeBase.categories.length === 0) {
      data.knowledgeBase.categories = ['auto', 'health', 'life', 'business', 'property', 'travel'];
    }

    return data as CompanyConfig;
  }

  /**
   * Validate business logic and dependencies
   */
  private async validateBusinessLogic(company: CompanyConfig): Promise<void> {
    const errors: string[] = [];

    // Platform configuration validation
    if (company.platforms.whatsapp?.enabled) {
      if (!company.platforms.whatsapp.phoneNumberId) {
        errors.push('WhatsApp phone number ID is required when WhatsApp is enabled');
      }
      if (!company.platforms.whatsapp.accessToken) {
        errors.push('WhatsApp access token is required when WhatsApp is enabled');
      }
    }

    if (company.platforms.instagram?.enabled) {
      if (!company.platforms.instagram.accessToken) {
        errors.push('Instagram access token is required when Instagram is enabled');
      }
    }

    if (company.platforms.facebook?.enabled) {
      if (!company.platforms.facebook.pageId || !company.platforms.facebook.accessToken) {
        errors.push('Facebook page ID and access token are required when Facebook is enabled');
      }
    }

    if (company.platforms.telegram?.enabled) {
      if (!company.platforms.telegram.botToken) {
        errors.push('Telegram bot token is required when Telegram is enabled');
      }
    }

    // Business hours validation
    const businessHours = company.businessSettings.businessHours;
    for (const [day, hours] of Object.entries(businessHours)) {
      if (!this.isValidTimeFormat(hours.start) || !this.isValidTimeFormat(hours.end)) {
        errors.push(`Invalid time format for ${day}: start=${hours.start}, end=${hours.end}`);
      }
      
      if (this.timeToMinutes(hours.start) >= this.timeToMinutes(hours.end)) {
        errors.push(`Invalid business hours for ${day}: start time must be before end time`);
      }
    }

    // Premium calculation validation
    if (company.premiumCalculation.enabled) {
      if (Object.keys(company.premiumCalculation.baseRates).length === 0) {
        errors.push('Premium calculation is enabled but no base rates are configured');
      }

      // Validate base rates
      for (const [type, rate] of Object.entries(company.premiumCalculation.baseRates)) {
        if (rate && (!rate.baseAmount || rate.baseAmount <= 0)) {
          errors.push(`Invalid base amount for ${type} insurance: ${rate.baseAmount}`);
        }
      }
    }

    // Currency and business settings validation
    const supportedCurrencies = ['GHS', 'USD', 'EUR'];
    if (!supportedCurrencies.includes(company.businessSettings.currency)) {
      errors.push(`Unsupported currency: ${company.businessSettings.currency}`);
    }

    // Language validation
    const supportedLanguages = ['en', 'tw', 'ga', 'ee', 'ha'];
    if (!supportedLanguages.includes(company.businessSettings.language)) {
      errors.push(`Unsupported primary language: ${company.businessSettings.language}`);
    }

    for (const lang of company.businessSettings.supportedLanguages) {
      if (!supportedLanguages.includes(lang)) {
        errors.push(`Unsupported language in supportedLanguages: ${lang}`);
      }
    }

    // Contact information validation
    if (!this.isValidPhoneNumber(company.contactInfo.phone)) {
      errors.push(`Invalid phone number format: ${company.contactInfo.phone}`);
    }

    // Compliance validation
    if (company.compliance.dataRetentionDays < 30) {
      errors.push('Data retention period must be at least 30 days');
    }

    if (company.compliance.dataRetentionDays > 2555) {
      errors.push('Data retention period cannot exceed 7 years (2555 days)');
    }

    if (errors.length > 0) {
      throw new Error(`Business logic validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Validate time format (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Validate phone number format (basic validation)
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation - supports various international formats
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 8 && cleanPhone.length <= 16;
  }

  /**
   * Load company from environment variables (for testing/development)
   */
  async loadFromEnvironment(companyId: string = 'default'): Promise<CompanyConfig> {
    const envData = {
      id: companyId,
      name: process.env.COMPANY_NAME || 'AI Insurance Agent',
      displayName: process.env.COMPANY_DISPLAY_NAME || process.env.COMPANY_NAME || 'AI Insurance Agent',
      businessType: process.env.COMPANY_BUSINESS_TYPE || 'multi_line',
      
      branding: {
        primaryColor: process.env.COMPANY_PRIMARY_COLOR || '#007bff',
        secondaryColor: process.env.COMPANY_SECONDARY_COLOR || '#6c757d',
        logo: process.env.COMPANY_LOGO_URL,
        brandVoice: process.env.COMPANY_BRAND_VOICE || 'professional'
      },
      
      preferredLLMProvider: process.env.PREFERRED_LLM_PROVIDER,
      llmPriority: process.env.LLM_PRIORITY || 'cost',
      
      platforms: {
        whatsapp: {
          enabled: process.env.WHATSAPP_ENABLED === 'true',
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          webhookUrl: process.env.WHATSAPP_WEBHOOK_URL
        },
        instagram: {
          enabled: process.env.INSTAGRAM_ENABLED === 'true',
          accessToken: process.env.INSTAGRAM_ACCESS_TOKEN
        },
        facebook: {
          enabled: process.env.FACEBOOK_ENABLED === 'true',
          pageId: process.env.FACEBOOK_PAGE_ID,
          accessToken: process.env.FACEBOOK_ACCESS_TOKEN
        },
        telegram: {
          enabled: process.env.TELEGRAM_ENABLED === 'true',
          botToken: process.env.TELEGRAM_BOT_TOKEN
        },
        webchat: {
          enabled: process.env.WEBCHAT_ENABLED !== 'false', // Default to true
          embedCode: process.env.WEBCHAT_EMBED_CODE
        }
      },
      
      contactInfo: {
        phone: process.env.COMPANY_PHONE || '+233-XXX-XXXX',
        email: process.env.COMPANY_EMAIL || 'info@company.com',
        address: process.env.COMPANY_ADDRESS || 'Accra, Ghana',
        website: process.env.COMPANY_WEBSITE,
        supportHours: process.env.COMPANY_SUPPORT_HOURS || 'Mon-Fri 8AM-6PM GMT'
      },
      
      businessSettings: {
        currency: process.env.COMPANY_CURRENCY || 'GHS',
        timezone: process.env.COMPANY_TIMEZONE || 'Africa/Accra',
        language: process.env.COMPANY_LANGUAGE || 'en',
        supportedLanguages: process.env.COMPANY_SUPPORTED_LANGUAGES?.split(',') || ['en']
      },
      
      status: process.env.COMPANY_STATUS || 'active'
    };

    return await this.loadCompany(envData);
  }

  /**
   * Validate configuration completeness
   */
  validateCompleteness(company: CompanyConfig): { score: number; missingItems: string[] } {
    const requiredItems = [
      { key: 'id', value: company.id },
      { key: 'name', value: company.name },
      { key: 'contactInfo.phone', value: company.contactInfo.phone },
      { key: 'contactInfo.email', value: company.contactInfo.email },
      { key: 'contactInfo.address', value: company.contactInfo.address },
      { key: 'branding.primaryColor', value: company.branding.primaryColor },
      { key: 'businessSettings.currency', value: company.businessSettings.currency },
      { key: 'businessSettings.timezone', value: company.businessSettings.timezone }
    ];

    const optionalItems = [
      { key: 'branding.logo', value: company.branding.logo },
      { key: 'contactInfo.website', value: company.contactInfo.website },
      { key: 'preferredLLMProvider', value: company.preferredLLMProvider },
      { key: 'platforms.whatsapp.enabled', value: company.platforms.whatsapp?.enabled },
      { key: 'premiumCalculation.enabled', value: company.premiumCalculation.enabled },
      { key: 'analytics.enabled', value: company.analytics.enabled }
    ];

    const missingRequired = requiredItems.filter(item => !item.value).map(item => item.key);
    const completedOptional = optionalItems.filter(item => item.value).length;

    const requiredScore = ((requiredItems.length - missingRequired.length) / requiredItems.length) * 70;
    const optionalScore = (completedOptional / optionalItems.length) * 30;
    
    return {
      score: Math.round(requiredScore + optionalScore),
      missingItems: missingRequired
    };
  }
}