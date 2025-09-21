// File: backend/src/api/routes/companies.ts

import express, { Request, Response } from 'express';
import Joi from 'joi';
import { CompanyManager } from '../core/companies/CompanyManager';
import { CompanyConfig, CompanyProfile, CompanyValidationResult } from '../types/CompanyTypes';

const router = express.Router();
let companyManager: CompanyManager;

// Initialize company manager
const initializeManager = async () => {
  if (!companyManager) {
    companyManager = CompanyManager.getInstance();
    if (!companyManager.getManagerStatus().initialized) {
      await companyManager.initialize();
    }
  }
  return companyManager;
};

// Validation schemas
const createCompanySchema = Joi.object({
  id: Joi.string().required().pattern(/^[a-zA-Z0-9_-]+$/),
  name: Joi.string().required().min(1).max(100),
  displayName: Joi.string().required().min(1).max(100),
  businessType: Joi.string().valid('general_insurance', 'life_insurance', 'health_insurance', 'auto_insurance', 'multi_line'),
  contactInfo: Joi.object({
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    address: Joi.string().required(),
    website: Joi.string().uri().optional(),
    supportHours: Joi.string().optional()
  }).required(),
  branding: Joi.object({
    primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    logo: Joi.string().uri().optional(),
    brandVoice: Joi.string().valid('professional', 'friendly', 'casual', 'authoritative').optional()
  }).optional(),
  platforms: Joi.object({
    whatsapp: Joi.object({
      enabled: Joi.boolean().optional(),
      phoneNumberId: Joi.string().optional(),
      accessToken: Joi.string().optional()
    }).optional(),
    webchat: Joi.object({
      enabled: Joi.boolean().optional()
    }).optional()
  }).optional(),
  preferredLLMProvider: Joi.string().valid('openai', 'claude', 'local_llama', 'deepseek').optional(),
  llmPriority: Joi.string().valid('cost', 'speed', 'quality').optional()
});

const updateCompanySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  displayName: Joi.string().min(1).max(100).optional(),
  businessType: Joi.string().valid('general_insurance', 'life_insurance', 'health_insurance', 'auto_insurance', 'multi_line').optional(),
  contactInfo: Joi.object({
    phone: Joi.string().optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional(),
    website: Joi.string().uri().optional(),
    supportHours: Joi.string().optional()
  }).optional(),
  branding: Joi.object({
    primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    logo: Joi.string().uri().optional(),
    brandVoice: Joi.string().valid('professional', 'friendly', 'casual', 'authoritative').optional()
  }).optional(),
  platforms: Joi.object().optional(),
  status: Joi.string().valid('active', 'inactive', 'setup', 'suspended').optional(),
  preferredLLMProvider: Joi.string().valid('openai', 'claude', 'local_llama', 'deepseek').optional(),
  llmPriority: Joi.string().valid('cost', 'speed', 'quality').optional()
});

/**
 * GET /api/companies
 * Get all companies (profiles only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const manager = await initializeManager();
    const companies = manager.getActiveCompanies();
    
    res.json({
      success: true,
      data: companies,
      count: companies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/companies/:companyId
 * Get specific company profile
 */
router.get('/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const manager = await initializeManager();
    
    const company = await manager.getCompanyProfile(companyId);
    
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error(`❌ Error fetching company ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else if (error instanceof Error && error.name === 'CompanyInactiveError') {
      res.status(403).json({
        success: false,
        error: 'Company is inactive',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * GET /api/companies/:companyId/config
 * Get full company configuration (admin only)
 */
router.get('/:companyId/config', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const manager = await initializeManager();
    
    // TODO: Add admin authentication middleware
    const config = await manager.getCompanyConfig(companyId);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error(`❌ Error fetching company config ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch company configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * POST /api/companies
 * Create new company
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = createCompanySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const manager = await initializeManager();
    const company = await manager.createCompany(value);
    
    res.status(201).json({
      success: true,
      data: company,
      message: 'Company created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating company:', error);
    
    if (error instanceof Error && error.name === 'CompanyConfigurationError') {
      res.status(400).json({
        success: false,
        error: 'Company configuration error',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * PUT /api/companies/:companyId
 * Update existing company
 */
router.put('/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    // Validate request body
    const { error, value } = updateCompanySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const manager = await initializeManager();
    const updatedCompany = await manager.updateCompany(companyId, value);
    
    res.json({
      success: true,
      data: updatedCompany,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error(`❌ Error updating company ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else if (error instanceof Error && error.name === 'CompanyConfigurationError') {
      res.status(400).json({
        success: false,
        error: 'Company configuration error',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * DELETE /api/companies/:companyId
 * Delete company
 */
router.delete('/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    if (companyId === 'default') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default company'
      });
    }

    const manager = await initializeManager();
    await manager.deleteCompany(companyId);
    
    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error(`❌ Error deleting company ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * POST /api/companies/:companyId/validate
 * Validate company configuration
 */
router.post('/:companyId/validate', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const manager = await initializeManager();
    
    const config = await manager.getCompanyConfig(companyId);
    const validation = await manager.validateCompany(config);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error(`❌ Error validating company ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to validate company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * GET /api/companies/:companyId/stats
 * Get company statistics
 */
router.get('/:companyId/stats', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate } = req.query;
    
    const manager = await initializeManager();
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const stats = await manager.getCompanyStats(companyId, start, end);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error(`❌ Error fetching company stats ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch company statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * GET /api/companies/platform/:platform
 * Get companies by platform
 */
router.get('/platform/:platform', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const manager = await initializeManager();
    
    const companies = manager.getCompaniesByPlatform(platform);
    
    res.json({
      success: true,
      data: companies,
      count: companies.length,
      platform
    });
  } catch (error) {
    console.error(`❌ Error fetching companies for platform ${req.params.platform}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies by platform',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/companies/:companyId/activate
 * Activate company
 */
router.post('/:companyId/activate', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const manager = await initializeManager();
    
    const updatedCompany = await manager.updateCompany(companyId, { status: 'active' });
    
    res.json({
      success: true,
      data: updatedCompany,
      message: 'Company activated successfully'
    });
  } catch (error) {
    console.error(`❌ Error activating company ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to activate company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * POST /api/companies/:companyId/deactivate
 * Deactivate company
 */
router.post('/:companyId/deactivate', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    if (companyId === 'default') {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate default company'
      });
    }

    const manager = await initializeManager();
    const updatedCompany = await manager.updateCompany(companyId, { status: 'inactive' });
    
    res.json({
      success: true,
      data: updatedCompany,
      message: 'Company deactivated successfully'
    });
  } catch (error) {
    console.error(`❌ Error deactivating company ${req.params.companyId}:`, error);
    
    if (error instanceof Error && error.name === 'CompanyNotFoundError') {
      res.status(404).json({
        success: false,
        error: 'Company not found',
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate company',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Error handling middleware
router.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Company API error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

export default router;