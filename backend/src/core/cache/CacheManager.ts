// File: backend/src/core/cache/CacheManager.ts

import { 
  CacheProvider, 
  CacheConfig, 
  CacheStats, 
  CacheHealth, 
  CacheMetrics,
  CacheKeyBuilder,
  CacheOperationResult,
  CacheBatchOperation,
  CacheBatchResult
} from '../../types/CacheTypes';
import { RedisCacheService } from './RedisCacheService';
import { SimpleCache } from './SimpleCache';

export class CacheManager {
  private static instance: CacheManager;
  private primaryCache: CacheProvider | null = null;
  private fallbackCache: CacheProvider | null = null;
  private config: CacheConfig;
  private initialized: boolean = false;
  private metrics: CacheMetrics;

  private constructor() {
    this.config = this.loadConfigFromEnvironment();
    this.metrics = this.initializeMetrics();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Initialize cache manager with providers
   */
  async initialize(): Promise<void> {
    try {
      console.log('🗄️ Initializing Cache Manager...');
      console.log(`📋 Cache provider: ${this.config.provider}`);

      // Initialize primary cache
      await this.initializePrimaryCache();

      // Initialize fallback cache (always use SimpleCache as fallback)
      this.fallbackCache = SimpleCache.getInstance(1000, 300000) as any; // 5 min TTL

      this.initialized = true;
      console.log('✅ Cache Manager initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Cache Manager:', error);
      
      // Fallback to SimpleCache only
      console.log('🔄 Falling back to SimpleCache only...');
      this.primaryCache = SimpleCache.getInstance(500, 300000) as any; // 5 min TTL
      this.initialized = true;
      
      throw error;
    }
  }

  /**
   * Initialize primary cache based on configuration
   */
  private async initializePrimaryCache(): Promise<void> {
    switch (this.config.provider) {
      case 'redis':
        this.primaryCache = new RedisCacheService(this.config.redis);
        await this.primaryCache.initialize();
        break;

      case 'memory':
        this.primaryCache = SimpleCache.getInstance(
          this.config.memory?.maxSize || 1000,
          this.config.memory?.ttl || 300000
        ) as any;
        break;

      case 'hybrid':
        // For hybrid, use Redis as primary and SimpleCache as L1
        this.primaryCache = new RedisCacheService(this.config.redis);
        await this.primaryCache.initialize();
        break;

      default:
        throw new Error(`Unsupported cache provider: ${this.config.provider}`);
    }
  }

  /**
   * Get value from cache with fallback strategy
   */
  async get<T>(key: string, companyId?: string): Promise<T | null> {
    const startTime = Date.now();
    let result: T | null = null;
    let fromCache = false;
    let error: string | undefined;

    try {
      this.metrics.totalOperations++;

      // Build full key if company context provided
      const fullKey = companyId ? CacheKeyBuilder.generateResponseKey(companyId, 'user', key) : key;

      // Try primary cache first
      if (this.primaryCache) {
        try {
          result = await this.primaryCache.get<T>(fullKey);
          if (result !== null) {
            fromCache = true;
            this.metrics.successfulOperations++;
            return result;
          }
        } catch (primaryError) {
          console.warn(`⚠️ Primary cache GET failed for key ${fullKey}:`, primaryError);
          error = primaryError instanceof Error ? primaryError.message : 'Primary cache error';
        }
      }

      // Fallback to secondary cache
      if (this.fallbackCache && !fromCache) {
        try {
          result = await this.fallbackCache.get<T>(fullKey);
          if (result !== null) {
            fromCache = true;
            this.metrics.successfulOperations++;
            
            // Populate primary cache if available
            if (this.primaryCache) {
              this.primaryCache.set(fullKey, result, 300).catch(err => 
                console.warn('Failed to populate primary cache:', err)
              );
            }
            
            return result;
          }
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback cache GET failed for key ${fullKey}:`, fallbackError);
          error = fallbackError instanceof Error ? fallbackError.message : 'Fallback cache error';
        }
      }

      if (!fromCache) {
        this.metrics.failedOperations++;
      }

      return result;

    } finally {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, error);
    }
  }

  /**
   * Set value in cache with multi-level strategy
   */
  async set<T>(key: string, value: T, ttlSeconds?: number, companyId?: string): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      this.metrics.totalOperations++;

      // Build full key if company context provided
      const fullKey = companyId ? CacheKeyBuilder.generateResponseKey(companyId, 'user', key) : key;

      // Set in primary cache
      if (this.primaryCache) {
        try {
          const primaryResult = await this.primaryCache.set(fullKey, value, ttlSeconds);
          success = primaryResult;
        } catch (primaryError) {
          console.warn(`⚠️ Primary cache SET failed for key ${fullKey}:`, primaryError);
          error = primaryError instanceof Error ? primaryError.message : 'Primary cache error';
        }
      }

      // Set in fallback cache
      if (this.fallbackCache) {
        try {
          const fallbackResult = await this.fallbackCache.set(fullKey, value, ttlSeconds);
          success = success || fallbackResult; // Success if either cache succeeds
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback cache SET failed for key ${fullKey}:`, fallbackError);
          if (!error) {
            error = fallbackError instanceof Error ? fallbackError.message : 'Fallback cache error';
          }
        }
      }

      if (success) {
        this.metrics.successfulOperations++;
      } else {
        this.metrics.failedOperations++;
      }

      return success;

    } finally {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, error);
    }
  }

  /**
   * Delete value from all cache levels
   */
  async delete(key: string, companyId?: string): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      this.metrics.totalOperations++;

      // Build full key if company context provided
      const fullKey = companyId ? CacheKeyBuilder.generateResponseKey(companyId, 'user', key) : key;

      // Delete from primary cache
      if (this.primaryCache) {
        try {
          const primaryResult = await this.primaryCache.delete(fullKey);
          success = primaryResult;
        } catch (primaryError) {
          console.warn(`⚠️ Primary cache DELETE failed for key ${fullKey}:`, primaryError);
          error = primaryError instanceof Error ? primaryError.message : 'Primary cache error';
        }
      }

      // Delete from fallback cache
      if (this.fallbackCache) {
        try {
          const fallbackResult = await this.fallbackCache.delete(fullKey);
          success = success || fallbackResult;
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback cache DELETE failed for key ${fullKey}:`, fallbackError);
          if (!error) {
            error = fallbackError instanceof Error ? fallbackError.message : 'Fallback cache error';
          }
        }
      }

      if (success) {
        this.metrics.successfulOperations++;
      } else {
        this.metrics.failedOperations++;
      }

      return success;

    } finally {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, error);
    }
  }

  /**
   * Clear cache entries by pattern
   */
  async clear(pattern?: string, companyId?: string): Promise<number> {
    const startTime = Date.now();
    let totalCleared = 0;
    let error: string | undefined;

    try {
      this.metrics.totalOperations++;

      // Build pattern with company context if provided
      let fullPattern = pattern;
      if (companyId && pattern) {
        fullPattern = `*company:${companyId}:*${pattern}*`;
      } else if (companyId) {
        fullPattern = `*company:${companyId}:*`;
      }

      // Clear primary cache
      if (this.primaryCache) {
        try {
          const primaryCleared = await this.primaryCache.clear(fullPattern);
          totalCleared += primaryCleared;
        } catch (primaryError) {
          console.warn(`⚠️ Primary cache CLEAR failed:`, primaryError);
          error = primaryError instanceof Error ? primaryError.message : 'Primary cache error';
        }
      }

      // Clear fallback cache
      if (this.fallbackCache) {
        try {
          const fallbackCleared = await this.fallbackCache.clear(fullPattern);
          totalCleared += fallbackCleared;
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback cache CLEAR failed:`, fallbackError);
          if (!error) {
            error = fallbackError instanceof Error ? fallbackError.message : 'Fallback cache error';
          }
        }
      }

      if (totalCleared > 0) {
        this.metrics.successfulOperations++;
      }

      return totalCleared;

    } finally {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, error);
    }
  }

  /**
   * Get with automatic key generation for company context
   */
  async getForCompany<T>(
    type: 'response' | 'analysis' | 'conversation' | 'profile' | 'config',
    companyId: string,
    identifier: string,
    userId?: string
  ): Promise<T | null> {
    let key: string;

    switch (type) {
      case 'response':
        key = CacheKeyBuilder.generateResponseKey(companyId, userId || 'anonymous', identifier);
        break;
      case 'analysis':
        key = CacheKeyBuilder.generateAnalysisKey(companyId, identifier);
        break;
      case 'conversation':
        key = CacheKeyBuilder.generateConversationKey(companyId, userId || 'anonymous');
        break;
      case 'profile':
        key = CacheKeyBuilder.generateProfileKey(companyId, userId || 'anonymous');
        break;
      case 'config':
        key = CacheKeyBuilder.generateCompanyConfigKey(companyId);
        break;
      default:
        throw new Error(`Unsupported cache type: ${type}`);
    }

    return this.get<T>(key);
  }

  /**
   * Set with automatic key generation for company context
   */
  async setForCompany<T>(
    type: 'response' | 'analysis' | 'conversation' | 'profile' | 'config',
    companyId: string,
    identifier: string,
    value: T,
    ttlSeconds?: number,
    userId?: string
  ): Promise<boolean> {
    let key: string;

    switch (type) {
      case 'response':
        key = CacheKeyBuilder.generateResponseKey(companyId, userId || 'anonymous', identifier);
        break;
      case 'analysis':
        key = CacheKeyBuilder.generateAnalysisKey(companyId, identifier);
        break;
      case 'conversation':
        key = CacheKeyBuilder.generateConversationKey(companyId, userId || 'anonymous');
        break;
      case 'profile':
        key = CacheKeyBuilder.generateProfileKey(companyId, userId || 'anonymous');
        break;
      case 'config':
        key = CacheKeyBuilder.generateCompanyConfigKey(companyId);
        break;
      default:
        throw new Error(`Unsupported cache type: ${type}`);
    }

    return this.set<T>(key, value, ttlSeconds);
  }

  /**
   * Batch operations for multiple cache operations
   */
  async batch<T>(operations: CacheBatchOperation<T>[]): Promise<CacheBatchResult<T>> {
    const startTime = Date.now();
    const results: Array<CacheOperationResult<T>> = [];
    let successCount = 0;
    let errorCount = 0;

    for (const operation of operations) {
      const opStartTime = Date.now();
      let result: CacheOperationResult<T>;

      try {
        switch (operation.operation) {
          case 'get':
            const getValue = await this.get<T>(operation.key);
            result = {
              success: getValue !== null,
              data: getValue || undefined,
              fromCache: getValue !== null,
              latency: Date.now() - opStartTime,
              keyUsed: operation.key
            };
            break;

          case 'set':
            if (operation.value === undefined) {
              throw new Error('Value is required for set operation');
            }
            const setSuccess = await this.set<T>(operation.key, operation.value, operation.ttl);
            result = {
              success: setSuccess,
              fromCache: false,
              latency: Date.now() - opStartTime,
              keyUsed: operation.key
            };
            break;

          case 'delete':
            const deleteSuccess = await this.delete(operation.key);
            result = {
              success: deleteSuccess,
              fromCache: false,
              latency: Date.now() - opStartTime,
              keyUsed: operation.key
            };
            break;

          default:
            throw new Error(`Unsupported operation: ${operation.operation}`);
        }

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }

      } catch (error) {
        result = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          fromCache: false,
          latency: Date.now() - opStartTime,
          keyUsed: operation.key
        };
        errorCount++;
      }

      results.push(result);
    }

    return {
      results,
      overallSuccess: errorCount === 0,
      totalLatency: Date.now() - startTime,
      successCount,
      errorCount
    };
  }

  /**
   * Get combined cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const primaryStats = this.primaryCache ? await this.primaryCache.getStats() : null;
    const fallbackStats = this.fallbackCache ? await this.fallbackCache.getStats() : null;

    // Combine stats from both caches
    const combinedStats: CacheStats = {
      hits: (primaryStats?.hits || 0) + (fallbackStats?.hits || 0),
      misses: (primaryStats?.misses || 0) + (fallbackStats?.misses || 0),
      sets: (primaryStats?.sets || 0) + (fallbackStats?.sets || 0),
      deletes: (primaryStats?.deletes || 0) + (fallbackStats?.deletes || 0),
      errors: (primaryStats?.errors || 0) + (fallbackStats?.errors || 0),
      size: (primaryStats?.size || 0) + (fallbackStats?.size || 0)
    };

    // Calculate rates
    const totalOperations = combinedStats.hits + combinedStats.misses;
    combinedStats.hitRate = totalOperations > 0 ? combinedStats.hits / totalOperations : 0;
    combinedStats.errorRate = totalOperations > 0 ? combinedStats.errors / totalOperations : 0;

    return combinedStats;
  }

  /**
   * Get cache health status
   */
  async getHealth(): Promise<CacheHealth> {
    const primaryHealth = this.primaryCache ? await this.primaryCache.getHealth() : null;
    const fallbackHealth = this.fallbackCache ? await this.fallbackCache.getHealth() : null;

    // Overall health is the best of both caches
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
    let overallLatency = -1;
    let errors: string[] = [];

    if (primaryHealth) {
      if (primaryHealth.status === 'healthy') {
        overallStatus = 'healthy';
        overallLatency = primaryHealth.latency;
      } else if (primaryHealth.status === 'degraded') {
        overallStatus = 'degraded';
        overallLatency = primaryHealth.latency;
      }
      if (primaryHealth.error) {
        errors.push(`Primary: ${primaryHealth.error}`);
      }
    }

    if (fallbackHealth && overallStatus === 'unhealthy') {
      if (fallbackHealth.status === 'healthy') {
        overallStatus = 'degraded'; // Fallback working but primary failed
        overallLatency = fallbackHealth.latency;
      } else if (fallbackHealth.status === 'degraded') {
        overallStatus = 'degraded';
        overallLatency = fallbackHealth.latency;
      }
      if (fallbackHealth.error) {
        errors.push(`Fallback: ${fallbackHealth.error}`);
      }
    }

    return {
      status: overallStatus,
      connected: (primaryHealth?.connected || false) || (fallbackHealth?.connected || false),
      latency: overallLatency,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Invalidate cache for specific company
   */
  async invalidateCompany(companyId: string): Promise<number> {
    console.log(`🗑️ Invalidating cache for company: ${companyId}`);
    return this.clear('*', companyId);
  }

  /**
   * Invalidate cache for specific user in company
   */
  async invalidateUserInCompany(companyId: string, userId: string): Promise<number> {
    console.log(`🗑️ Invalidating cache for user ${userId} in company ${companyId}`);
    const pattern = `*company:${companyId}:*user:${userId}:*`;
    return this.clear(pattern);
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfigFromEnvironment(): CacheConfig {
    const provider = (process.env.CACHE_PROVIDER || 'memory') as 'redis' | 'memory' | 'hybrid';

    const config: CacheConfig = {
      provider
    };

    if (provider === 'redis' || provider === 'hybrid') {
      config.redis = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'ai_insurance:',
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100')
      };
    }

    if (provider === 'memory' || provider === 'hybrid') {
      config.memory = {
        maxSize: parseInt(process.env.MEMORY_CACHE_MAX_SIZE || '1000'),
        ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300000') // 5 minutes
      };
    }

    if (provider === 'hybrid') {
      config.hybrid = {
        l1Cache: 'memory',
        l2Cache: 'redis',
        l1MaxSize: parseInt(process.env.L1_CACHE_MAX_SIZE || '500'),
        l1Ttl: parseInt(process.env.L1_CACHE_TTL || '60000'), // 1 minute
        l2Ttl: parseInt(process.env.L2_CACHE_TTL || '3600000') // 1 hour
      };
    }

    return config;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): CacheMetrics {
    return {
      provider: this.config.provider,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageLatency: 0,
      peakLatency: 0,
      memoryUsage: 0,
      keyCount: 0,
      uptime: Date.now()
    };
  }

  /**
   * Update metrics after operations
   */
  private updateMetrics(latency: number, error?: string): void {
    // Update latency metrics
    if (this.metrics.totalOperations === 0) {
      this.metrics.averageLatency = latency;
    } else {
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.totalOperations - 1) + latency) / this.metrics.totalOperations;
    }

    if (latency > this.metrics.peakLatency) {
      this.metrics.peakLatency = latency;
    }

    // Update error tracking
    if (error) {
      this.metrics.lastError = {
        message: error,
        timestamp: new Date().toISOString(),
        operation: 'cache_operation'
      };
    }
  }

  /**
   * Disconnect all cache providers
   */
  async disconnect(): Promise<void> {
    try {
      if (this.primaryCache) {
        await this.primaryCache.disconnect();
      }
      if (this.fallbackCache) {
        await this.fallbackCache.disconnect();
      }
      this.initialized = false;
      console.log('✅ Cache Manager disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Cache Manager:', error);
    }
  }

  /**
   * Check if cache manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}