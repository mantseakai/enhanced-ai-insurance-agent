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
    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'your_verify_token';
    
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
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('📨 Instagram webhook received');

    // Validate webhook signature
    const signature = req.get('X-Hub-Signature-256');
    const webhookSecret = process.env.INSTAGRAM_WEBHOOK_SECRET;
    
    if (signature && webhookSecret) {
      // Implement signature validation here
      console.log('🔐 Validating Instagram webhook signature...');
    }

    // Parse webhook data
    const webhookData = JSON.parse(req.body.toString());
    
    // Process with platform manager
    const platformManager = PlatformManager.getInstance();
    await platformManager.processIncomingMessage('instagram', webhookData);

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