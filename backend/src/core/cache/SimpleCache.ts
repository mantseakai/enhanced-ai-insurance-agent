// File: backend/src/core/cache/SimpleCache.ts
import { CacheHealth } from '../../types/CacheTypes';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class SimpleCache {
  
  private static instance: SimpleCache;
  private cache: Map<string, CacheItem<any>> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  protected constructor(maxSize: number = 1000, defaultTTL: number = 600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL; // 10 minutes default
    
    // Clean up expired items every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }


  // Add these methods to the SimpleCache class
async initialize(): Promise<void> {
  // No-op for in-memory cache
  return;
}

async exists(key: string): Promise<boolean> {
  return this.has(key);
}

async getHealth(): Promise<CacheHealth> {
  // In-memory cache is always healthy unless there's a critical memory issue
  return {
    status: 'healthy',
    connected: true,
    latency: 0,
  };
}

async disconnect(): Promise<void> {
  this.clear();
}
  static getInstance(maxSize?: number, defaultTTL?: number): SimpleCache {
    if (!SimpleCache.instance) {
      SimpleCache.instance = new SimpleCache(maxSize, defaultTTL);
    }
    return SimpleCache.instance;
  }

  /**
 * Set cache item with TTL
 */
async set<T>(key: string, data: T, ttl?: number): Promise<boolean> {
  // If cache is full, remove oldest items
  if (this.cache.size >= this.maxSize) {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  const item: CacheItem<T> = {
    data,
    timestamp: Date.now(),
    ttl: ttl || this.defaultTTL
  };

  this.cache.set(key, item);
  return Promise.resolve(true);
}

  /**
   * Get cache item if not expired
   */
 /**
 * Get cache item if not expired
 */
async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return Promise.resolve(null);
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(item.data);
}

  /**
 * Check if key exists and is not expired
 */
async has(key: string): Promise<boolean> {
  return Promise.resolve(this.get(key) !== null);
}

 /**
 * Delete cache item
 */
async delete(key: string): Promise<boolean> {
  return Promise.resolve(this.cache.delete(key));
}

 /**
 * Clear all cache
 */
async clear(): Promise<number> {
  const size = this.cache.size;
  this.cache.clear();
  return Promise.resolve(size);
}

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: string;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need hit tracking for this
      memoryUsage: `${Math.round(JSON.stringify([...this.cache.entries()]).length / 1024)}KB`
    };
  }

  /**
   * Clean up expired items
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired items`);
    }
  }

  /**
   * Generate cache key from components
   */
  static generateKey(...components: any[]): string {
    return components
      .map(c => typeof c === 'object' ? JSON.stringify(c) : String(c))
      .join(':')
      .replace(/[^a-zA-Z0-9:_-]/g, '_'); // Sanitize key
  }
}

// Specific cache instances for different use cases
export class VectorSearchCache extends SimpleCache {
  private static vectorInstance: VectorSearchCache;

  static getInstance(): VectorSearchCache {
    if (!VectorSearchCache.vectorInstance) {
      VectorSearchCache.vectorInstance = new VectorSearchCache(500, 1800000); // 30 min TTL, 500 items max
    }
    return VectorSearchCache.vectorInstance;
  }
}

export class AIResponseCache extends SimpleCache {
  private static aiInstance: AIResponseCache;

  static getInstance(): AIResponseCache {
    if (!AIResponseCache.aiInstance) {
      AIResponseCache.aiInstance = new AIResponseCache(200, 300000); // 5 min TTL, 200 items max
    }
    return AIResponseCache.aiInstance;
  }
}