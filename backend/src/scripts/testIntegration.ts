// File: backend/src/scripts/testIntegration.ts

import dotenv from 'dotenv';
import path from 'path';
import { AIService } from '../services/AIService';
import { VectorStoreManager } from '../core/vector/managers/VectorStoreManager';
import { platform } from 'os';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Test script to verify the new vector store integration works properly
 */
class IntegrationTester {
  private aiService: AIService;
  private vectorManager: VectorStoreManager;

  constructor() {
    this.aiService =  new AIService();
    this.vectorManager = VectorStoreManager.getInstance();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting integration tests...\n');

    try {
      await this.testVectorStoreConnection();
      await this.testKnowledgeSearch();
      await this.testAIServiceIntegration();
      await this.testWhatsAppScenario();
      
      console.log('\n✅ All integration tests passed!');
      
    } catch (error) {
      console.error('\n❌ Integration tests failed:', error);
      throw error;
    }
  }

  private async testVectorStoreConnection(): Promise<void> {
    console.log('1️⃣ Testing vector store connection...');
    
    const vectorStore = await this.vectorManager.initialize();
    
    if (!vectorStore.isInitialized) {
      throw new Error('Vector store failed to initialize');
    }
    
    const stats = await vectorStore.getStats();
    console.log(`   ✅ Connected to ${vectorStore.name}`);
    console.log(`   📊 Documents: ${stats.documentCount}`);
    console.log(`   💾 Index size: ${stats.indexSize}`);
  }

  private async testKnowledgeSearch(): Promise<void> {
    console.log('\n2️⃣ Testing knowledge search functionality...');
    
    const vectorStore = this.vectorManager.getActiveProvider();
    
    const testQueries = [
      'auto insurance Ghana',
      'health insurance NHIS',
      'premium calculation',
      'mobile money payment'
    ];

    for (const query of testQueries) {
      const results = await vectorStore.searchByText(query, 3);
      
      if (results.length === 0) {
        console.warn(`   ⚠️  No results for "${query}"`);
      } else {
        console.log(`   ✅ "${query}": ${results.length} results (top score: ${results[0].score.toFixed(3)})`);
      }
    }
  }

  private async testAIServiceIntegration(): Promise<void> {
    console.log('\n3️⃣ Testing AI Service integration...');
    
    await this.aiService.initialize();
    
    const testMessages = [
      {
        message: "I need auto insurance for my car in Accra",
        userId: "test_user_1",
        context: { platform: 'web_chat', insuranceType: 'auto' }
      },
      {
        message: "How much does health insurance cost?",
        userId: "test_user_2", 
        context: { platform: 'whatsapp', urgency: 'medium' }
      },
      {
        message: "I want to make a claim",
        userId: "test_user_3",
        context: { platform: 'whatsapp', conversationStage: 'information_gathering' }
      }
    ] as any;

    for (const test of testMessages) {
      console.log(`   🔍 Testing: "${test.message}"`);
      
      const response = await this.aiService.processMessage(
        test.message,
        test.userId,
        test.context
      );
      
      if (!response.message || response.message.length < 10) {
        throw new Error(`Invalid response for "${test.message}"`);
      }
      
      console.log(`   ✅ Response generated (confidence: ${response.confidence.toFixed(2)})`);
      console.log(`   📝 Preview: "${response.message.substring(0, 80)}..."`);
    }
  }

  private async testWhatsAppScenario(): Promise<void> {
    console.log('\n4️⃣ Testing WhatsApp scenario simulation...');
    
    // Simulate a typical WhatsApp conversation flow
    const whatsappUser = "whatsapp_test_user";
    const conversationFlow = [
      {
        message: "Hello, I saw your QR code at the mall. I need car insurance",
        expectedIntent: "information"
      },
      {
        message: "How much would it cost for a 2019 Toyota Camry?",
        expectedIntent: "quote"
      },
      {
        message: "Can I pay with MTN MoMo?",
        expectedIntent: "information"
      },
      {
        message: "Yes, I want to buy this insurance",
        expectedIntent: "purchase"
      }
    ];

    for (let i = 0; i < conversationFlow.length; i++) {
      const step = conversationFlow[i];
      console.log(`   Step ${i + 1}: "${step.message}"`);
      
      const response = await this.aiService.processMessage(
        step.message,
        whatsappUser,
        { 
          platform: 'whatsapp'
        }
      );
      
      console.log(`   ✅ Response: ${response.message.substring(0, 60)}...`);
      console.log(`   📊 Lead Score: ${response.leadScore}/10`);
      
      // Check if lead scoring is working
      if (i === conversationFlow.length - 1 && (!response.shouldCaptureLead || !response.leadScore || response.leadScore < 7)) {
        console.warn(`   ⚠️  Expected high lead score for purchase intent, got ${response.leadScore}`);
      }
    }
  }

  async testPerformance(): Promise<void> {
    console.log('\n5️⃣ Testing performance...');
    
    const startTime = Date.now();
    const testQuery = "comprehensive auto insurance coverage Ghana";
    
    // Test vector search performance
    const vectorStore = this.vectorManager.getActiveProvider();
    const searchStart = Date.now();
    const searchResults = await vectorStore.searchByText(testQuery, 5);
    const searchTime = Date.now() - searchStart;
    
    // Test AI response performance
    const aiStart = Date.now();
    const aiResponse = await this.aiService.processMessage(
      testQuery,
      "performance_test_user",
      { platform: 'webchat' }
    );
    const aiTime = Date.now() - aiStart;
    
    const totalTime = Date.now() - startTime;
    
    console.log(`   ⚡ Vector search: ${searchTime}ms`);
    console.log(`   🤖 AI response: ${aiTime}ms`);
    console.log(`   ⏱️  Total time: ${totalTime}ms`);
    
    // Performance thresholds
    if (searchTime > 2000) {
      console.warn(`   ⚠️  Vector search is slow (${searchTime}ms > 2000ms)`);
    }
    if (aiTime > 5000) {
      console.warn(`   ⚠️  AI response is slow (${aiTime}ms > 5000ms)`);
    }
    if (totalTime < 1000) {
      console.log(`   🚀 Excellent performance!`);
    }
  }

  async generateHealthReport(): Promise<void> {
    console.log('\n📋 Generating system health report...');
    
    const analytics = this.aiService.getPerformanceAnalytics();
    const vectorStore = this.vectorManager.getActiveProvider();
    const stats = await vectorStore.getStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      vectorStore: {
        provider: vectorStore.name,
        initialized: vectorStore.isInitialized,
        documentCount: stats.documentCount,
        indexSize: stats.indexSize
      },
      aiService: {
        mode: analytics.mode,
        conversations: analytics.conversations
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vectorProvider: process.env.VECTOR_STORE_PROVIDER,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasPinecone: !!process.env.PINECONE_API_KEY
      }
    };
    
    console.log('\n📊 System Health Report:');
    console.log(JSON.stringify(report, null, 2));
    
    // Health checks
    const healthIssues = [];
    
    if (!report.vectorStore.initialized) {
      healthIssues.push('Vector store not initialized');
    }
    if (report.vectorStore.documentCount === 0) {
      healthIssues.push('No documents in knowledge base');
    }
    if (!report.environment.hasOpenAI) {
      healthIssues.push('OpenAI API key missing');
    }
    if (!report.environment.hasPinecone) {
      healthIssues.push('Pinecone API key missing');
    }
    
    if (healthIssues.length > 0) {
      console.log('\n⚠️  Health Issues Found:');
      healthIssues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('\n✅ System is healthy!');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new IntegrationTester();
  
  tester.runAllTests()
    .then(() => tester.testPerformance())
    .then(() => tester.generateHealthReport())
    .then(() => {
      console.log('\n🎉 Integration testing completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Integration testing failed:', error);
      process.exit(1);
    });
}

export { IntegrationTester };