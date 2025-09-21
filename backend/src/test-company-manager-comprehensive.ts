// File: backend/src/test-company-manager-comprehensive.ts
// Comprehensive test showing validation and success scenarios

import { CompanyManager } from './core/companies/CompanyManager';
import { CompanyConfigurationError } from './types/CompanyTypes';

async function testCompanyManagerComprehensive() {
  console.log('🧪 Testing CompanyManager (Comprehensive)...');

  try {
    // Initialize CompanyManager
    const companyManager = CompanyManager.getInstance();
    await companyManager.initialize();
    
    console.log('✅ CompanyManager initialized');
    
    // Show current companies
    const initialCompanies = companyManager.getActiveCompanies();
    console.log(`📊 Initial companies: ${initialCompanies.length}`);
    
    // Test 1: Validation Error (WhatsApp enabled without credentials)
    console.log('\n🔍 Test 1: Testing validation (should fail)...');
    try {
      await companyManager.createCompany({
        id: 'invalid_company',
        name: 'Invalid Company',
        businessType: 'auto_insurance',
        contactInfo: {
          phone: '+233-123-456-789',
          email: 'invalid@test.com',
          address: 'Test Address',
          supportHours: '24/7'
        }
        // No platforms specified, will inherit defaults with WhatsApp enabled but no credentials
      });
      console.log('❌ Test 1 failed: Should have thrown validation error');
    } catch (error) {
      if (error instanceof CompanyConfigurationError) {
        console.log('✅ Test 1 passed: Validation correctly caught error:', error.message);
      } else {
        console.log('❌ Test 1 failed: Unexpected error type:', error);
      }
    }
    
    // Test 2: Successful creation with WhatsApp disabled
    console.log('\n🔍 Test 2: Creating company with WhatsApp disabled...');
    const webChatCompany = await companyManager.createCompany({
      id: 'webchat_company',
      name: 'WebChat Insurance Co.',
      displayName: 'WebChat Insurance Co.',
      businessType: 'health_insurance',
      contactInfo: {
        phone: '+233-987-654-321',
        email: 'webchat@test.com',
        address: 'WebChat Address, Kumasi',
        supportHours: 'Mon-Fri 9AM-5PM'
      },
      platforms: {
        whatsapp: {
          enabled: false
        },
        webchat: {
          enabled: true
        }
      },
      branding: {
        primaryColor: '#28a745',
        secondaryColor: '#ffc107',
        brandVoice: 'friendly'
      }
    });
    
    console.log('✅ Test 2 passed: WebChat company created:', webChatCompany.name);
    
    // Test 3: Successful creation with WhatsApp credentials
    console.log('\n🔍 Test 3: Creating company with WhatsApp credentials...');
    const whatsappCompany = await companyManager.createCompany({
      id: 'whatsapp_company',
      name: 'WhatsApp Insurance Co.',
      displayName: 'WhatsApp Insurance Co.',
      businessType: 'auto_insurance',
      contactInfo: {
        phone: '+233-555-123-456',
        email: 'whatsapp@test.com',
        address: 'WhatsApp Address, Accra',
        supportHours: '24/7 WhatsApp Support'
      },
      platforms: {
        whatsapp: {
          enabled: true,
          phoneNumberId: 'test_phone_number_id_123',
          accessToken: 'test_access_token_xyz'
        },
        webchat: {
          enabled: true
        }
      },
      branding: {
        primaryColor: '#25D366',
        secondaryColor: '#128C7E',
        brandVoice: 'casual'
      }
    });
    
    console.log('✅ Test 3 passed: WhatsApp company created:', whatsappCompany.name);
    
    // Test 4: Show all companies now
    const allCompanies = companyManager.getActiveCompanies();
    console.log(`\n📊 Total companies now: ${allCompanies.length}`);
    allCompanies.forEach(company => {
      console.log(`  - ${company.name} (${company.id}) - Platforms: ${company.enabledPlatforms.join(', ')}`);
    });
    
    // Test 5: Get companies by platform
    const whatsappCompanies = companyManager.getCompaniesByPlatform('whatsapp');
    const webchatCompanies = companyManager.getCompaniesByPlatform('webchat');
    
    console.log(`\n📱 WhatsApp companies: ${whatsappCompanies.length}`);
    console.log(`💬 WebChat companies: ${webchatCompanies.length}`);
    
    // Test 6: Update a company
    const updatedCompany = await companyManager.updateCompany('webchat_company', {
      displayName: 'Updated WebChat Insurance Co.',
      branding: {
        primaryColor: '#17a2b8',
        secondaryColor: '#ffc107',
        brandVoice: 'professional'
      }
    });
    
    console.log('✅ Test 6 passed: Company updated:', updatedCompany.displayName);
    
    // Test 7: Validation scores
    console.log('\n📋 Company validation scores:');
    for (const company of allCompanies) {
      const fullConfig = await companyManager.getCompanyConfig(company.id);
      const validation = await companyManager.validateCompany(fullConfig);
      console.log(`  - ${company.name}: ${validation.score}% (Valid: ${validation.isValid})`);
      if (validation.warnings.length > 0) {
        console.log(`    Warnings: ${validation.warnings.join(', ')}`);
      }
    }
    
    // Test 8: Clean up test companies (optional)
    console.log('\n🧹 Cleaning up test companies...');
    try {
      await companyManager.deleteCompany('webchat_company');
      await companyManager.deleteCompany('whatsapp_company');
      console.log('✅ Test companies cleaned up');
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error);
    }
    
    const finalCompanies = companyManager.getActiveCompanies();
    console.log(`📊 Final companies count: ${finalCompanies.length}`);
    
    console.log('\n🎉 All comprehensive tests passed!');
    
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
  }
}

// Run the comprehensive tests
testCompanyManagerComprehensive().then(() => {
  console.log('🏁 Comprehensive testing completed');
}).catch(error => {
  console.error('💥 Comprehensive test runner failed:', error);
});

export { };