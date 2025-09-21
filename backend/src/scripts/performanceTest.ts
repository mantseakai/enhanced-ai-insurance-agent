// File: backend/src/scripts/performanceTest.ts

import dotenv from 'dotenv';
import path from 'path';
import { AIService } from '../services/AIService';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Quick performance test to verify optimizations
 */
class PerformanceTest {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  async runPerformanceTest(): Promise<void> {
    console.log('⚡ Running performance test with optimizations...\n');

    try {
      // Initialize AI Service
      console.log('🚀 Initializing AI Service...');
      const initStart = Date.now();
      await this.aiService.initialize();
      const initTime = Date.now() - initStart;
      console.log(`✅ Initialization: ${initTime}ms\n`);

      // Test queries for performance
      const testQueries = [
        {
          message: "I need auto insurance for my Toyota Camry",
          userId: "perf_test_1",
          context: { leadSource: 'whatsapp', productType: 'auto' }
        },
        {
          message: "How much does comprehensive coverage cost?",
          userId: "perf_test_2",
          context: { leadSource: 'web_chat', budget: 'medium' }
        },
        {
          message: "Can I pay with MTN MoMo?",
          userId: "perf_test_3",
          context: { leadSource: 'whatsapp', stage: 'quote' }
        }
      ];

      let totalTime = 0;
      let fastestTime = Infinity;
      let slowestTime = 0;

      console.log('🏃‍♂️ Running performance tests...\n');

      for (let i = 0; i < testQueries.length; i++) {
        const test = testQueries[i];
        console.log(`Test ${i + 1}: "${test.message}"`);

        const startTime = Date.now();
        const response = await this.aiService.processMessage(
          test.message,
          test.userId,
          test.context
        );
        const responseTime = Date.now() - startTime;

        totalTime += responseTime;
        fastestTime = Math.min(fastestTime, responseTime);
        slowestTime = Math.max(slowestTime, responseTime);

        console.log(`⏱️  Response time: ${responseTime}ms`);
        console.log(`📊 Confidence: ${response.confidence.toFixed(2)}`);
        console.log(`📝 Preview: "${response.message.substring(0, 60)}..."`);
        console.log('');
      }

      // Test cache performance (second run should be faster)
      console.log('🔄 Testing cache performance (repeat queries)...\n');
      
      const cacheTestStart = Date.now();
      for (const test of testQueries) {
        await this.aiService.processMessage(
          test.message,
          test.userId + '_cache',
          test.context
        );
      }
      const cacheTestTime = Date.now() - cacheTestStart;

      // Performance summary
      const avgTime = totalTime / testQueries.length;
      
      console.log('📊 Performance Summary:');
      console.log(`   Average response time: ${avgTime.toFixed(0)}ms`);
      console.log(`   Fastest response: ${fastestTime}ms`);
      console.log(`   Slowest response: ${slowestTime}ms`);
      console.log(`   Cache test (3 queries): ${cacheTestTime}ms`);
      console.log(`   Cache improvement: ${((totalTime - cacheTestTime) / totalTime * 100).toFixed(1)}%`);

      // Performance ratings
      console.log('\n🏆 Performance Rating:');
      if (avgTime < 3000) {
        console.log('   🟢 EXCELLENT: Under 3 seconds average');
      } else if (avgTime < 5000) {
        console.log('   🟡 GOOD: 3-5 seconds average');
      } else if (avgTime < 8000) {
        console.log('   🟠 ACCEPTABLE: 5-8 seconds average');
      } else {
        console.log('   🔴 NEEDS IMPROVEMENT: Over 8 seconds average');
      }

      // Get performance analytics
      const analytics = this.aiService.getPerformanceAnalytics();
      console.log('\n📈 System Analytics:');
      console.log(JSON.stringify(analytics, null, 2));

    } catch (error) {
      console.error('❌ Performance test failed:', error);
      throw error;
    }
  }

  async stressTest(): Promise<void> {
    console.log('\n💪 Running stress test (10 concurrent queries)...\n');

    const stressQueries = Array.from({ length: 10 }, (_, i) => ({
      message: `Query ${i + 1}: I need insurance information`,
      userId: `stress_user_${i + 1}`,
      context: { leadSource: 'api_test' }
    }));

    const startTime = Date.now();
    
    try {
      // Run all queries concurrently
      const promises = stressQueries.map(query =>
        this.aiService.processMessage(query.message, query.userId, query.context)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      console.log(`✅ Processed ${results.length} concurrent queries in ${totalTime}ms`);
      console.log(`📊 Average per query: ${(totalTime / results.length).toFixed(0)}ms`);
      console.log(`🚀 Throughput: ${(results.length / (totalTime / 1000)).toFixed(1)} queries/second`);

      // Check for failures
      const failures = results.filter(r => r.confidence < 0.3);
      if (failures.length > 0) {
        console.log(`⚠️  ${failures.length} queries had low confidence (<0.3)`);
      } else {
        console.log('✅ All queries processed successfully');
      }

    } catch (error) {
      console.error('❌ Stress test failed:', error);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PerformanceTest();
  
  tester.runPerformanceTest()
    .then(() => tester.stressTest())
    .then(() => {
      console.log('\n🎉 Performance testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Performance testing failed:', error);
      process.exit(1);
    });
}

export { PerformanceTest };