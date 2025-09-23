// File: backend/src/routes/instagram.ts
// Instagram webhook and API routes

import express from 'express';
import { PlatformManager } from '../platforms/PlatformManager';
import { CompanyManager } from '../core/companies/CompanyManager';

const router = express.Router();

// Instagram webhook verification
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('📋 Instagram webhook verification:', { mode, token });

    // Verify webhook token (you should set this in your environment)
    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'mytoken123';
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Instagram webhook verified');
      res.status(200).send(challenge);
    } else {
      console.log('❌ Instagram webhook verification failed');
      res.sendStatus(403);
    }
    
  } catch (error) {
    console.error('❌ Instagram webhook verification error:', error);
    res.sendStatus(500);
  }
});

// Instagram webhook handler
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📨 Instagram webhook received');
    console.log('📨 Instagram webhook received at:', new Date().toISOString());
    console.log('📨 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📨 Body:', JSON.stringify(req.body, null, 2));

    // The data is already parsed as JSON by express.json()
    const webhookData = req.body;
    
    console.log('📄 Webhook data:', JSON.stringify(webhookData, null, 2));
    
    // Check if this is a message webhook
    if (webhookData.entry && webhookData.entry.length > 0) {
      for (const entry of webhookData.entry) {
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            console.log('💬 Message event:', JSON.stringify(messagingEvent, null, 2));
            
            if (messagingEvent.message && messagingEvent.message.text) {
              const message = messagingEvent.message.text;
              const senderId = messagingEvent.sender.id;
              const pageId = messagingEvent.recipient.id;
              
              console.log(`📱 Instagram message: "${message}" from ${senderId} to ${pageId}`);
              
              // TODO: Process with your AI system
              // For now, just acknowledge receipt
              console.log('✅ Instagram message processed');
            }
          }
        }
      }
    }
    
    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Instagram webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Instagram webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test Instagram message sending
router.post('/test-send', async (req, res) => {
  try {
    const { companyId, recipientId, message } = req.body;

    if (!companyId || !recipientId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyId, recipientId, message'
      });
    }

    const platformManager = PlatformManager.getInstance();
    
    const instagramPlatform = platformManager.platforms.get('instagram');
    
    if (!instagramPlatform) {
      return res.status(400).json({
        success: false,
        error: 'Instagram platform not available'
      });
    }

    const result = await instagramPlatform.sendMessage(recipientId, message, companyId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send Instagram message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;