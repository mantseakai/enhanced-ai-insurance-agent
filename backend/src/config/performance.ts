// File: backend/src/config/performance.ts

export const PerformanceConfig = {
  // Vector Search Optimization
  vectorSearch: {
    defaultTopK: 3,              // Reduced from 5 for faster search
    maxTopK: 10,                 // Maximum allowed search results
    similarityThreshold: 0.7,    // Only return high-quality matches
    cacheTimeout: 300000,        // 5 minutes cache for repeated queries
    batchSize: 20                // Smaller batches for better performance
  },

  // AI Response Optimization
  aiResponse: {
    maxTokens: 300,              // Reduced for faster responses
    temperature: 0.7,            // Balanced creativity vs speed
    timeout: 8000,               // 8 second timeout for AI calls
    retryAttempts: 2,            // Retry failed calls
    concurrentRequests: 3        // Limit concurrent AI requests
  },

  // Caching Configuration
  caching: {
    enabled: true,
    ttl: 600,                    // 10 minutes default TTL
    maxCacheSize: 1000,          // Maximum cached items
    keyPrefix: 'ai_insure_',
    
    // Specific cache settings
    vectorSearchTTL: 1800,       // 30 minutes for vector search
    aiResponseTTL: 300,          // 5 minutes for AI responses
    knowledgeTTL: 3600           // 1 hour for knowledge base queries
  },

  // Response Compression
  compression: {
    enabled: true,
    threshold: 1024,             // Compress responses > 1KB
    level: 6                     // Compression level (1-9)
  },

  // Request Optimization
  requests: {
    keepAlive: true,
    timeout: 10000,              // 10 second request timeout
    maxRedirects: 3,
    retryDelay: 1000             // 1 second retry delay
  }
};

// Environment-specific overrides
export const getPerformanceConfig = () => {
  const config = { ...PerformanceConfig };
  
  if (process.env.NODE_ENV === 'production') {
    // Production optimizations
    config.vectorSearch.cacheTimeout = 900000; // 15 minutes
    config.caching.ttl = 1800; // 30 minutes
    config.aiResponse.maxTokens = 250; // Even more concise
  } else if (process.env.NODE_ENV === 'development') {
    // Development settings - more verbose for debugging
    config.aiResponse.maxTokens = 400;
    config.caching.ttl = 60; // 1 minute for faster testing
  }

  return config;
};