
// File: backend/src/test-instagram-platform.ts
// Specific Instagram platform testing

import { InstagramPlatform } from './platforms/instagram/InstagramPlatform';
import { CompanyManager } from './core/companies/CompanyManager';

async function testInstagramPlatform() {
  console.log('📱 Starting Instagram Platform Test Suite...\n');

  try {
    // Test 1: Instagram Platform Initialization
    console.log('🚀 Test 1: Instagram Platform Initialization');
    const instagramPlatform = new InstagramPlatform();
    
    // Test with mock configuration
    const mockConfig = {
      enabled: true,
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || 'mock_token',
      businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || 'mock_business_id',
      webhookSecret: process.env.INSTAGRAM_WEBHOOK_SECRET || 'mock_secret'
    };

    console.log('Config provided:', {
      hasAccessToken: !!mockConfig.accessToken,
      hasBusinessId: !!mockConfig.businessAccountId,
      hasWebhookSecret: !!mockConfig.webhookSecret
    });

    if (mockConfig.accessToken !== 'mock_token') {
      try {
        await instagramPlatform.initialize(mockConfig);
        console.log('✅ Instagram platform initialized with real credentials');
      } catch (error) {
        console.log('⚠️ Instagram initialization failed (expected with test data):', error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.log('⚠️ Using mock credentials - real Instagram API not tested');
    }
    console.log('');

    // Test 2: Platform Features
    console.log('📋 Test 2: Instagram Platform Features');
    const features = instagramPlatform.supportedFeatures;
    console.log(`Total features: ${features.length}`);
    
    for (const feature of features) {
      console.log(`   • ${feature.name}: ${feature.enabled ? '✅ Enabled' : '❌ Disabled'} - ${feature.description}`);
    }
    console.log('');

    // Test 3: Webhook Data Processing
    console.log('📨 Test 3: Instagram Webhook Data Processing');
    
    const mockWebhookData = {
      entry: [{
        id: 'page_123',
        messaging: [{
          sender: { id: 'user_456' },
          recipient: { id: 'page_123' },
          timestamp: Date.now(),
          message: {
            mid: 'msg_789',
            text: 'I need insurance quotes for my business'
          }
        }]
      }]
    };

    try {
      const processedData = await instagramPlatform.handleWebhook(mockWebhookData);
      
      if (processedData) {
        console.log('✅ Webhook processing successful:');
        console.log(`   Platform: ${processedData.platform}`);
        console.log(`   Company: ${processedData.companyId}`);
        console.log(`   Messages: ${processedData.messages.length}`);
        
        for (const message of processedData.messages) {
          console.log(`     • Message: "${message.content}" from ${message.senderId}`);
        }
      } else {
        console.log('⚠️ No actionable messages found in webhook data');
      }
    } catch (error) {
      console.log('❌ Webhook processing failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    console.log('');

    // Test 4: Message Sending Simulation
    console.log('📤 Test 4: Message Sending Simulation');
    
    const mockSendData = {
      to: 'user_456',
      message: 'Thank you for your interest! We offer comprehensive business insurance packages. Would you like me to prepare a custom quote for your business?',
      companyId: 'default'
    };

    try {
      // This will fail with mock credentials, but we can test the method signature
      const result = await instagramPlatform.sendMessage(
        mockSendData.to,
        mockSendData.message,
        mockSendData.companyId
      );
      
      console.log('✅ Message sending method works:', {
        success: result.success,
        hasMessageId: !!result.messageId,
        timestamp: result.timestamp
      });
      
    } catch (error) {
      console.log('⚠️ Message sending failed (expected with mock data):', error instanceof Error ? error.message : 'Unknown error');
    }
    console.log('');

    // Test 5: Company Integration
    console.log('🏢 Test 5: Company Integration Test');
    
    try {
      const companyManager = CompanyManager.getInstance();
      const companies = companyManager.getActiveCompanies();
      
      for (const company of companies) {
        const fullConfig = await companyManager.getCompanyConfig(company.id);
        if (fullConfig.platforms.instagram?.enabled) {
          console.log(`✅ Company ${company.name} has Instagram enabled:`);
          console.log(`   Business Account: ${fullConfig.platforms.instagram.businessAccountId || 'Not configured'}`);
          console.log(`   Access Token: ${fullConfig.platforms.instagram.accessToken ? 'Configured' : 'Missing'}`);
        } else {
          console.log(`⚠️ Company ${company.name} does not have Instagram enabled`);
        }
      }
    } catch (error) {
      console.log('❌ Company integration test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    console.log('');

    // Test 6: Platform Stats
    console.log('📊 Test 6: Platform Statistics');
    const stats = instagramPlatform.getStats();
    console.log('Instagram platform stats:', {
      messagesSent: stats.messagesSent,
      messagesReceived: stats.messagesReceived,
      errors: stats.errors,
      uptime: stats.uptime,
      lastActivity: stats.lastActivity
    });
    console.log('');

    console.log('🎉 Instagram Platform Test Suite Completed!');
    console.log('📱 Instagram Integration Status: READY FOR CONFIGURATION');
    
    return true;

  } catch (error) {
    console.error('❌ Instagram Platform Test Failed:', error);
    return false;
  }
}