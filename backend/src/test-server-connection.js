// Simple server connection test (JavaScript to avoid TS issues)
const http = require('http');

async function testServerConnection() {
  console.log('🌐 Testing Server Connection...\n');

  const testEndpoints = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/companies', name: 'Companies API' },
    { path: '/api/platforms/instagram/companies', name: 'Instagram Platform' }
  ];

  for (const endpoint of testEndpoints) {
    try {
      console.log(`🔍 Testing ${endpoint.name}: ${endpoint.path}`);
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:3000${endpoint.path}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });

      if (response.statusCode === 200) {
        console.log(`   ✅ ${endpoint.name}: Working (200 OK)`);
      } else {
        console.log(`   ⚠️ ${endpoint.name}: Status ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ${endpoint.name}: ${error.message}`);
    }
  }

  console.log('\n📊 Server Connection Test Complete');
  console.log('💡 If endpoints are failing, the server may not be running');
  console.log('🚀 Start with: npm run dev');
}

if (require.main === module) {
  testServerConnection();
}

module.exports = { testServerConnection };
