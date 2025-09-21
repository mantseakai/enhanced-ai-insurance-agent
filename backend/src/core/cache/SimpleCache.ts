// File: backend/src/core/cache/SimpleCache.ts

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

  static getInstance(maxSize?: number, defaultTTL?: number): SimpleCache {
    if (!SimpleCache.instance) {
      SimpleCache.instance = new SimpleCache(maxSize, defaultTTL);
    }
    return SimpleCache.instance;
  }

  /**
   * Set cache item with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
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
  }

  /**
   * Get cache item if not expired
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete cache item
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
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