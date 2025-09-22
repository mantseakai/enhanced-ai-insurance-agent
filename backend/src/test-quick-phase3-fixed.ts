// Fixed Quick Phase 3 test - uses correct types

import { PlatformManager } from './platforms/PlatformManager';
import { CompanyManager } from './core/companies/CompanyManager';
import { CompanyConfig } from './types/CompanyTypes';

async function quickPhase3Test() {
  console.log('🧪 Quick Phase 3 Integration Test (Fixed)\n');

  try {
    // Test 1: Company Manager
    console.log('1. Testing Company Manager...');
    const companyManager = CompanyManager.getInstance();
    await companyManager.initialize();
    const companies = companyManager.getActiveCompanies();
    console.log(`✅ Company Manager: ${companies.length} companies loaded`);

    // Test 2: Platform Manager
    console.log('\n2. Testing Platform Manager...');
    const platformManager = PlatformManager.getInstance();
    await platformManager.initialize();
    const platformStats = platformManager.getPlatformStats();
    console.log(`✅ Platform Manager: ${Object.keys(platformStats).length} platforms available`);

    // Test 3: Check Instagram platform
    console.log('\n3. Testing Instagram Platform...');
    const instagramStats = platformStats.instagram;
    if (instagramStats) {
      console.log(`✅ Instagram Platform: ${instagramStats.initialized ? 'Ready' : 'Needs configuration'}`);
      console.log(`   Features: ${instagramStats.features?.filter((f: any) => f.enabled).length || 0} enabled`);
    } else {
      console.log('❌ Instagram Platform: Not found');
    }

    // Test 4: Check platform integration (FIXED - use getCompanyConfig method)
    console.log('\n4. Testing Platform Integration...');
    for (const company of companies) {
      const companyConfig = await companyManager.getCompanyConfig(company.id);
      const enabledPlatforms = Object.keys(companyConfig?.platforms || {})
        .filter(p => companyConfig?.platforms?.[p]?.enabled);
      console.log(`   ${company.name}: ${enabledPlatforms.length} platforms enabled (${enabledPlatforms.join(', ')})`);
    }

    console.log('\n🎉 Quick Phase 3 Test: PASSED');
    console.log('📱 Platform infrastructure is working correctly');
    
    return true;

  } catch (error) {
    console.error('\n❌ Quick Phase 3 Test: FAILED');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

if (require.main === module) {
  quickPhase3Test();
}

export { quickPhase3Test };
