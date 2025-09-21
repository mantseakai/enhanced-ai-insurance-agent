// File: backend/src/types/CacheTypes.ts

export interface CacheProvider {
  /**
   * Initialize the cache provider
   */
  initialize(): Promise<void>;

  /**
   * Get value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;

  /**
   * Delete value from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Clear cache entries
   */
  clear(pattern?: string): Promise<number>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Get cache health status
   */
  getHealth(): Promise<CacheHealth>;

  /**
   * Disconnect from cache
   */
  disconnect(): Promise<void>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  size: number;
  hitRate?: number;
  errorRate?: number;
}

export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  latency: number;
  error?: string;
}

export interface CacheConfig {
  provider: 'redis' | 'memory' | 'hybrid';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
  };
  memory?: {
    maxSize: number;
    ttl: number;
  };
  hybrid?: {
    l1Cache: 'memory';
    l2Cache: 'redis';
    l1MaxSize: number;
    l1Ttl: number;
    l2Ttl: number;
  };
}

export interface CacheStrategy {
  ttl: number;
  keyPattern: string;
  invalidationStrategy: 'time-based' | 'event-based' | 'manual';
  compressionEnabled: boolean;
  serializationMethod: 'json' | 'binary';
}

export interface CacheMetrics {
  provider: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  peakLatency: number;
  memoryUsage: number;
  keyCount: number;
  uptime: number;
  lastError?: {
    message: string;
    timestamp: string;
    operation: string;
  };
}

export interface CacheInvalidationEvent {
  type: 'company_update' | 'user_update' | 'conversation_end' | 'manual';
  companyId?: string;
  userId?: string;
  pattern?: string;
  timestamp: string;
  reason?: string;
}

export interface CacheKey {
  prefix: string;
  companyId?: string;
  userId?: string;
  type: 'response' | 'analysis' | 'conversation' | 'profile' | 'config';
  identifier: string;
  version?: string;
}

export class CacheKeyBuilder {
  private static readonly SEPARATOR = ':';
  private static readonly DEFAULT_PREFIX = 'ai_insurance';

  static buildKey(components: CacheKey): string {
    const parts = [
      components.prefix || CacheKeyBuilder.DEFAULT_PREFIX,
      components.type
    ];

    if (components.companyId) {
      parts.push('company', components.companyId);
    }

    if (components.userId) {
      parts.push('user', components.userId);
    }

    parts.push(components.identifier);

    if (components.version) {
      parts.push('v', components.version);
    }

    return parts.join(CacheKeyBuilder.SEPARATOR);
  }

  static parseKey(key: string): Partial<CacheKey> {
    const parts = key.split(CacheKeyBuilder.SEPARATOR);
    const parsed: Partial<CacheKey> = {};

    if (parts.length >= 3) {
      parsed.prefix = parts[0];
      parsed.type = parts[1] as CacheKey['type'];
    }

    // Look for company and user patterns
    for (let i = 2; i < parts.length - 1; i++) {
      if (parts[i] === 'company' && i + 1 < parts.length) {
        parsed.companyId = parts[i + 1];
        i++; // Skip next part as it's the company ID
      } else if (parts[i] === 'user' && i + 1 < parts.length) {
        parsed.userId = parts[i + 1];
        i++; // Skip next part as it's the user ID
      } else if (parts[i] === 'v' && i + 1 < parts.length) {
        parsed.version = parts[i + 1];
        i++; // Skip next part as it's the version
      }
    }

    // Last meaningful part is the identifier
    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      if (lastPart !== 'v' && !parsed.version) {
        parsed.identifier = lastPart;
      } else if (parts.length > 3) {
        parsed.identifier = parts[parts.length - 3];
      }
    }

    return parsed;
  }

  static generateResponseKey(companyId: string, userId: string, messageHash: string): string {
    return CacheKeyBuilder.buildKey({
      prefix: 'ai_insurance',
      type: 'response',
      companyId,
      userId,
      identifier: messageHash
    });
  }

  static generateAnalysisKey(companyId: string, messageHash: string): string {
    return CacheKeyBuilder.buildKey({
      prefix: 'ai_insurance',
      type: 'analysis',
      companyId,
      identifier: messageHash
    });
  }

  static generateConversationKey(companyId: string, userId: string): string {
    return CacheKeyBuilder.buildKey({
      prefix: 'ai_insurance',
      type: 'conversation',
      companyId,
      userId,
      identifier: 'history'
    });
  }

  static generateProfileKey(companyId: string, userId: string): string {
    return CacheKeyBuilder.buildKey({
      prefix: 'ai_insurance',
      type: 'profile',
      companyId,
      userId,
      identifier: 'data'
    });
  }

  static generateCompanyConfigKey(companyId: string): string {
    return CacheKeyBuilder.buildKey({
      prefix: 'ai_insurance',
      type: 'config',
      companyId,
      identifier: 'full'
    });
  }
}

export interface CacheOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache: boolean;
  latency: number;
  keyUsed: string;
}

export interface CacheBatchOperation<T> {
  key: string;
  value?: T;
  ttl?: number;
  operation: 'get' | 'set' | 'delete';
}

export interface CacheBatchResult<T> {
  results: Array<CacheOperationResult<T>>;
  overallSuccess: boolean;
  totalLatency: number;
  successCount: number;
  errorCount: number;
}