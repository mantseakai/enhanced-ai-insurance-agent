// File: backend/src/core/companies/CompanyManager.ts

import { 
  CompanyConfig, 
  CompanyProfile, 
  CompanyStats, 
  CompanyValidationResult,
  CompanyContext,
  CompanyNotFoundError,
  CompanyInactiveError,
  CompanyConfigurationError
} from '../../types/CompanyTypes';
import fs from 'fs/promises';
import path from 'path';

export class CompanyManager {
  private static instance: CompanyManager;
  private companies: Map<string, CompanyConfig> = new Map();
  private initialized: boolean = false;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'src', 'config', 'companies.json');
  }

  static getInstance(): CompanyManager {
    if (!CompanyManager.instance) {
      CompanyManager.instance = new CompanyManager();
    }
    return CompanyManager.instance;
  }

  /**
   * Initialize the company manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('🏢 Initializing Company Manager...');
      
      // Load companies from configuration file
      await this.loadCompaniesFromConfig();
      
      // Load any environment-specific overrides
      this.loadEnvironmentOverrides();
      
      // Validate all loaded companies
      await this.validateAllCompanies();
      
      this.initialized = true;
      console.log(`✅ Company Manager initialized with ${this.companies.size} companies`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Company Manager:', error);
      throw error;
    }
  }

  /**
   * Get company configuration by ID
   */
  async getCompanyConfig(companyId: string): Promise<CompanyConfig> {
    if (!this.initialized) {
      await this.initialize();
    }

    const company = this.companies.get(companyId);
    if (!company) {
      // Try default company if specific company not found
      const defaultCompany = this.companies.get('default');
      if (!defaultCompany) {
        throw new CompanyNotFoundError(companyId);
      }
      return defaultCompany;
    }

    if (company.status !== 'active') {
      throw new CompanyInactiveError(companyId);
    }

    return company;
  }

  /**
   * Get company profile (public info only)
   */
  async getCompanyProfile(companyId: string): Promise<CompanyProfile> {
    const config = await this.getCompanyConfig(companyId);
    
    return {
      id: config.id,
      name: config.name,
      displayName: config.displayName,
      businessType: config.businessType,
      status: config.status,
      logo: config.branding.logo,
      primaryColor: config.branding.primaryColor,
      contactPhone: config.contactInfo.phone,
      contactEmail: config.contactInfo.email,
      enabledPlatforms: Object.keys(config.platforms).filter(
        platform => config.platforms[platform as keyof typeof config.platforms]?.enabled
      ),
      createdAt: config.createdAt
    };
  }

  /**
   * Get all active companies
   */
  getActiveCompanies(): CompanyProfile[] {
    return Array.from(this.companies.values())
      .filter(company => company.status === 'active')
      .map(config => ({
        id: config.id,
        name: config.name,
        displayName: config.displayName,
        businessType: config.businessType,
        status: config.status,
        logo: config.branding.logo,
        primaryColor: config.branding.primaryColor,
        contactPhone: config.contactInfo.phone,
        contactEmail: config.contactInfo.email,
        enabledPlatforms: Object.keys(config.platforms).filter(
          platform => config.platforms[platform as keyof typeof config.platforms]?.enabled
        ),
        createdAt: config.createdAt
      }));
  }

  /**
   * Create a new company
   */
  async createCompany(companyData: Partial<CompanyConfig>): Promise<CompanyConfig> {
    if (!companyData.id || !companyData.name) {
      throw new CompanyConfigurationError('new', 'Company ID and name are required');
    }

    if (this.companies.has(companyData.id)) {
      throw new CompanyConfigurationError(companyData.id, 'Company already exists');
    }

    // Create company with defaults
    const company: CompanyConfig = {
      ...this.getDefaultCompanyConfig(),
      ...companyData,
      id: companyData.id,
      name: companyData.name,
      displayName: companyData.displayName || companyData.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Validate the new company
    const validation = await this.validateCompany(company);
    if (!validation.isValid) {
      throw new CompanyConfigurationError(company.id, validation.errors.join(', '));
    }

    // Add to memory
    this.companies.set(company.id, company);
    
    // Persist to storage
    await this.saveCompaniesConfig();
    
    console.log(`✅ Created new company: ${company.name} (${company.id})`);
    
    return company;
  }

  /**
   * Update existing company
   */
  async updateCompany(companyId: string, updates: Partial<CompanyConfig>): Promise<CompanyConfig> {
    const existingCompany = await this.getCompanyConfig(companyId);
    
    // Merge updates
    const updatedCompany: CompanyConfig = {
      ...existingCompany,
      ...updates,
      id: companyId, // Prevent ID changes
      updatedAt: new Date().toISOString()
    };

    // Validate the updated company
    const validation = await this.validateCompany(updatedCompany);
    if (!validation.isValid) {
      throw new CompanyConfigurationError(companyId, validation.errors.join(', '));
    }

    // Update in memory
    this.companies.set(companyId, updatedCompany);
    
    // Persist to storage
    await this.saveCompaniesConfig();
    
    console.log(`✅ Updated company: ${updatedCompany.name} (${companyId})`);
    
    return updatedCompany;
  }

  /**
   * Delete company
   */
  async deleteCompany(companyId: string): Promise<void> {
    if (companyId === 'default') {
      throw new CompanyConfigurationError(companyId, 'Cannot delete default company');
    }

    if (!this.companies.has(companyId)) {
      throw new CompanyNotFoundError(companyId);
    }

    // Remove from memory
    this.companies.delete(companyId);
    
    // Persist to storage
    await this.saveCompaniesConfig();
    
    console.log(`✅ Deleted company: ${companyId}`);
  }

  /**
   * Validate company configuration
   */
  async validateCompany(company: CompanyConfig): Promise<CompanyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    // Required fields validation
    if (!company.id) missingFields.push('id');
    if (!company.name) missingFields.push('name');
    if (!company.contactInfo.email) missingFields.push('contactInfo.email');
    if (!company.contactInfo.phone) missingFields.push('contactInfo.phone');

    // Business logic validation
    if (company.platforms) {
      const enabledPlatforms = Object.entries(company.platforms)
        .filter(([_, config]) => config?.enabled);
      
      if (enabledPlatforms.length === 0) {
        warnings.push('No platforms are enabled');
      }

      // WhatsApp specific validation
      if (company.platforms.whatsapp?.enabled) {
        if (!company.platforms.whatsapp.phoneNumberId) {
          errors.push('WhatsApp phone number ID is required when WhatsApp is enabled');
        }
        if (!company.platforms.whatsapp.accessToken) {
          errors.push('WhatsApp access token is required when WhatsApp is enabled');
        }
      }
    }

    // LLM configuration validation
    if (company.preferredLLMProvider) {
      const supportedProviders = ['openai', 'claude', 'local_llama', 'deepseek'];
      if (!supportedProviders.includes(company.preferredLLMProvider)) {
        errors.push(`Unsupported LLM provider: ${company.preferredLLMProvider}`);
      }
    }

    // Calculate completeness score
    const totalFields = 20; // Adjust based on important fields
    const completedFields = totalFields - missingFields.length - errors.length;
    const score = Math.max(0, Math.min(100, Math.round((completedFields / totalFields) * 100)));

    return {
      isValid: errors.length === 0 && missingFields.length === 0,
      errors,
      warnings,
      missingFields,
      score
    };
  }

  /**
   * Get company statistics
   */
  async getCompanyStats(companyId: string, startDate?: Date, endDate?: Date): Promise<CompanyStats> {
    // This would integrate with your analytics system
    // For now, returning mock data structure
    return {
      companyId,
      totalConversations: 0,
      totalLeads: 0,
      conversionRate: 0,
      avgResponseTime: 0,
      topInsuranceTypes: [],
      platformStats: [],
      periodStart: startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: endDate?.toISOString() || new Date().toISOString()
    };
  }

  /**
   * Get companies by platform
   */
  getCompaniesByPlatform(platform: string): CompanyProfile[] {
    return Array.from(this.companies.values())
      .filter(company => 
        company.status === 'active' &&
        company.platforms[platform as keyof typeof company.platforms]?.enabled
      )
      .map(this.configToProfile);
  }

  /**
   * Load companies from configuration file
   */
  private async loadCompaniesFromConfig(): Promise<void> {
    try {
      // Check if config file exists
      const configExists = await fs.access(this.configPath).then(() => true).catch(() => false);
      
      if (!configExists) {
        console.log('📝 No companies config file found, creating default...');
        await this.createDefaultCompaniesConfig();
        return;
      }

      // Load and parse config file
      const configData = await fs.readFile(this.configPath, 'utf8');
      const companiesData = JSON.parse(configData);

      // Load each company
      for (const companyData of companiesData.companies || []) {
        try {
          // Apply defaults to loaded company data
          const company = this.applyCompanyDefaults(companyData);
          this.companies.set(company.id, company);
          console.log(`📋 Loaded company: ${company.name} (${company.id})`);
        } catch (error) {
          console.warn(`⚠️ Failed to load company ${companyData.id}:`, error);
        }
      }

      // Ensure default company exists
      if (!this.companies.has('default')) {
        console.log('📝 Creating default company...');
        const defaultCompany = this.getDefaultCompanyConfig();
        this.companies.set('default', defaultCompany);
      }

    } catch (error) {
      console.error('❌ Failed to load companies config:', error);
      // Create default company as fallback
      const defaultCompany = this.getDefaultCompanyConfig();
      this.companies.set('default', defaultCompany);
    }
  }

  /**
   * Apply defaults to company data
   */
  private applyCompanyDefaults(companyData: any): CompanyConfig {
    const defaults = this.getDefaultCompanyConfig();
    
    return {
      ...defaults,
      ...companyData,
      branding: {
        ...defaults.branding,
        ...companyData.branding
      },
      contactInfo: {
        ...defaults.contactInfo,
        ...companyData.contactInfo
      },
      businessSettings: {
        ...defaults.businessSettings,
        ...companyData.businessSettings,
        businessHours: {
          ...defaults.businessSettings.businessHours,
          ...companyData.businessSettings?.businessHours
        }
      },
      platforms: {
        ...defaults.platforms,
        ...companyData.platforms
      },
      premiumCalculation: {
        ...defaults.premiumCalculation,
        ...companyData.premiumCalculation,
        riskFactors: {
          ...defaults.premiumCalculation.riskFactors,
          ...companyData.premiumCalculation?.riskFactors
        }
      },
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Load environment-specific overrides
   */
  private loadEnvironmentOverrides(): void {
    // Override with environment variables if available
    const envCompanyId = process.env.DEFAULT_COMPANY_ID || 'default';
    const envCompanyName = process.env.DEFAULT_COMPANY_NAME;
    
    if (envCompanyName && this.companies.has(envCompanyId)) {
      const company = this.companies.get(envCompanyId)!;
      company.name = envCompanyName;
      company.displayName = envCompanyName;
      this.companies.set(envCompanyId, company);
    }
  }

  /**
   * Validate all loaded companies
   */
  private async validateAllCompanies(): Promise<void> {
    const invalidCompanies: string[] = [];
    
    for (const [companyId, company] of this.companies.entries()) {
      const validation = await this.validateCompany(company);
      if (!validation.isValid) {
        console.warn(`⚠️ Company ${companyId} has validation issues:`, validation.errors);
        if (validation.errors.length > 0) {
          invalidCompanies.push(companyId);
        }
      }
    }

    if (invalidCompanies.length > 0 && invalidCompanies.includes('default')) {
      throw new CompanyConfigurationError('default', 'Default company configuration is invalid');
    }
  }

  /**
   * Save companies configuration to file
   */
  private async saveCompaniesConfig(): Promise<void> {
    try {
      const configData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        companies: Array.from(this.companies.values())
      };

      await fs.writeFile(this.configPath, JSON.stringify(configData, null, 2), 'utf8');
      console.log('💾 Companies configuration saved');
      
    } catch (error) {
      console.error('❌ Failed to save companies config:', error);
      throw error;
    }
  }

  /**
   * Create default companies configuration file
   */
  private async createDefaultCompaniesConfig(): Promise<void> {
    const defaultCompany = this.getDefaultCompanyConfig();
    this.companies.set('default', defaultCompany);
    
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    await this.saveCompaniesConfig();
  }

  /**
   * Get default company configuration
   */
  private getDefaultCompanyConfig(): CompanyConfig {
    return {
      id: 'default',
      name: 'AI Insurance Agent',
      displayName: 'AI Insurance Agent',
      businessType: 'multi_line',
      
      branding: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        brandVoice: 'professional'
      },
      
      llmPriority: 'cost',
      
      vectorStoreConfig: {
        namespace: 'default'
      },
      
      platforms: {
        whatsapp: {
          enabled: true,
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN
        },
        webchat: {
          enabled: true
        }
      },
      
      contactInfo: {
        phone: '+233-XXX-XXXX',
        email: 'info@aiinsurance.com',
        address: 'Accra, Ghana',
        supportHours: 'Mon-Fri 8AM-6PM GMT'
      },
      
      businessSettings: {
        currency: 'GHS',
        timezone: 'Africa/Accra',
        language: 'en',
        supportedLanguages: ['en', 'tw'],
        businessHours: {
          monday: { start: '08:00', end: '18:00' },
          tuesday: { start: '08:00', end: '18:00' },
          wednesday: { start: '08:00', end: '18:00' },
          thursday: { start: '08:00', end: '18:00' },
          friday: { start: '08:00', end: '18:00' },
          saturday: { start: '09:00', end: '15:00' },
          sunday: { start: '10:00', end: '14:00' }
        }
      },
      
      premiumCalculation: {
        enabled: true,
        baseRates: {},
        riskFactors: {
          locationMultipliers: {
            'accra': 1.2,
            'kumasi': 1.1,
            'tamale': 1.0,
            'cape_coast': 1.05,
            'rural': 0.9
          },
          ageFactors: {},
          seasonalAdjustments: {}
        }
      },
      
      knowledgeBase: {
        documentIds: [],
        categories: ['auto', 'health', 'life', 'business'],
        lastUpdated: new Date().toISOString()
      },
      
      analytics: {
        enabled: true
      },
      
      compliance: {
        dataRetentionDays: 365
      },
      
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Convert company config to profile
   */
  private configToProfile(config: CompanyConfig): CompanyProfile {
    return {
      id: config.id,
      name: config.name,
      displayName: config.displayName,
      businessType: config.businessType,
      status: config.status,
      logo: config.branding.logo,
      primaryColor: config.branding.primaryColor,
      contactPhone: config.contactInfo.phone,
      contactEmail: config.contactInfo.email,
      enabledPlatforms: Object.keys(config.platforms).filter(
        platform => config.platforms[platform as keyof typeof config.platforms]?.enabled
      ),
      createdAt: config.createdAt
    };
  }

  /**
   * Get manager status
   */
  getManagerStatus() {
    return {
      initialized: this.initialized,
      totalCompanies: this.companies.size,
      activeCompanies: Array.from(this.companies.values()).filter(c => c.status === 'active').length,
      configPath: this.configPath
    };
  }
}