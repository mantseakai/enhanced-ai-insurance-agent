// File: backend/src/platforms/instagram/InstagramPlatform.ts
// Instagram Business API implementation

import { PlatformProvider, PlatformConfig, PlatformMessage, PlatformWebhookData, MessageResponse, PlatformFeature, PlatformStats } from '../interfaces/PlatformInterface';
import { CompanyManager } from '../../core/companies/CompanyManager';
import { UnifiedQueryContext, ContextBuilder } from '../../types/UnifiedContext';
import crypto from 'crypto';

export class InstagramPlatform implements PlatformProvider {
  name = 'instagram';
  private config: PlatformConfig | null = null;
  private companyManager: CompanyManager;
  private stats: PlatformStats;
  
  supportedFeatures: PlatformFeature[] = [
    { name: 'direct_messages', enabled: true, description: 'Send and receive direct messages' },
    { name: 'story_mentions', enabled: true, description: 'Respond to story mentions' },
    { name: 'story_replies', enabled: true, description: 'Reply to story comments' },
    { name: 'rich_media', enabled: true, description: 'Send images and videos' },
    { name: 'quick_replies', enabled: true, description: 'Interactive quick reply buttons' },
    { name: 'lead_forms', enabled: false, description: 'Instagram lead generation forms' }
  ];

  constructor() {
    this.companyManager = CompanyManager.getInstance();
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      lastActivity: new Date().toISOString(),
      errors: 0,
      uptime: 100
    };
  }

  async initialize(config: PlatformConfig): Promise<void> {
    try {
      console.log('🚀 Initializing Instagram Business Platform...');
      
      if (!config.accessToken) {
        throw new Error('Instagram access token is required');
      }
      
      if (!config.businessAccountId) {
        throw new Error('Instagram business account ID is required');
      }

      this.config = config;
      
      // Verify Instagram Business API access
      await this.verifyBusinessAccount();
      
      console.log('✅ Instagram Business Platform initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Instagram Platform:', error);
      this.stats.errors++;
      throw error;
    }
  }

  async sendMessage(to: string, message: string, companyId: string): Promise<MessageResponse> {
    try {
      if (!this.config?.accessToken || !this.config?.businessAccountId) {
        throw new Error('Instagram platform not properly configured');
      }

      // Get company context for branding
      const company = await this.companyManager.getCompanyConfig(companyId);
      if (!company) {
        throw new Error(`Company ${companyId} not found`);
      }

      // Apply company branding to message
      const brandedMessage = this.applyCompanyBranding(message, company);

      // Send message via Instagram Business API
      const response = await fetch(`https://graph.facebook.com/v18.0/${this.config.businessAccountId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: to },
          message: { text: brandedMessage },
          messaging_type: 'RESPONSE', // or 'UPDATE' for promotional messages
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(`Instagram API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json() as any;
      
      this.stats.messagesSent++;
      this.stats.lastActivity = new Date().toISOString();

      return {
        success: true,
        messageId: result.message_id,
        timestamp: new Date().toISOString(),
        cost: 0.01 // Estimated cost per message
      };

    } catch (error) {
      console.error('❌ Failed to send Instagram message:', error);
      this.stats.errors++;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleWebhook(data: any): Promise<PlatformWebhookData | null> {
    try {
      console.log('📨 Processing Instagram webhook:', JSON.stringify(data, null, 2));

      // Handle webhook verification
      if (data['hub.mode'] === 'subscribe' && data['hub.verify_token']) {
        return null; // Verification handled separately
      }

      // Process Instagram messages
      if (data.entry && Array.isArray(data.entry)) {
        const messages: PlatformMessage[] = [];
        let companyId = 'default'; // Default fallback

        for (const entry of data.entry) {
          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const messagingEvent of entry.messaging) {
              
              // Extract message data
              if (messagingEvent.message && messagingEvent.message.text) {
                const message: PlatformMessage = {
                  id: messagingEvent.message.mid,
                  content: messagingEvent.message.text,
                  senderId: messagingEvent.sender.id,
                  timestamp: new Date(messagingEvent.timestamp).toISOString(),
                  type: 'text',
                  metadata: {
                    platform: 'instagram',
                    recipientId: messagingEvent.recipient.id,
                    messageType: 'message'
                  }
                };

                messages.push(message);

                // Try to determine company from Instagram account
                companyId = await this.determineCompanyFromInstagram(
                  messagingEvent.recipient.id,
                  messagingEvent.message.text
                );
              }

              // Handle story mentions
              if (messagingEvent.message && messagingEvent.message.attachments) {
                for (const attachment of messagingEvent.message.attachments) {
                  if (attachment.type === 'story_mention') {
                    const message: PlatformMessage = {
                      id: messagingEvent.message.mid,
                      content: `Story mention: ${attachment.payload.url}`,
                      senderId: messagingEvent.sender.id,
                      timestamp: new Date(messagingEvent.timestamp).toISOString(),
                      type: 'image',
                      metadata: {
                        platform: 'instagram',
                        messageType: 'story_mention',
                        storyUrl: attachment.payload.url
                      }
                    };

                    messages.push(message);
                  }
                }
              }
            }
          }
        }

        this.stats.messagesReceived += messages.length;
        this.stats.lastActivity = new Date().toISOString();

        if (messages.length > 0) {
          return {
            platform: 'instagram',
            companyId,
            messages,
            rawData: data
          };
        }
      }

      return null;

    } catch (error) {
      console.error('❌ Error processing Instagram webhook:', error);
      this.stats.errors++;
      throw error;
    }
  }

  validateWebhook(signature: string, body: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('❌ Instagram webhook validation error:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.config !== null && !!this.config.accessToken && !!this.config.businessAccountId;
  }

  getStats(): PlatformStats {
    return { ...this.stats };
  }

  // Private helper methods
  private async verifyBusinessAccount(): Promise<void> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.config!.businessAccountId}?fields=id,username,name&access_token=${this.config!.accessToken}`
      );

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(`Instagram Business account verification failed: ${errorData.error?.message}`);
      }

      const accountInfo = await response.json() as any;
      console.log('✅ Instagram Business account verified:', accountInfo.username);
      
    } catch (error) {
      throw new Error(`Instagram Business account verification failed: ${error}`);
    }
  }

  private applyCompanyBranding(message: string, company: any): string {
    // Apply company-specific branding to messages
    let brandedMessage = message;

    // Add company signature if configured
    if (company.branding?.messageSignature) {
      brandedMessage += `\n\n${company.branding.messageSignature}`;
    }

    // Add company contact info for important messages
    if (message.toLowerCase().includes('quote') || message.toLowerCase().includes('policy')) {
      brandedMessage += `\n\n📞 ${company.contactInfo.phone}`;
      brandedMessage += `\n🌐 ${company.contactInfo.website || 'Contact us for more info'}`;
    }

    return brandedMessage;
  }

  private async determineCompanyFromInstagram(recipientId: string, messageContent: string): Promise<string> {
    try {
      // Strategy 1: Check if company is mentioned in message
      const companies = this.companyManager.getActiveCompanies();
      for (const company of companies) {
        if (messageContent.toLowerCase().includes(company.name.toLowerCase())) {
          console.log(`🎯 Company detected from Instagram message: ${company.id}`);
          return company.id;
        }
      }

      // Strategy 2: Map Instagram business account to company
      for (const company of companies) {

        const companyConfig = await this.companyManager.getCompanyConfig(company.id);
        if (companyConfig.platforms.instagram?.businessAccountId === recipientId) {
          console.log(`📱 Company detected from Instagram account mapping: ${company.id}`);
          return company.id;
        }
      }

      // Strategy 3: Use default company
      console.log('🔄 Using default company for Instagram message');
      return 'default';

    } catch (error) {
      console.error('❌ Error determining company from Instagram:', error);
      return 'default';
    }
  }
}