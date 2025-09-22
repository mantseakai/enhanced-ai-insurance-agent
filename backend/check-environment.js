// Environment validation script
const fs = require('fs');
const path = require('path');

function checkEnvironment() {
  console.log('🔍 Environment Check for Phase 3\n');

  // Check Node.js version
  console.log('📋 System Information:');
  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Working directory: ${process.cwd()}`);

  // Check essential files
  console.log('\n📁 Essential Files:');
  const essentialFiles = [
    'package.json',
    '.env',
    'tsconfig.json',
    'src/app.ts',
    'src/server.ts'
  ];

  essentialFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  });

  // Check Phase 3 files
  console.log('\n📱 Phase 3 Platform Files:');
  const phase3Files = [
    'src/platforms/interfaces/PlatformInterface.ts',
    'src/platforms/instagram/InstagramPlatform.ts',
    'src/platforms/PlatformManager.ts',
    'src/routes/instagram.ts'
  ];

  let phase3Complete = true;
  phase3Files.forEach(file => {
    const exists = fs.existsSync(file);
    if (!exists) phase3Complete = false;
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  });

  // Check dependencies
  console.log('\n📦 Key Dependencies:');
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = pkg.dependencies || {};
    
    const keyDeps = ['express', 'typescript', 'dotenv', 'cors'];
    keyDeps.forEach(dep => {
      const installed = deps[dep] ? '✅' : '❌';
      console.log(`   ${installed} ${dep} ${deps[dep] || 'missing'}`);
    });
  } catch (error) {
    console.log('   ❌ Error reading package.json');
  }

  // Check environment variables
  console.log('\n⚙️ Environment Variables:');
  const envVars = [
    'NODE_ENV',
    'PORT',
    'OPENAI_API_KEY',
    'INSTAGRAM_APP_ID'
  ];

  envVars.forEach(envVar => {
    const value = process.env[envVar];
    const status = value ? '✅' : '⚠️';
    const display = value ? (envVar.includes('KEY') ? '[CONFIGURED]' : value) : '[NOT SET]';
    console.log(`   ${status} ${envVar}: ${display}`);
  });

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Phase 3 Files: ${phase3Complete ? '✅ Complete' : '❌ Incomplete'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Recommendations
  console.log('\n💡 Next Steps:');
  if (phase3Complete) {
    console.log('   1. ✅ Phase 3 setup is complete');
    console.log('   2. 🔧 Configure Instagram API credentials in .env');
    console.log('   3. 🚀 Test with: npm run test:simple');
    console.log('   4. 🌐 Start server with: npm run dev');
  } else {
    console.log('   1. ❌ Re-run Phase 3 setup script');
    console.log('   2. 📁 Ensure all platform files are created');
    console.log('   3. 🔧 Check for any missing dependencies');
  }
}

if (require.main === module) {
  require('dotenv').config();
  checkEnvironment();
}

module.exports = { checkEnvironment };
