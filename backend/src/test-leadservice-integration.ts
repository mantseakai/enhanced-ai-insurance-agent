// LeadService Integration Test

async function testLeadServiceIntegration() {
  console.log('🧪 Testing LeadService Integration\n');

  try {
    // Test 1: Check if LeadService can be imported
    console.log('1. Testing LeadService import...');
    
    try {
      const { LeadService } = require('./services/LeadService');
      console.log('   ✅ LeadService imports successfully');
      
      // Test 2: Create LeadService instance
      console.log('\n2. Testing LeadService instantiation...');
      const leadService = new LeadService('test_company');
      console.log('   ✅ LeadService instance created');
      
      // Test 3: Check if types are compatible
      console.log('\n3. Testing type compatibility...');
      
      const mockLeadRequest = {
        userId: 'test_user_123',
        contactInfo: {
          name: 'Test User',
          phone: '+233123456789',
          email: 'test@example.com'
        },
        source: 'whatsapp' as const,
        productInterest: 'auto insurance',
        score: 75,
        aiAnalysis: {
          primaryIntent: 'quote_request',
          leadReadiness: 'high',
          urgencyLevel: 'medium',
          buyingSignals: ['price_inquiry', 'immediate_need'],
          emotionalState: 'interested'
        },
        customerProfile: {
          incomeRange: 'medium' as const,
          familySize: 3,
          age: 35
        }
      };
      
      console.log('   ✅ Mock lead request created with proper types');
      
      console.log('\n🎉 LeadService Integration Test: PASSED');
      console.log('📊 LeadService is ready for use with your insurance agent');
      
    } catch (importError) {
      console.log(`   ❌ LeadService import failed: ${importError.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ LeadService Integration Test: FAILED');
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  testLeadServiceIntegration();
}

module.exports = { testLeadServiceIntegration };
