// File: backend/src/test-api-routes.ts
// Test the company API routes without starting a full server

import express from 'express';
import request from 'supertest';
import companiesRoutes from './routes/companies';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/companies', companiesRoutes);

async function testAPIRoutes() {
  console.log('🧪 Testing Company API Routes...');

  try {
    // Test 1: GET /api/companies (Get all companies)
    console.log('\n🔍 Test 1: GET /api/companies');
    const getAllResponse = await request(app)
      .get('/api/companies')
      .expect(200);
    
    console.log('✅ Test 1 passed: Get all companies:', {
      success: getAllResponse.body.success,
      count: getAllResponse.body.count,
      companies: getAllResponse.body.data.map((c: any) => ({ id: c.id, name: c.name }))
    });

    // Test 2: GET /api/companies/:id (Get specific company)
    console.log('\n🔍 Test 2: GET /api/companies/default');
    const getOneResponse = await request(app)
      .get('/api/companies/default')
      .expect(200);
    
    console.log('✅ Test 2 passed: Get default company:', {
      success: getOneResponse.body.success,
      company: getOneResponse.body.data.name
    });

    // Test 3: POST /api/companies (Create new company)
    console.log('\n🔍 Test 3: POST /api/companies (Create new company)');
    const createResponse = await request(app)
      .post('/api/companies')
      .send({
        id: 'api_test_company',
        name: 'API Test Insurance Co.',
        displayName: 'API Test Insurance Co.',
        businessType: 'auto_insurance',
        contactInfo: {
          phone: '+233-555-999-888',
          email: 'api-test@testapi.com',
          address: 'API Test Address, Accra'
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
          primaryColor: '#ff6b6b',
          secondaryColor: '#4ecdc4',
          brandVoice: 'friendly'
        }
      })
      .expect(201);
    
    console.log('✅ Test 3 passed: Created company:', {
      success: createResponse.body.success,
      company: createResponse.body.data.name,
      id: createResponse.body.data.id
    });

    // Test 4: PUT /api/companies/:id (Update company)
    console.log('\n🔍 Test 4: PUT /api/companies/api_test_company (Update company)');
    const updateResponse = await request(app)
      .put('/api/companies/api_test_company')
      .send({
        displayName: 'Updated API Test Insurance Co.',
        branding: {
          primaryColor: '#6c5ce7',
          brandVoice: 'professional'
        }
      })
      .expect(200);
    
    console.log('✅ Test 4 passed: Updated company:', {
      success: updateResponse.body.success,
      displayName: updateResponse.body.data.displayName,
      primaryColor: updateResponse.body.data.branding.primaryColor
    });

    // Test 5: POST /api/companies/:id/validate (Validate company)
    console.log('\n🔍 Test 5: POST /api/companies/api_test_company/validate');
    const validateResponse = await request(app)
      .post('/api/companies/api_test_company/validate')
      .expect(200);
    
    console.log('✅ Test 5 passed: Company validation:', {
      success: validateResponse.body.success,
      isValid: validateResponse.body.data.isValid,
      score: validateResponse.body.data.score,
      warnings: validateResponse.body.data.warnings.length
    });

    // Test 6: GET /api/companies/platform/webchat (Get companies by platform)
    console.log('\n🔍 Test 6: GET /api/companies/platform/webchat');
    const platformResponse = await request(app)
      .get('/api/companies/platform/webchat')
      .expect(200);
    
    console.log('✅ Test 6 passed: WebChat companies:', {
      success: platformResponse.body.success,
      count: platformResponse.body.count,
      platform: platformResponse.body.platform
    });

    // Test 7: GET /api/companies/:id/config (Get full config)
    console.log('\n🔍 Test 7: GET /api/companies/api_test_company/config');
    const configResponse = await request(app)
      .get('/api/companies/api_test_company/config')
      .expect(200);
    
    console.log('✅ Test 7 passed: Company config retrieved:', {
      success: configResponse.body.success,
      hasFullConfig: !!configResponse.body.data.businessSettings,
      platforms: Object.keys(configResponse.body.data.platforms)
    });

    // Test 8: POST /api/companies/:id/activate (Activate company)
    console.log('\n🔍 Test 8: POST /api/companies/api_test_company/activate');
    const activateResponse = await request(app)
      .post('/api/companies/api_test_company/activate')
      .expect(200);
    
    console.log('✅ Test 8 passed: Company activated:', {
      success: activateResponse.body.success,
      status: activateResponse.body.data.status
    });

    // Test 9: GET /api/companies/:id/stats (Get stats)
    console.log('\n🔍 Test 9: GET /api/companies/api_test_company/stats');
    const statsResponse = await request(app)
      .get('/api/companies/api_test_company/stats')
      .expect(200);
    
    console.log('✅ Test 9 passed: Company stats:', {
      success: statsResponse.body.success,
      companyId: statsResponse.body.data.companyId,
      hasStats: typeof statsResponse.body.data.totalConversations === 'number'
    });

    // Test 10: Error handling (Try to get non-existent company)
    console.log('\n🔍 Test 10: GET /api/companies/non_existent (Error handling)');
    const errorResponse = await request(app)
      .get('/api/companies/non_existent1')
      .expect(404);
    
    console.log('✅ Test 10 passed: Error handling:', {
      success: errorResponse.body.success,
      error: errorResponse.body.error
    });

    // Test 11: DELETE /api/companies/:id (Delete company)
    console.log('\n🔍 Test 11: DELETE /api/companies/api_test_company (Delete company)');
    const deleteResponse = await request(app)
      .delete('/api/companies/api_test_company')
      .expect(200);
    
    console.log('✅ Test 11 passed: Company deleted:', {
      success: deleteResponse.body.success,
      message: deleteResponse.body.message
    });

    // Test 12: Verify deletion
    console.log('\n🔍 Test 12: GET /api/companies/api_test_company (Verify deletion)');
    const verifyDeleteResponse = await request(app)
      .get('/api/companies/api_test_company')
      .expect(404);
    
    console.log('✅ Test 12 passed: Company deletion verified:', {
      success: verifyDeleteResponse.body.success,
      error: verifyDeleteResponse.body.error
    });

    console.log('\n🎉 All API route tests passed!');
    
    // Final summary
    console.log('\n📊 API Testing Summary:');
    console.log('  ✅ GET /api/companies - List all companies');
    console.log('  ✅ GET /api/companies/:id - Get specific company');
    console.log('  ✅ POST /api/companies - Create new company');
    console.log('  ✅ PUT /api/companies/:id - Update company');
    console.log('  ✅ POST /api/companies/:id/validate - Validate company');
    console.log('  ✅ GET /api/companies/platform/:platform - Get by platform');
    console.log('  ✅ GET /api/companies/:id/config - Get full config');
    console.log('  ✅ POST /api/companies/:id/activate - Activate company');
    console.log('  ✅ GET /api/companies/:id/stats - Get statistics');
    console.log('  ✅ DELETE /api/companies/:id - Delete company');
    console.log('  ✅ Error handling - 404 for non-existent companies');
    console.log('  ✅ CRUD operations working perfectly');
    
  } catch (error) {
    console.error('❌ API route test failed:', error);
  }
}

// Helper function to install supertest if needed
async function ensureSupertest() {
  try {
    await import('supertest');
    return true;
  } catch (error) {
    console.log('📦 Installing supertest for API testing...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install --save-dev supertest @types/supertest', { stdio: 'inherit' });
      console.log('✅ Supertest installed successfully');
      return true;
    } catch (installError) {
      console.error('❌ Failed to install supertest:', installError);
      return false;
    }
  }
}

// Run the API tests
async function runAPITests() {
  console.log('🚀 Starting API Route Tests...');
  
  const hasSupertestResult = await ensureSupertest();
  if (!hasSupertestResult) {
    console.log('⚠️ Skipping API tests - supertest not available');
    console.log('💡 Run: npm install --save-dev supertest @types/supertest');
    return;
  }
  
  await testAPIRoutes();
  console.log('🏁 API route testing completed');
}

// Alternative simple test without supertest
async function testAPIRoutesSimple() {
  console.log('🧪 Testing Company API Routes (Simple)...');
  
  try {
    // Test that routes can be imported and initialized
    const companiesRoutes = await  import('./routes/companies');
    console.log('✅ Company routes imported successfully');
    
    // Test CompanyManager integration
    const { CompanyManager } = await import('./core/companies/CompanyManager');
    const manager = CompanyManager.getInstance();
    await manager.initialize();
    
    const companies = manager.getActiveCompanies();
    console.log('✅ CompanyManager working with API routes:', companies.length, 'companies');
    
    // Test route structure (check exports)
    const routeStack = companiesRoutes.default?.stack || [];
    const routes = routeStack.map((layer: any) => ({
      method: Object.keys(layer.route?.methods || {})[0]?.toUpperCase(),
      path: layer.route?.path
    }));
    
    console.log('✅ API routes available:', routes);
    
    console.log('\n📊 Simple API Test Summary:');
    console.log('  ✅ Routes module loads correctly');
    console.log('  ✅ CompanyManager integration working');
    console.log('  ✅ Route endpoints configured');
    console.log('  ✅ Ready for HTTP testing');
    
  } catch (error) {
    console.error('❌ Simple API test failed:', error);
  }
}

// Check if we can run full tests or simple tests
if (process.argv.includes('--simple')) {
  testAPIRoutesSimple();
} else {
  runAPITests().catch(() => {
    console.log('\n🔄 Falling back to simple tests...');
    testAPIRoutesSimple();
  });
}

export { };