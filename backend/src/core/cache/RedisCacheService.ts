// File: backend/src/core/cache/RedisCacheService.ts

import Redis from 'ioredis';
import { CacheProvider, CacheStats } from '../../types/CacheTypes';

export class RedisCacheService implements CacheProvider {
  private client: Redis;
  private isConnected: boolean = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    size: 0
  };

  constructor(config?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    retryDelayOnFailover?: number;
    maxRetriesPerRequest?: number;
  }) {
    const defaultConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'ai_insurance:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.client = new Redis(finalConfig);
    this.setupEventHandlers();
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Connecting to Redis...');
      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      
      this.isConnected = true;
      console.log('✅ Redis cache service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Redis cache service:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('📡 Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('🚀 Redis ready');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis error:', error);
      this.stats.errors++;
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('📡 Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const value = await this.client.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
      
    } catch (error) {
      console.error(`❌ Redis GET error for key ${key}:`, error);
      this.stats.errors++;
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const serializedValue = JSON.stringify(value);
      
      let result: string | null;
      if (ttlSeconds) {
        result = await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        result = await this.client.set(key, serializedValue);
      }

      this.stats.sets++;
      return result === 'OK';
      
    } catch (error) {
      console.error(`❌ Redis SET error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.del(key);
      this.stats.deletes++;
      return result > 0;
      
    } catch (error) {
      console.error(`❌ Redis DELETE error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
      
    } catch (error) {
      console.error(`❌ Redis EXISTS error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
      
    } catch (error) {
      console.error(`❌ Redis EXPIRE error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      return await this.client.ttl(key);
      
    } catch (error) {
      console.error(`❌ Redis TTL error for key ${key}:`, error);
      this.stats.errors++;
      return -1;
    }
  }

  /**
   * Clear all cache entries with pattern
   */
  async clear(pattern?: string): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const searchPattern = pattern || '*';
      const keys = await this.client.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      this.stats.deletes += result;
      return result;
      
    } catch (error) {
      console.error(`❌ Redis CLEAR error for pattern ${pattern}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      if (keys.length === 0) {
        return [];
      }

      const values = await this.client.mget(...keys);
      
      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        try {
          this.stats.hits++;
          return JSON.parse(value) as T;
        } catch (parseError) {
          console.error(`❌ Parse error for key ${keys[index]}:`, parseError);
          this.stats.errors++;
          return null;
        }
      });
      
    } catch (error) {
      console.error(`❌ Redis MGET error:`, error);
      this.stats.errors++;
      // Return array of nulls with same length as input
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values at once
   */
  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      if (keyValuePairs.length === 0) {
        return true;
      }

      // Use pipeline for multiple operations
      const pipeline = this.client.pipeline();

      for (const { key, value, ttl } of keyValuePairs) {
        const serializedValue = JSON.stringify(value);
        
        if (ttl) {
          pipeline.setex(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      }

      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Pipeline execution failed');
      }

      // Check if all operations succeeded
      const allSucceeded = results.every(([error, result]) => {
        if (error) {
          console.error('❌ Pipeline operation error:', error);
          return false;
        }
        return result === 'OK';
      });

      this.stats.sets += keyValuePairs.length;
      return allSucceeded;
      
    } catch (error) {
      console.error(`❌ Redis MSET error:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.incrby(key, by);
      this.stats.sets++;
      return result;
      
    } catch (error) {
      console.error(`❌ Redis INCREMENT error for key ${key}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Add to set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.sadd(key, ...members);
      this.stats.sets++;
      return result;
      
    } catch (error) {
      console.error(`❌ Redis SADD error for key ${key}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get set members
   */
  async smembers(key: string): Promise<string[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.smembers(key);
      this.stats.hits++;
      return result;
      
    } catch (error) {
      console.error(`❌ Redis SMEMBERS error for key ${key}:`, error);
      this.stats.errors++;
      this.stats.misses++;
      return [];
    }
  }

  /**
   * Push to list
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.lpush(key, ...values);
      this.stats.sets++;
      return result;
      
    } catch (error) {
      console.error(`❌ Redis LPUSH error for key ${key}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get list range
   */
  async lrange(key: string, start: number = 0, stop: number = -1): Promise<string[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.lrange(key, start, stop);
      this.stats.hits++;
      return result;
      
    } catch (error) {
      console.error(`❌ Redis LRANGE error for key ${key}:`, error);
      this.stats.errors++;
      this.stats.misses++;
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      if (this.isConnected) {
        const info = await this.client.info('memory');
        const memoryLines = info.split('\r\n');
        const usedMemoryLine = memoryLines.find(line => line.startsWith('used_memory:'));
        
        if (usedMemoryLine) {
          this.stats.size = parseInt(usedMemoryLine.split(':')[1]);
        }
      }
      
      return { ...this.stats };
      
    } catch (error) {
      console.error('❌ Error getting Redis stats:', error);
      return { ...this.stats };
    }
  }

  /**
   * Get cache health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    connected: boolean;
    latency: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          connected: false,
          latency: -1,
          error: 'Not connected to Redis'
        };
      }

      // Test with ping
      await this.client.ping();
      const latency = Date.now() - start;

      // Determine status based on latency and error rate
      const errorRate = this.stats.errors / Math.max(1, this.stats.hits + this.stats.misses + this.stats.sets);
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (latency > 1000 || errorRate > 0.1) {
        status = 'unhealthy';
      } else if (latency > 500 || errorRate > 0.05) {
        status = 'degraded';
      }

      return {
        status,
        connected: this.isConnected,
        latency
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        latency: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis cache service disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting Redis:', error);
    }
  }

  /**
   * Generate cache key with company context
   */
  static generateCompanyKey(companyId: string, type: string, identifier: string): string {
    return `company:${companyId}:${type}:${identifier}`;
  }

  /**
   * Generate conversation cache key
   */
  static generateConversationKey(companyId: string, userId: string, messageHash: string): string {
    return `conv:${companyId}:${userId}:${messageHash}`;
  }

  /**
   * Generate analysis cache key
   */
  static generateAnalysisKey(companyId: string, messageHash: string): string {
    return `analysis:${companyId}:${messageHash}`;
  }
}