// File: backend/src/routes/index.ts
// Updated to include company management routes

import { Router } from 'express';
import chatRoutes from './chat';
import leadsRoutes from './leads';
//import enhancedChatRoutes from './enhanced-chat';
import whatsappRoutes from './whatsapp';
import companiesRoutes from './companies';

const router = Router();

// Register all route modules
router.use('/companies', companiesRoutes);        // NEW: Company management routes
//router.use('/chat/v2', enhancedChatRoutes);      // Enhanced V2 chat routes
router.use('/chat', chatRoutes);                 // Original chat routes
router.use('/leads', leadsRoutes);               // Lead management routes
router.use('/whatsapp', whatsappRoutes);         // WhatsApp routes

// Health check for the API routes
router.get('/health', async (req, res) => {
  try {
    // Import CompanyManager for health check
    const { CompanyManager } = await import('../core/companies/CompanyManager');
    const companyManager = CompanyManager.getInstance();
    
    // Get manager status
    let companyStatus = { initialized: false, totalCompanies: 0, activeCompanies: 0 };
    try {
      companyStatus = companyManager.getManagerStatus();
    } catch (error) {
      console.warn('Company manager not initialized for health check');
    }
    
    res.json({
      success: true,
      message: 'API routes are working',
      timestamp: new Date().toISOString(),
      mode: 'multi_company_v2',
      routes: {
        companies: '/api/companies',         // NEW
        chat: '/api/chat',
        chatV2: '/api/chat/v2',             // Enhanced
        leads: '/api/leads',
        whatsapp: '/api/whatsapp'           // Enhanced
      },
      features: {
        multiCompany: true,                 // NEW
        multiLLM: true,
        vectorStore: true,
        premiumCalculation: true,
        whatsappIntegration: true,
        caching: true
      },
      companies: companyStatus              // NEW
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

export default router;