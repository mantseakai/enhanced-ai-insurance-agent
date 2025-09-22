// File: backend/src/routes/whatsapp-enhanced.ts
// Enhanced WhatsApp integration with multi-company support

import express from 'express';
import { ContextBuilder } from '../types/UnifiedContext';
import { CompanyManager } from '../core/companies/CompanyManager';
import { AIService } from '../services/AIService';

const router = express.Router();

// WhatsApp webhook verification
router.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      console.log('❌ WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  }
});

// Enhanced WhatsApp webhook with multi-company support
router.post('/webhook', async (req, res) => {
  try {
    console.log('📱 WhatsApp webhook received:', JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object) {
      if (body.entry && body.entry[0]?.changes && body.entry[0]?.changes[0]?.value?.messages && body.entry[0]?.changes[0]?.value?.messages[0]) {
        const change = body.entry[0].changes[0];
        const value = change.value;
        const message = value.messages[0];
        const phoneNumberId = value.metadata.phone_number_id;
        const fromNumber = message.from;
        const messageBody = message.text?.body || '';

        console.log('📞 Processing message:', {
          from: fromNumber,
          phoneNumberId,
          message: messageBody
        });

        // **ENHANCED: Determine company from phone number or message context**
        const companyId = await determineCompanyFromMessage(phoneNumberId, messageBody, fromNumber);
        
        console.log('🏢 Determined company:', companyId);

        // **ENHANCED: Build company-aware context**
        const context = ContextBuilder
          .forWhatsApp(companyId, fromNumber, message.id)
          .withUser(fromNumber, `WhatsApp User ${fromNumber}`)
          .withMessage(messageBody, 'text')
          .withMetadata({
            phoneNumberId,
            timestamp: message.timestamp
          })
          .build();

        console.log('🔧 Built context:', {
          companyId: context.companyId,
          platform: context.platform,
          userId: context.userId
        });

        // **ENHANCED: Process with company-specific AI service**
        const aiService = AIService.getInstance();
        const response = await aiService.processMessage(messageBody, fromNumber, context);

        console.log('🤖 AI Response generated:', {
          length: response.message.length,
          companyContext: context.companyId
        });

        // **ENHANCED: Send company-branded response**
        await sendWhatsAppMessage(phoneNumberId, fromNumber, response.message, companyId);

        res.status(200).send('OK');
      } else {
        console.log('⚠️ No messages found in webhook payload');
        res.status(200).send('OK');
      }
    } else {
      console.log('❌ Invalid webhook payload structure');
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// **NEW: Determine company from various sources**
async function determineCompanyFromMessage(
  phoneNumberId: string, 
  messageBody: string, 
  fromNumber: string
): Promise<string> {
  try {
    const companyManager = CompanyManager.getInstance();

    // Strategy 1: Check if company is mentioned in message
    const companies = companyManager.getActiveCompanies();
    for (const company of companies) {
      const companyName = company.name.toLowerCase();
      if (messageBody.toLowerCase().includes(companyName)) {
        console.log(`🎯 Company detected from message content: ${company.id}`);
        return company.id;
      }
    }

    // Strategy 2: Map phone number to company (you'd maintain this mapping)
    const phoneToCompanyMap = await getPhoneNumberCompanyMapping();
    if (phoneToCompanyMap[phoneNumberId]) {
      console.log(`📞 Company detected from phone mapping: ${phoneToCompanyMap[phoneNumberId]}`);
      return phoneToCompanyMap[phoneNumberId];
    }

    // Strategy 3: Check user's conversation history (if available)
    // This would query your database for previous conversations
    // const lastCompany = await getUserLastCompany(fromNumber);
    // if (lastCompany) return lastCompany;

    // Strategy 4: Default fallback
    console.log('🔄 Using default company fallback');
    return 'default';

  } catch (error) {
    console.error('Error determining company:', error);
    return 'default';
  }
}

// **NEW: Enhanced WhatsApp message sending with company branding**
async function sendWhatsAppMessage(
  phoneNumberId: string, 
  to: string, 
  message: string, 
  companyId: string
): Promise<void> {
  try {
    const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    
    if (!WHATSAPP_TOKEN) {
      throw new Error('WhatsApp access token not configured');
    }

    // **ENHANCED: Get company-specific messaging configuration**
    const companyManager = CompanyManager.getInstance();
    const company = await companyManager.getCompanyConfig(companyId);
    
    // **ENHANCED: Apply company branding to message**
    let brandedMessage = message;
    if (company && company.branding) {
      // Add company signature if configured
      if (company.branding.brandVoice) {
        brandedMessage += `\n\n${company.branding.brandVoice}`;
      }
      
      // Add company-specific greeting/closing
      if (company.branding.brandVoice === 'friendly') {
        brandedMessage = `😊 ${brandedMessage}`;
      }
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      text: { 
        body: brandedMessage 
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorData}`);
    }

    const responseData = await response.json() as any;
    console.log('✅ WhatsApp message sent successfully:', {
      messageId: responseData.messages?.[0]?.id,
      companyId,
      to
    });

  } catch (error) {
    console.error('❌ Failed to send WhatsApp message:', error);
    throw error;
  }
}

// **NEW: Phone number to company mapping (you'd implement this based on your setup)**
async function getPhoneNumberCompanyMapping(): Promise<Record<string, string>> {
  // This would typically come from your database or configuration
  // For now, returning a sample mapping
  return {
    // 'whatsapp_phone_number_id_1': 'ghana_insurance_co',
    // 'whatsapp_phone_number_id_2': 'accra_auto_insurance',
    // Add your actual phone number ID to company mappings here
  };
}

// **NEW: Multi-company webhook testing endpoint**
router.post('/test-company-message', async (req, res) => {
  try {
    const { companyId, message, userId } = req.body;

    if (!companyId || !message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyId, message, userId'
      });
    }

    // Build context for testing
    const context = ContextBuilder
      .forWhatsApp(companyId, userId, `test_${Date.now()}`)
      .withUser(userId, `Test User ${userId}`)
      .withMessage(message, 'text')
      .build();

    // Process message
    const aiService = AIService.getInstance();
    const response = await aiService.processMessage(message, userId, context);

    res.json({
      success: true,
      data: {
        companyId,
        originalMessage: message,
        aiResponse: response,
        context: {
          platform: context.platform,
          companyId: context.companyId,
          userId: context.userId
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to test company message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;