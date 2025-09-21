// File: backend/src/routes/whatsapp.ts
// Enhanced version with multi-company support

import express, { Request, Response } from 'express';
import Joi from 'joi';
import { AIService } from '../services/AIService';
import { CompanyManager } from '../core/companies/CompanyManager';
import { 
  UnifiedQueryContext,
  ContextBuilder,
  ContextValidator,
  ContextUtils
} from '../types/UnifiedContext';
import { AIResponse } from '../services/AIService';
import {
  ConversationMessage 
} from '../types/unified-rag';

const router = express.Router();
let aiService: AIService | null = null;
let companyManager: CompanyManager | null = null;

// WhatsApp API Configuration
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'insurance_bot_verify_token';

// Initialize services
const initializeServices = async () => {
  if (!aiService) {
    aiService = new AIService();
    await aiService.initialize();
  }
  
  if (!companyManager) {
    companyManager = CompanyManager.getInstance();
    await companyManager.initialize();
  }
  
  return { aiService, companyManager };
};

// Enhanced message templates with company context
const getWhatsAppTemplates = (companyName: string, contactInfo: any) => ({
  welcome: (name?: string) => `Akwaaba${name ? ` ${name}` : ''}! 👋\n\nI'm your AI insurance assistant from *${companyName}*. I can help you with:\n\n🚗 Auto Insurance\n🏥 Health Insurance\n👨‍👩‍👧‍👦 Life Insurance\n🏢 Business Insurance\n\nWhat type of coverage interests you today?`,
  
  premiumQuote: (quote: any) => `💰 *Your ${companyName} Insurance Quote*\n\n📋 **${quote.insuranceType.toUpperCase()} INSURANCE**\n💵 Annual Premium: **GH₵ ${quote.amount.toLocaleString()}**\n📅 Monthly: **GH₵ ${Math.round(quote.amount / 12).toLocaleString()}**\n\n✅ Valid for 30 days\n💳 Payment via MTN MoMo available\n\n*Ready to get protected? Reply with "YES" to continue!*`,
  
  error: () => `I apologize for the technical issue! 🤖\n\nPlease try again or contact ${companyName} support:\n📞 ${contactInfo.phone}\n📧 ${contactInfo.email}\n\nWe're here to help protect what matters most to you! 🛡️`,
  
  leadCapture: (leadScore: number) => `Thank you for your interest in ${companyName}! 🎯\n\nOur insurance specialist will contact you within 24 hours to finalize your coverage.\n\n📞 We'll call: ${contactInfo.phone}\n📧 Email us: ${contactInfo.email}\n🌐 Visit: ${contactInfo.website || 'our website'}\n\nStay protected with ${companyName}! 🛡️`,
  
  businessHours: (hours: string) => `Thank you for contacting ${companyName}! 🕐\n\nOur business hours are: ${hours}\n\nWe'll respond to your message as soon as we're available. For urgent matters, please call ${contactInfo.phone}.\n\nBest regards,\n${companyName} Team`
});

/**
 * GET /webhook - WhatsApp webhook verification
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📞 WhatsApp webhook verification request:', { mode, token });

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ WhatsApp webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

/**
 * POST /webhook - WhatsApp webhook for incoming messages
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('📨 WhatsApp webhook received:', JSON.stringify(req.body, null, 2));

    const { aiService, companyManager } = await initializeServices();

    // Always respond with 200 to WhatsApp to avoid retries
    res.status(200).send('OK');

    // Process webhook in background
    processWhatsAppWebhook(req.body, aiService, companyManager);

  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    res.status(200).send('OK'); // Still return 200 to WhatsApp
  }
});

/**
 * Process WhatsApp webhook in background
 */
async function processWhatsAppWebhook(
  webhookData: any, 
  aiService: AIService, 
  companyManager: CompanyManager
) {
  try {
    // Extract message data
    const entry = webhookData.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || !value.messages) {
      console.log('📭 No messages in webhook data');
      return;
    }

    const messages = value.messages;
    const contacts = value.contacts || [];
    const metadata = value.metadata;

    // Determine company from phone number or default
    const phoneNumberId = metadata?.phone_number_id;
    const companyId = await determineCompanyFromPhoneNumber(phoneNumberId, companyManager);
    
    console.log(`🏢 Processing messages for company: ${companyId}`);

    // Get company configuration
    const companyConfig = await companyManager.getCompanyConfig(companyId);
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message, contacts, companyConfig, aiService);
    }

  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
  }
}

/**
 * Process individual incoming message
 */
async function processIncomingMessage(
  message: any,
  contacts: any[],
  companyConfig: any,
  aiService: AIService
) {
  try {
    const messageId = message.id;
    const fromNumber = message.from;
    const messageType = message.type;
    const timestamp = message.timestamp;

    console.log(`📱 Processing ${messageType} message from ${fromNumber}`);

    // Find contact info
    const contact = contacts.find(c => c.wa_id === fromNumber);
    const contactName = contact?.profile?.name || 'Customer';

    let messageText = '';

    // Extract message content based on type
    switch (messageType) {
      case 'text':
        messageText = message.text?.body || '';
        break;
      case 'button':
        messageText = message.button?.text || message.button?.payload || '';
        break;
      case 'interactive':
        if (message.interactive?.type === 'button_reply') {
          messageText = message.interactive.button_reply.title || '';
        } else if (message.interactive?.type === 'list_reply') {
          messageText = message.interactive.list_reply.title || '';
        }
        break;
      default:
        messageText = `Received ${messageType} message`;
        break;
    }

    if (!messageText.trim()) {
      console.log('📭 Empty message content, skipping');
      return;
    }

    // Build unified context with company information using ContextBuilder
    const context = ContextBuilder
      .forWhatsApp(companyConfig.id, fromNumber, messageId)
      .withUser(fromNumber, contactName)
      .withConversation(ContextUtils.determineConversationStage(messageText))
      .withInsurance(ContextUtils.extractInsuranceType(messageText), ContextUtils.determineUrgency(messageText, {}))
      .withMetadata({
        messageType: messageType,
        phoneNumberId: companyConfig.platforms.whatsapp?.phoneNumberId,
        contactName: contactName
      })
      .build();

    // Add company config to context
    context.companyConfig = companyConfig;

    // Process message with AI service using unified context
    console.log(`🤖 Processing AI response for company ${companyConfig.name}...`);
    const aiResponse = await aiService.processMessage(messageText, fromNumber, context);

    // Send response back to WhatsApp
    await sendWhatsAppResponse(fromNumber, aiResponse, companyConfig, contactName);

  } catch (error) {
    console.error('❌ Error processing individual message:', error);
    
    // Send error response
    try {
      const templates = getWhatsAppTemplates(companyConfig.name, companyConfig.contactInfo);
      await sendWhatsAppMessage(message.from, templates.error(), companyConfig);
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }
  }
}

/**
 * Send AI response via WhatsApp
 */
async function sendWhatsAppResponse(
  toNumber: string,
  aiResponse: AIResponse,
  companyConfig: any,
  contactName?: string
) {
  try {
    let responseMessage = aiResponse.message;
    const templates = getWhatsAppTemplates(companyConfig.name, companyConfig.contactInfo);

    // Handle special response types
    if (aiResponse.premiumQuote) {
      responseMessage = templates.premiumQuote(aiResponse.premiumQuote);
    } else if (aiResponse.shouldCaptureLead && aiResponse.leadScore && aiResponse.leadScore > 70) {
      responseMessage += '\n\n' + templates.leadCapture(aiResponse.leadScore);
    }

    // Check business hours
    if (!isWithinBusinessHours(companyConfig.businessSettings.businessHours)) {
      responseMessage += '\n\n' + templates.businessHours(companyConfig.contactInfo.supportHours);
    }

    // Send the message
    await sendWhatsAppMessage(toNumber, responseMessage, companyConfig);

    console.log(`✅ WhatsApp response sent to ${toNumber} for company ${companyConfig.name}`);

  } catch (error) {
    console.error('❌ Failed to send WhatsApp response:', error);
    throw error;
  }
}

/**
 * Send WhatsApp message using company's credentials
 */
async function sendWhatsAppMessage(
  to: string,
  message: string,
  companyConfig: any
): Promise<{ messageId: string }> {
  try {
    const accessToken = companyConfig.platforms.whatsapp?.accessToken;
    const phoneNumberId = companyConfig.platforms.whatsapp?.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      throw new Error(`WhatsApp not configured for company ${companyConfig.name}`);
    }

    const cleanNumber = cleanPhoneNumber(to);
    
    const messageData = {
      messaging_product: 'whatsapp',
      to: cleanNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json() as any;
    
    console.log(`✅ WhatsApp message sent via ${companyConfig.name} to ${to}: ${data.messages[0].id}`);
    
    return {
      messageId: data.messages[0].id
    };

  } catch (error) {
    console.error(`❌ Failed to send WhatsApp message for ${companyConfig.name}:`, error);
    throw error;
  }
}

/**
 * Determine company from phone number ID
 */
async function determineCompanyFromPhoneNumber(
  phoneNumberId: string,
  companyManager: CompanyManager
): Promise<string> {
  try {
    // Get all companies and find one with matching phone number ID
    const companies = companyManager.getActiveCompanies();
    
    for (const company of companies) {
      const fullConfig = await companyManager.getCompanyConfig(company.id);
      if (fullConfig.platforms.whatsapp?.phoneNumberId === phoneNumberId) {
        return company.id;
      }
    }

    // Default to 'default' company if no match found
    console.log(`⚠️ No company found for phone number ${phoneNumberId}, using default`);
    return 'default';

  } catch (error) {
    console.error('❌ Error determining company from phone number:', error);
    return 'default';
  }
}

/**
 * Determine conversation stage from message content
 */
function determineConversationStage(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('start')) {
    return 'greeting';
  }
  if (lowerMessage.includes('quote') || lowerMessage.includes('price') || lowerMessage.includes('cost')) {
    return 'quote_request';
  }
  if (lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('yes')) {
    return 'ready_to_buy';
  }
  if (lowerMessage.includes('compare') || lowerMessage.includes('difference')) {
    return 'comparison';
  }
  
  return 'information_gathering';
}

/**
 * Check if current time is within business hours
 */
function isWithinBusinessHours(businessHours: Record<string, { start: string; end: string }>): boolean {
  try {
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    
    const todayHours = businessHours[currentDay];
    if (!todayHours) {
      return false; // No hours defined for today
    }
    
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = todayHours.start.split(':').map(Number);
    const [endHour, endMin] = todayHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    return currentTime >= startTime && currentTime <= endTime;
    
  } catch (error) {
    console.error('❌ Error checking business hours:', error);
    return true; // Default to within hours if error
  }
}

/**
 * Clean phone number for WhatsApp
 */
function cleanPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Add country code if missing (assuming Ghana +233)
  if (cleaned.length === 9 && cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    cleaned = '233' + cleaned;
  } else if (cleaned.length === 10 && !cleaned.startsWith('233')) {
    cleaned = '233' + cleaned;
  }
  
  return cleaned;
}

/**
 * Extract insurance type from message
 */
function extractInsuranceType(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('auto') || lowerMessage.includes('car') || lowerMessage.includes('vehicle')) {
    return 'auto';
  }
  if (lowerMessage.includes('health') || lowerMessage.includes('medical')) {
    return 'health';
  }
  if (lowerMessage.includes('life')) {
    return 'life';
  }
  if (lowerMessage.includes('business') || lowerMessage.includes('commercial')) {
    return 'business';
  }
  if (lowerMessage.includes('property') || lowerMessage.includes('home')) {
    return 'property';
  }
  if (lowerMessage.includes('travel')) {
    return 'travel';
  }
  
  return 'general';
}

/**
 * POST /api/whatsapp/send - Send message programmatically
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { companyId, to, message, messageType = 'text' } = req.body;

    // Validate required fields
    if (!companyId || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyId, to, message'
      });
    }

    const { companyManager } = await initializeServices();
    const companyConfig = await companyManager.getCompanyConfig(companyId);

    // Send message
    const result = await sendWhatsAppMessage(to, message, companyConfig);

    res.json({
      success: true,
      data: result,
      companyId: companyId,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/whatsapp/qr-code/:companyId - Generate QR code for company
 */
router.get('/qr-code/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { type = 'auto', size = '300' } = req.query;

    const { companyManager } = await initializeServices();
    const companyConfig = await companyManager.getCompanyConfig(companyId);

    const businessPhoneNumber = companyConfig.platforms.whatsapp?.phoneNumberId;
    if (!businessPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured for this company'
      });
    }

    // Create WhatsApp link with company-specific message
    const templates = getWhatsAppTemplates(companyConfig.name, companyConfig.contactInfo);
    const defaultMessage = `Hi! I'm interested in ${type} insurance from ${companyConfig.name}.`;
    const whatsappUrl = `https://wa.me/${businessPhoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
    
    // Generate QR code URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(whatsappUrl)}`;

    res.json({
      success: true,
      data: {
        whatsappUrl,
        qrCodeUrl,
        companyName: companyConfig.name,
        insuranceType: type,
        businessPhone: businessPhoneNumber
      }
    });

  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/whatsapp/qr-code/:companyId/html - Generate HTML QR code page
 */
router.get('/qr-code/:companyId/html', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { type = 'auto' } = req.query;

    const { companyManager } = await initializeServices();
    const companyConfig = await companyManager.getCompanyConfig(companyId);

    const businessPhoneNumber = companyConfig.platforms.whatsapp?.phoneNumberId;
    if (!businessPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured for this company'
      });
    }

    const defaultMessage = `Hi! I'm interested in ${type} insurance from ${companyConfig.name}.`;
    const whatsappUrl = `https://wa.me/${businessPhoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(whatsappUrl)}`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${companyConfig.name} - ${String(type).charAt(0).toUpperCase() + String(type).slice(1)} Insurance</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, ${companyConfig.branding.primaryColor}20, ${companyConfig.branding.secondaryColor || '#f8f9fa'}20);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                background: white;
                padding: 2rem;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 400px;
                width: 100%;
            }
            .company-logo {
                width: 80px;
                height: 80px;
                background: ${companyConfig.branding.primaryColor};
                border-radius: 50%;
                margin: 0 auto 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 2rem;
                font-weight: bold;
            }
            .company-name {
                color: ${companyConfig.branding.primaryColor};
                font-size: 1.5rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            .insurance-type {
                background: linear-gradient(135deg, ${companyConfig.branding.primaryColor}, ${companyConfig.branding.secondaryColor || '#6c757d'});
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-weight: bold;
                display: inline-block;
                margin-bottom: 1.5rem;
                text-transform: uppercase;
            }
            .qr-code {
                margin: 1.5rem 0;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 10px;
            }
            .qr-code img {
                max-width: 100%;
                height: auto;
            }
            .instructions {
                color: #6c757d;
                font-size: 0.9rem;
                line-height: 1.6;
                margin-top: 1rem;
            }
            .contact-info {
                margin-top: 1.5rem;
                padding: 1rem;
                background: ${companyConfig.branding.primaryColor}10;
                border-radius: 8px;
                font-size: 0.85rem;
            }
            .whatsapp-link {
                display: inline-block;
                background: #25D366;
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: 25px;
                text-decoration: none;
                margin: 1rem 0;
                font-weight: bold;
                transition: background 0.3s;
            }
            .whatsapp-link:hover {
                background: #128C7E;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="company-logo">
                ${companyConfig.branding.logo ? `<img src="${companyConfig.branding.logo}" alt="${companyConfig.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : companyConfig.name.charAt(0)}
            </div>
            
            <div class="company-name">${companyConfig.name}</div>
            <div class="insurance-type">${String(type)} Insurance</div>
            
            <div class="qr-code">
                <img src="${qrCodeUrl}" alt="WhatsApp QR Code" />
            </div>
            
            <div class="instructions">
                <strong>Scan this QR code with your phone to start chatting on WhatsApp</strong><br>
                Get instant quotes and personalized insurance advice from our AI assistant!
            </div>
            
            <a href="${whatsappUrl}" class="whatsapp-link" target="_blank">
                📱 Open WhatsApp Directly
            </a>
            
            <div class="contact-info">
                <strong>${companyConfig.name}</strong><br>
                📞 ${companyConfig.contactInfo.phone}<br>
                📧 ${companyConfig.contactInfo.email}<br>
                🕐 ${companyConfig.contactInfo.supportHours}
                ${companyConfig.contactInfo.website ? `<br>🌐 ${companyConfig.contactInfo.website}` : ''}
            </div>
        </div>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('❌ Error generating QR HTML:', error);
    res.status(500).send('<h1>Error generating QR code</h1><p>Please try again later.</p>');
  }
});

/**
 * GET /api/whatsapp/companies - Get companies with WhatsApp enabled
 */
router.get('/companies', async (req: Request, res: Response) => {
  try {
    const { companyManager } = await initializeServices();
    const companies = companyManager.getCompaniesByPlatform('whatsapp');
    
    res.json({
      success: true,
      data: companies,
      count: companies.length
    });
  } catch (error) {
    console.error('❌ Error fetching WhatsApp companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/whatsapp/health - WhatsApp integration health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { aiService, companyManager } = await initializeServices();
    
    const aiStats = aiService.getServiceStats();
    const managerStatus = companyManager.getManagerStatus();
    const whatsappCompanies = companyManager.getCompaniesByPlatform('whatsapp');
    
    res.json({
      success: true,
      data: {
        aiService: {
          mode: aiStats.mode,
          initialized: aiStats.vectorStore.initialized,
          llmProviders: aiStats.llm.availableProviders,
          activeLLM: aiStats.llm.activeProvider
        },
        companyManager: {
          initialized: managerStatus.initialized,
          totalCompanies: managerStatus.totalCompanies,
          activeCompanies: managerStatus.activeCompanies
        },
        whatsapp: {
          enabledCompanies: whatsappCompanies.length,
          companies: whatsappCompanies.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status
          }))
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ WhatsApp health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
router.use((err: any, req: Request, res: Response, next: any) => {
  console.error('WhatsApp route error:', err);
  
  // Always return 200 for WhatsApp webhooks to avoid retries
  if (req.path === '/webhook') {
    return res.status(200).send('OK');
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred with WhatsApp integration.',
    timestamp: new Date().toISOString()
  });
});

export default router;