// File: backend/src/platforms/PlatformManager.ts
// Central platform orchestration system

import { PlatformProvider } from './interfaces/PlatformInterface';
import { InstagramPlatform } from './instagram/InstagramPlatform';
import { CompanyManager } from '../core/companies/CompanyManager';
import { AIService } from '../services/AIService';
import { ContextBuilder, UnifiedQueryContext } from '../types/UnifiedContext';

export class PlatformManager {
  private static instance: PlatformManager;
   platforms: Map<string, PlatformProvider> = new Map();
  private companyManager: CompanyManager;
  private aiService: AIService;
  private initialized: boolean = false;

  constructor() {
    this.companyManager = CompanyManager.getInstance();
    this.aiService = AIService.getInstance();
  }

  public static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager();
    }
    return PlatformManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Platform Manager...');

      // Register available platforms
      this.platforms.set('instagram', new InstagramPlatform());
      // TODO: Add Facebook, Telegram, TikTok platforms

      // Initialize platforms for each company
      const companies = this.companyManager.getActiveCompanies();
      
      for (const company of companies) {
        await this.initializePlatformsForCompany(company.id);
      }

      this.initialized = true;
      console.log('✅ Platform Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Platform Manager:', error);
      throw error;
    }
  }

  async initializePlatformsForCompany(companyId: string): Promise<void> {
    try {
      const company = await this.companyManager.getCompanyConfig(companyId);
      if (!company) {
        throw new Error(`Company ${companyId} not found`);
      }

      console.log(`🏢 Initializing platforms for company: ${company.name}`);

      // Initialize Instagram if enabled
      if (company.platforms.instagram?.enabled) {
        const instagramPlatform = this.platforms.get('instagram');
        if (instagramPlatform) {
          await instagramPlatform.initialize(company.platforms.instagram);
          console.log(`✅ Instagram initialized for ${company.name}`);
        }
      }

      // TODO: Initialize other platforms (Facebook, Telegram, etc.)

    } catch (error) {
      console.error(`❌ Failed to initialize platforms for company ${companyId}:`, error);
      throw error;
    }
  }

  async processIncomingMessage(platform: string, webhookData: any): Promise<void> {
    try {
      const platformProvider = this.platforms.get(platform);
      if (!platformProvider) {
        throw new Error(`Platform ${platform} not found`);
      }

      // Process webhook data
      const messageData = await platformProvider.handleWebhook(webhookData);
      if (!messageData) {
        console.log('📝 No actionable messages in webhook');
        return;
      }

      // Process each message with AI service
      for (const message of messageData.messages) {
        await this.processMessage(messageData.platform, messageData.companyId, message);
      }

    } catch (error) {
      console.error('❌ Error processing incoming message:', error);
      throw error;
    }
  }

  private async processMessage(platform: string, companyId: string, message: any): Promise<void> {
    try {
      // Build unified context
      const context = ContextBuilder
        .forPlatform(platform, companyId, message.senderId, message.id)
        .withUser(message.senderId)
        .withMessage(message.content, message.type)
        .withMetadata(message.metadata || {})
        .build();

      // Process with AI service
      const aiResponse = await this.aiService.processMessage(
        message.content,
        message.senderId,
        context,
        companyId
      );

      // Send response back through platform
      const platformProvider = this.platforms.get(platform);
      if (platformProvider) {
        await platformProvider.sendMessage(
          message.senderId,
          aiResponse.message,
          companyId
        );
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      throw error;
    }
  }

  getPlatformStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, platform] of this.platforms) {
      stats[name] = {
        initialized: platform.isInitialized(),
        features: platform.supportedFeatures,
        stats: platform.getStats()
      };
    }

    return stats;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}