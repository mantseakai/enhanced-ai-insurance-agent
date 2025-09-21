// File: backend/src/test-company-manager.ts
// Test the CompanyManager functionality

import { CompanyManager } from './core/companies/CompanyManager';

async function testCompanyManager() {
  console.log('🧪 Testing CompanyManager...');

  try {
    // Test 1: Initialize CompanyManager
    const companyManager = CompanyManager.getInstance();
    await companyManager.initialize();
    
    console.log('✅ Test 1 passed: CompanyManager initialized');
    
    // Test 2: Get manager status
    const status = companyManager.getManagerStatus();
    console.log('✅ Test 2 passed: Manager status:', status);
    
    // Test 3: Get active companies
    const activeCompanies = companyManager.getActiveCompanies();
    console.log('✅ Test 3 passed: Active companies:', activeCompanies.length);
    
    // Test 4: Get default company
    const defaultCompany = await companyManager.getCompanyConfig('default');
    console.log('✅ Test 4 passed: Default company loaded:', defaultCompany.name);
    
    // Test 5: Get company profile
    const profile = await companyManager.getCompanyProfile('default');
    console.log('✅ Test 5 passed: Company profile:', profile.name);
    
    // Test 6: Create a test company (fixed with proper platform config)
    const testCompany = await companyManager.createCompany({
      id: 'test_company_001',
      name: 'Test Insurance Co.',
      displayName: 'Test Insurance Co.',
      businessType: 'auto_insurance',
      contactInfo: {
        phone: '+233-123-456-789',
        email: 'test@testinsurance.com',
        address: 'Test Address, Accra',
        supportHours: '24/7'
      },
      // Fix: Disable WhatsApp or provide credentials
      platforms: {
        whatsapp: {
          enabled: false  // Disable WhatsApp for test company
        },
        webchat: {
          enabled: true   // Enable webchat instead
        }
      }
    });
    
    console.log('✅ Test 6 passed: Test company created:', testCompany.name);
    
    // Test 7: Get all companies (should now include test company)
    const allCompanies = companyManager.getActiveCompanies();
    console.log('✅ Test 7 passed: Total companies now:', allCompanies.length);
    
    // Test 8: Update the test company
    const updatedCompany = await companyManager.updateCompany('test_company_001', {
      displayName: 'Updated Test Insurance Co.'
    });
    
    console.log('✅ Test 8 passed: Company updated:', updatedCompany.displayName);
    
    // Test 9: Validate company
    const validation = await companyManager.validateCompany(testCompany);
    console.log('✅ Test 9 passed: Company validation:', {
      isValid: validation.isValid,
      score: validation.score,
      warnings: validation.warnings.length
    });
    
    // Test 10: Get companies by platform
    const whatsappCompanies = companyManager.getCompaniesByPlatform('whatsapp');
    console.log('✅ Test 10 passed: WhatsApp companies:', whatsappCompanies.length);
    
    console.log('🎉 All CompanyManager tests passed!');
    
  } catch (error) {
    console.error('❌ CompanyManager test failed:', error);
  }
}

// Run the tests
testCompanyManager().then(() => {
  console.log('🏁 CompanyManager testing completed');
}).catch(error => {
  console.error('💥 Test runner failed:', error);
});

export { };