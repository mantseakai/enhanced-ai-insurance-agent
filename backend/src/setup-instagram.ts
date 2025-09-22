// File: backend/src/setup-instagram.ts
// Instagram Business API setup helper

async function setupInstagramIntegration() {
  console.log('📱 Instagram Business API Setup Guide\n');
  
  console.log('🔧 STEP 1: Facebook Developer Setup');
  console.log('1. Go to https://developers.facebook.com/');
  console.log('2. Create a new app or use existing app');
  console.log('3. Add "Instagram Basic Display" and "Instagram Messaging" products');
  console.log('4. Configure Instagram Business Account\n');
  
  console.log('🏢 STEP 2: Instagram Business Account');
  console.log('1. Ensure you have an Instagram Business or Creator account');
  console.log('2. Connect it to your Facebook Page');
  console.log('3. Get your Instagram Business Account ID\n');
  
  console.log('🔑 STEP 3: Access Tokens');
  console.log('1. Generate Page Access Token with instagram_messaging permissions');
  console.log('2. Exchange for long-lived token (60 days)');
  console.log('3. Set up token refresh process\n');
  
  console.log('🪝 STEP 4: Webhook Configuration');
  console.log('1. Set webhook URL: https://your-domain.com/api/instagram/webhook');
  console.log('2. Subscribe to: messages, messaging_postbacks, message_echoes');
  console.log('3. Set verify token in environment variables\n');
  
  console.log('⚙️ STEP 5: Environment Variables');
  console.log('Add these to your .env file:');
  console.log('INSTAGRAM_APP_ID=your_app_id');
  console.log('INSTAGRAM_APP_SECRET=your_app_secret');
  console.log('INSTAGRAM_ACCESS_TOKEN=your_long_lived_token');
  console.log('INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id');
  console.log('INSTAGRAM_VERIFY_TOKEN=your_custom_verify_token');
  console.log('INSTAGRAM_WEBHOOK_SECRET=your_webhook_secret\n');
  
  console.log('🧪 STEP 6: Testing');
  console.log('1. Run: npm run test:instagram');
  console.log('2. Test webhook with ngrok or live domain');
  console.log('3. Send test message to your Instagram business account\n');
  
  console.log('📋 STEP 7: Company Configuration');
  console.log('Update your company configuration:');
  console.log(`
{
  "platforms": {
    "instagram": {
      "enabled": true,
      "accessToken": "your_long_lived_token",
      "businessAccountId": "your_business_account_id"
    }
  }
}
`);
  
  console.log('\n✅ Instagram setup complete! Your multi-platform insurance agent is ready.');
}