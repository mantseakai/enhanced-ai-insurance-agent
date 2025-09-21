// File: backend/src/utils/ContextMigrationHelper.ts
// Helper functions to migrate from old context types to UnifiedQueryContext

import { UnifiedQueryContext, ContextBuilder, ContextUtils } from '../types/UnifiedContext';

/**
 * Migration helper class to convert old context types to UnifiedQueryContext
 */
export class ContextMigrationHelper {
  
  /**
   * Convert legacy QueryContext to UnifiedQueryContext
   */
  static migrateQueryContext(oldContext: any): UnifiedQueryContext {
    return {
      // Direct mappings
      userId: oldContext.userId,
      customerType: oldContext.customerType || 'individual',
      platform: oldContext.platform || 'api',
      timestamp: oldContext.timestamp || new Date().toISOString(),
      
      // Legacy field mappings
      conversationStage: oldContext.conversationStage,
      insuranceType: oldContext.insuranceType,
      urgency: oldContext.urgency,
      leadScore: oldContext.leadScore,
      location: oldContext.location,
      
      // Metadata consolidation
      metadata: {
        ...oldContext.metadata,
        // Move any other legacy fields to metadata
        customerProfile: oldContext.customerProfile,
        conversationHistory: oldContext.conversationHistory,
        extractedInfo: oldContext.extractedInfo
      }
    };
  }

  /**
   * Convert legacy EnhancedQueryContext to UnifiedQueryContext
   */
  static migrateEnhancedQueryContext(oldContext: any): UnifiedQueryContext {
    return {
      // All enhanced fields are now native to UnifiedQueryContext
      userId: oldContext.userId,
      customerType: oldContext.customerType,
      platform: oldContext.platform,
      conversationStage: oldContext.conversationStage,
      insuranceType: oldContext.insuranceType,
      urgency: oldContext.urgency,
      leadScore: oldContext.leadScore,
      location: oldContext.location,
      region: oldContext.region,
      country: oldContext.country,
      timestamp: oldContext.timestamp,
      sessionId: oldContext.sessionId,
      requestId: oldContext.requestId,
      
      // Enhanced metadata
      metadata: {
        ...oldContext.metadata,
        previousMessages: oldContext.previousMessages,
        userAgent: oldContext.userAgent,
        ipAddress: oldContext.ipAddress
      }
    };
  }

  /**
   * Convert legacy CompanyQueryContext to UnifiedQueryContext
   */
  static migrateCompanyQueryContext(oldContext: any): UnifiedQueryContext {
    return {
      // Company context is now native
      companyId: oldContext.companyId,
      companyConfig: oldContext.companyConfig,
      
      // All other fields from enhanced context
      ...ContextMigrationHelper.migrateEnhancedQueryContext(oldContext)
    };
  }

  /**
   * Auto-detect and migrate any legacy context type
   */
  static autoMigrate(context: any): UnifiedQueryContext {
    if (!context || typeof context !== 'object') {
      return {};
    }

    // If it already looks like UnifiedQueryContext, return as-is
    if (context.hasOwnProperty('companyId') && context.hasOwnProperty('platform')) {
      return context as UnifiedQueryContext;
    }

    // If it has company context, treat as CompanyQueryContext
    if (context.hasOwnProperty('companyId') || context.hasOwnProperty('companyConfig')) {
      return ContextMigrationHelper.migrateCompanyQueryContext(context);
    }

    // If it has enhanced fields, treat as EnhancedQueryContext
    if (context.hasOwnProperty('sessionId') || context.hasOwnProperty('requestId')) {
      return ContextMigrationHelper.migrateEnhancedQueryContext(context);
    }

    // Otherwise, treat as basic QueryContext
    return ContextMigrationHelper.migrateQueryContext(context);
  }

  /**
   * Batch migrate multiple contexts
   */
  static batchMigrate(contexts: any[]): UnifiedQueryContext[] {
    return contexts.map(context => ContextMigrationHelper.autoMigrate(context));
  }
}

/**
 * Helper functions for common migration scenarios
 */
export class MigrationPatterns {
  
  /**
   * Migrate WhatsApp webhook context
   */
  static migrateWhatsAppWebhook(
    companyId: string,
    fromNumber: string,
    messageId: string,
    contactName?: string,
    messageType?: string
  ): UnifiedQueryContext {
    return ContextBuilder
      .forWhatsApp(companyId, fromNumber, messageId)
      .withUser(fromNumber, contactName)
      .withMetadata({ messageType })
      .build();
  }

  /**
   * Migrate web chat context
   */
  static migrateWebChat(
    companyId: string,
    sessionId: string,
    userId?: string
  ): UnifiedQueryContext {
    return ContextBuilder
      .forWebChat(companyId, sessionId)
      .withUser(userId || sessionId)
      .build();
  }

  /**
   * Migrate API request context
   */
  static migrateAPIRequest(
    companyId: string,
    requestId: string,
    userId?: string,
    platform?: string
  ): UnifiedQueryContext {
    return ContextBuilder
      .forAPI(companyId, requestId)
      .withUser(userId || 'anonymous')
      .withPlatform(platform as any || 'api')
      .build();
  }
}

/**
 * Validation helpers for migrated contexts
 */
export class MigrationValidator {
  
  /**
   * Validate that migration was successful
   */
  static validateMigration(
    original: any,
    migrated: UnifiedQueryContext
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check that important fields were preserved
    if (original.userId && !migrated.userId) {
      issues.push('userId was lost during migration');
    }

    if (original.companyId && !migrated.companyId) {
      issues.push('companyId was lost during migration');
    }

    if (original.platform && !migrated.platform) {
      issues.push('platform was lost during migration');
    }

    if (original.timestamp && !migrated.timestamp) {
      issues.push('timestamp was lost during migration');
    }

    // Check for data type consistency
    if (migrated.leadScore && (typeof migrated.leadScore !== 'number' || migrated.leadScore < 0 || migrated.leadScore > 100)) {
      issues.push('leadScore is invalid after migration');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Generate migration report
   */
  static generateMigrationReport(
    originalContexts: any[],
    migratedContexts: UnifiedQueryContext[]
  ): {
    totalMigrated: number;
    successfulMigrations: number;
    issues: Array<{ index: number; issues: string[] }>;
    summary: string;
  } {
    const results = originalContexts.map((original, index) => ({
      index,
      validation: MigrationValidator.validateMigration(original, migratedContexts[index])
    }));

    const successfulMigrations = results.filter(r => r.validation.isValid).length;
    const issues = results
      .filter(r => !r.validation.isValid)
      .map(r => ({ index: r.index, issues: r.validation.issues }));

    return {
      totalMigrated: originalContexts.length,
      successfulMigrations,
      issues,
      summary: `${successfulMigrations}/${originalContexts.length} contexts migrated successfully. ${issues.length} contexts had issues.`
    };
  }
}

/**
 * Example usage and testing
 */
export class MigrationExamples {
  
  static runExamples() {
    console.log('🔄 Running context migration examples...');

    // Example 1: Basic QueryContext migration
    const oldQueryContext = {
      userId: 'user123',
      customerType: 'individual',
      conversationStage: 'greeting'
    };

    const migrated1 = ContextMigrationHelper.autoMigrate(oldQueryContext);
    console.log('📋 Basic migration:', migrated1);

    // Example 2: Enhanced QueryContext migration
    const oldEnhancedContext = {
      userId: 'user456',
      platform: 'whatsapp',
      conversationStage: 'quote_request',
      insuranceType: 'auto',
      sessionId: 'session789',
      timestamp: '2024-09-21T10:00:00Z'
    };

    const migrated2 = ContextMigrationHelper.autoMigrate(oldEnhancedContext);
    console.log('📋 Enhanced migration:', migrated2);

    // Example 3: Company QueryContext migration
    const oldCompanyContext = {
      companyId: 'ghana_insurance_co',
      userId: 'user789',
      platform: 'whatsapp',
      conversationStage: 'ready_to_buy',
      companyConfig: { name: 'Ghana Insurance Co.' }
    };

    const migrated3 = ContextMigrationHelper.autoMigrate(oldCompanyContext);
    console.log('📋 Company migration:', migrated3);

    // Example 4: Using ContextBuilder for new contexts
    const newContext = ContextBuilder
      .forWhatsApp('star_assurance', '+233123456789', 'msg_001')
      .withUser('+233123456789', 'John Doe')
      .withInsurance('auto', 'high')
      .withLocation('Accra')
      .build();

    console.log('🆕 New context using builder:', newContext);

    // Example 5: Validation
    const validation = MigrationValidator.validateMigration(oldCompanyContext, migrated3);
    console.log('✅ Migration validation:', validation);
  }
}

// Export convenience function for quick migration
export function migrateContext(oldContext: any): UnifiedQueryContext {
  return ContextMigrationHelper.autoMigrate(oldContext);
}

// Export convenience function for batch migration
export function migrateContexts(oldContexts: any[]): UnifiedQueryContext[] {
  return ContextMigrationHelper.batchMigrate(oldContexts);
}