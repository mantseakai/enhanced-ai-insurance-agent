// File: backend/src/test-phase2.ts
// Test the current Phase 2 setup

import { UnifiedQueryContext, ContextBuilder } from './types/UnifiedContext';
import { CompanyConfig } from './types/CompanyTypes';

console.log('🧪 Testing Phase 2 Setup...');

// Test 1: UnifiedQueryContext works
try {
  const context: UnifiedQueryContext = {
    companyId: 'test_company',
    userId: 'test_user',
    platform: 'whatsapp',
    conversationStage: 'greeting'
  };
  
  console.log('✅ Test 1 passed: UnifiedQueryContext created', context);
} catch (error) {
  console.error('❌ Test 1 failed:', error);
}

// Test 2: ContextBuilder works
try {
  const builderContext = ContextBuilder
    .forWhatsApp('ghana_insurance_co', 'user123', 'msg001')
    .withUser('user123', 'John Doe')
    .withInsurance('auto', 'high')
    .build();
  
  console.log('✅ Test 2 passed: ContextBuilder works', builderContext);
} catch (error) {
  console.error('❌ Test 2 failed:', error);
}

// Test 3: CompanyConfig type works
try {
  const companyConfig: Partial<CompanyConfig> = {
    id: 'test_company',
    name: 'Test Insurance Co.',
    businessType: 'auto_insurance',
    branding: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      brandVoice: 'professional'
    }
  };
  
  console.log('✅ Test 3 passed: CompanyConfig type works', companyConfig);
} catch (error) {
  console.error('❌ Test 3 failed:', error);
}

// Test 4: Check if companies.json can be imported
try {
  const fs = require('fs');
  const path = require('path');
  
  const configPath = path.join(__dirname, 'config', 'companies.json');
  if (fs.existsSync(configPath)) {
    const companiesData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Test 4 passed: companies.json loaded', companiesData.companies?.[0]?.name);
  } else {
    console.log('⚠️ Test 4 warning: companies.json not found at', configPath);
  }
} catch (error) {
  console.error('❌ Test 4 failed:', error);
}

console.log('🎯 Phase 2 setup tests completed!');

export { };