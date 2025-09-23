// File: backend/src/routes/index.ts
// Updated to include company management routes

import { Router } from 'express';
import chatRoutes from './chat';
import leadsRoutes from './leads';
//import enhancedChatRoutes from './enhanced-chat';
import whatsappRoutes from './whatsapp';
import companiesRoutes from './companies';
import whatsappRouter from './whatsapp';
import companiesRouter from './companies';
import instagramRouter from './instagram'; // NEW: Instagram routes
import { AIService } from '../services/AIService';
import { CompanyManager } from '../core/companies/CompanyManager';
import { PlatformManager } from '../platforms/PlatformManager'; // NEW: Platform manager
import { ContextBuilder } from '../types/UnifiedContext';

const router = Router();

// Register all route modules
router.use('/companies', companiesRoutes);        // NEW: Company management routes
router.use('/instagram', instagramRouter);
router.use('/whatsapp', whatsappRouter);
router.use('/companies', companiesRouter);
//router.use('/chat/v2', enhancedChatRoutes);      // Enhanced V2 chat routes
router.use('/chat', chatRoutes);                 // Original chat routes
router.use('/leads', leadsRoutes);               // Lead management routes
router.use('/whatsapp', whatsappRoutes);         // WhatsApp routes

// NEW: Platform routes

// TODO: Add Facebook, Telegram routes
// router.use('/facebook', facebookRouter);
// router.use('/telegram', telegramRouter);


// Health check for the API routes
router.get('/health', async (req, res) => {
  try {
    // Import CompanyManager for health check
    const { CompanyManager } = await import('../core/companies/CompanyManager');
    const aiService = AIService.getInstance();
    const companyManager = CompanyManager.getInstance();
    const platformManager = PlatformManager.getInstance(); // NEW
    
    
    // Get manager status
    let companyStatus = { initialized: false, totalCompanies: 0, activeCompanies: 0 };
    try {
      companyStatus = companyManager.getManagerStatus();
    } catch (error) {
      console.warn('Company manager not initialized for health check');
    }

    
    res.json({
      status: 'healthy',
      services: {
        ai: aiService.isInitialized() ? 'operational' : 'not_initialized',
        companies: companyManager.getManagerStatus(),
        platforms: platformManager.isInitialized() // NEW
      },
      companies: companyManager.getActiveCompanies().length,
      platforms: platformManager.getPlatformStats(), // NEW
      version: process.env.npm_package_version || '1.0.0',
      success: true,
      message: 'API routes are working',
      timestamp: new Date().toISOString(),
      mode: 'multi_company_v2',
      routes: {
        companies: '/api/companies',         // NEW
        chat: '/api/chat',
        chatV2: '/api/chat/v2',             // Enhanced
        leads: '/api/leads',
        whatsapp: '/api/whatsapp',
        instagram: '/api/instagram'           // Enhanced
      },
      features: {
        multiCompany: true,                 // NEW
        multiLLM: true,
        vectorStore: true,
        premiumCalculation: true,
        whatsappIntegration: true,
        instagramIntegration: true,   // NEW
        caching: true
      },
      //companies: companyStatus              // NEW
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced system status endpoint
router.get('/status', async (req, res) => {
  try {
    // Import services for status check
    const { CompanyManager } = await import('../core/companies/CompanyManager');
    const companyManager = CompanyManager.getInstance();
    
    let companyStats = {
      totalCompanies: 0,
      activeCompanies: 0,
      initialized: false
    };
    
    try {
      if (companyManager.getManagerStatus().initialized) {
        const companies = companyManager.getActiveCompanies();
        companyStats = {
          totalCompanies: companyManager.getManagerStatus().totalCompanies,
          activeCompanies: companies.length,
          initialized: true
        };
      }
    } catch (error) {
      console.warn('Company manager not available for status check');
    }
    
    const status = {
      system: 'operational',
      version: '2.0.0',
      mode: 'multi_company_multi_llm',
      components: {
        aiService: 'operational',
        companyManager: companyStats.initialized ? 'operational' : 'not_initialized',
        vectorStore: 'operational',
        llmProviders: 'operational',
        cache: 'operational',
        whatsapp: 'operational'
      },
      statistics: {
        totalCompanies: companyStats.totalCompanies,
        activeCompanies: companyStats.activeCompanies,
        totalConversations: 0,        // Would be populated by analytics
        averageResponseTime: 0        // Would be populated by analytics
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NEW: Multi-platform message testing endpoint
router.post('/test-multi-platform', async (req, res) => {
  try {
    const { message, companyId, userId, platform = 'api' } = req.body;

    if (!message || !companyId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: message, companyId, userId'
      });
    }

    // Build context for specified platform
    const context = ContextBuilder
      .forPlatform(platform, companyId, userId, `test_${Date.now()}`)
      .withUser(userId, `Test User ${userId}`)
      .withMessage(message, 'text')
      .build();

    const aiService = AIService.getInstance();
    const response = await aiService.processMessage(message, userId, context, companyId);

    res.json({
      success: true,
      data: {
        platform,
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
      error: 'Failed to test multi-platform message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NEW: Platform-specific company configuration endpoint
router.get('/platforms/:platform/companies', async (req, res) => {
  try {
    const { platform } = req.params;
    const companyManager = CompanyManager.getInstance();
    
    const allCompanies = companyManager.getActiveCompanies();
    const companies = [];
    
    for (const company of allCompanies) {
      const fullConfig = await companyManager.getCompanyConfig(company.id);
      if ((fullConfig.platforms as any)[platform]?.enabled) {
        companies.push({
          id: company.id,
          name: company.name,
          platformConfig: (fullConfig.platforms as any)[platform],
          branding: {
            primaryColor: fullConfig.branding?.primaryColor,
            logo: fullConfig.branding?.logo
          }
        });
      }
    }

    res.json({
      success: true,
      platform,
      count: companies.length,
      companies
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get platform companies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;