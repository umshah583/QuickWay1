// GPS Zone Pricing Cache Service
// Redis-based caching with fallback to in-memory cache

import { Redis } from 'ioredis';

// Redis client (configure based on your environment)
let redisClient: Redis | null = null;

try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL);
  } else if (process.env.REDIS_HOST) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }
} catch (error) {
  console.warn('Redis connection failed, using in-memory cache:', error);
}

// In-memory fallback cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

// Cache TTLs (in seconds)
const CACHE_TTLS = {
  ZONE_RESOLUTION: 5 * 60,      // 5 minutes
  PRICING_DATA: 10 * 60,        // 10 minutes
  ZONE_LIST: 30 * 60,          // 30 minutes
  SERVICE_PRICES: 15 * 60,      // 15 minutes
} as const;

// Cache key prefixes
const CACHE_PREFIXES = {
  ZONE_RESOLUTION: 'zone:resolution:',
  PRICING_DATA: 'pricing:data:',
  ZONE_LIST: 'zones:list:',
  SERVICE_PRICES: 'service:prices:',
} as const;

/**
 * Generate cache key for zone resolution
 */
export function getZoneResolutionKey(lat: number, lng: number, precision: number = 4): string {
  return `${CACHE_PREFIXES.ZONE_RESOLUTION}${lat.toFixed(precision)}_${lng.toFixed(precision)}`;
}

/**
 * Generate cache key for pricing data
 */
export function getPricingDataKey(zoneId: string | null, serviceIds: string[], datetime?: Date): string {
  const dateStr = datetime ? datetime.toISOString() : 'current';
  const sortedServiceIds = [...serviceIds].sort().join(',');
  return `${CACHE_PREFIXES.PRICING_DATA}${zoneId || 'global'}:${sortedServiceIds}:${dateStr}`;
}

/**
 * Generate cache key for zone list
 */
export function getZoneListKey(): string {
  return CACHE_PREFIXES.ZONE_LIST + 'active';
}

/**
 * Generate cache key for service prices
 */
export function getServicePricesKey(serviceId: string): string {
  return `${CACHE_PREFIXES.SERVICE_PRICES}${serviceId}`;
}

/**
 * Set cache value with expiration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setCache(key: string, value: any, ttlSeconds: number): Promise<void> {
  const expiresAt = Date.now() + (ttlSeconds * 1000);

  if (redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify({ data: value, expiresAt }));
    } catch (error) {
      console.warn('Redis set failed:', error);
      // Fallback to memory cache
      memoryCache.set(key, { data: value, expiresAt });
    }
  } else {
    // Use memory cache
    memoryCache.set(key, { data: value, expiresAt });
  }
}

/**
 * Get cache value
 */
async function getCache<T>(key: string): Promise<T | null> {
  try {
    let cached: { data: T; expiresAt: number } | null = null;

    if (redisClient) {
      const redisValue = await redisClient.get(key);
      if (redisValue) {
        cached = JSON.parse(redisValue) as { data: T; expiresAt: number };
      }
    } else {
      const memValue = memoryCache.get(key);
      if (memValue) {
        cached = memValue as { data: T; expiresAt: number };
      }
    }

    if (!cached || typeof cached !== 'object' || !('data' in cached) || !('expiresAt' in cached)) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      // Expired, remove from cache
      await deleteCache(key);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.warn('Cache get failed:', error);
    return null;
  }
}

/**
 * Delete cache entry
 */
async function deleteCache(key: string): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.warn('Redis delete failed:', error);
    }
  }
  memoryCache.delete(key);
}

/**
 * Clear all cache entries with a prefix
 */
export async function clearCacheByPrefix(prefix: string): Promise<void> {
  if (redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.warn('Redis clear by prefix failed:', error);
    }
  }

  // Clear memory cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all pricing-related caches
 */
export async function clearPricingCache(): Promise<void> {
  await Promise.all([
    clearCacheByPrefix(CACHE_PREFIXES.PRICING_DATA),
    clearCacheByPrefix(CACHE_PREFIXES.SERVICE_PRICES),
  ]);
}

/**
 * Clear all zone-related caches
 */
export async function clearZoneCache(): Promise<void> {
  await Promise.all([
    clearCacheByPrefix(CACHE_PREFIXES.ZONE_RESOLUTION),
    clearCacheByPrefix(CACHE_PREFIXES.ZONE_LIST),
  ]);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  redis: boolean;
  memoryEntries: number;
  redisKeys?: number;
}> {
  const stats = {
    redis: redisClient !== null,
    memoryEntries: memoryCache.size,
    redisKeys: undefined as number | undefined,
  };

  if (redisClient) {
    try {
      // Count keys with our prefixes
      const keys = await redisClient.keys('zone:* pricing:* service:*');
      stats.redisKeys = keys.length;
    } catch (error) {
      console.warn('Redis stats failed:', error);
    }
  }

  return stats;
}

/**
 * Zone Resolution Cache Operations
 */
export class ZoneResolutionCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async get(lat: number, lng: number): Promise<any> {
    const key = getZoneResolutionKey(lat, lng);
    return getCache(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async set(lat: number, lng: number, data: any): Promise<void> {
    const key = getZoneResolutionKey(lat, lng);
    await setCache(key, data, CACHE_TTLS.ZONE_RESOLUTION);
  }
}

/**
 * Pricing Data Cache Operations
 */
export class PricingDataCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async get(zoneId: string | null, serviceIds: string[], datetime?: Date): Promise<any> {
    const key = getPricingDataKey(zoneId, serviceIds, datetime);
    return getCache(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async set(zoneId: string | null, serviceIds: string[], data: any, datetime?: Date): Promise<void> {
    const key = getPricingDataKey(zoneId, serviceIds, datetime);
    await setCache(key, data, CACHE_TTLS.PRICING_DATA);
  }
}

/**
 * Zone List Cache Operations
 */
export class ZoneListCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async get(): Promise<any> {
    const key = getZoneListKey();
    return getCache(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async set(data: any): Promise<void> {
    const key = getZoneListKey();
    await setCache(key, data, CACHE_TTLS.ZONE_LIST);
  }
}

/**
 * Service Prices Cache Operations
 */
export class ServicePricesCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async get(serviceId: string): Promise<any> {
    const key = getServicePricesKey(serviceId);
    return getCache(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async set(serviceId: string, data: any): Promise<void> {
    const key = getServicePricesKey(serviceId);
    await setCache(key, data, CACHE_TTLS.SERVICE_PRICES);
  }
}

/**
 * Health check for cache system
 */
export async function checkCacheHealth(): Promise<{
  healthy: boolean;
  redis: boolean;
  memory: boolean;
  error?: string;
}> {
  try {
    // Test memory cache
    const testKey = 'health_check_test';
    const testData = { test: true, timestamp: Date.now() };
    memoryCache.set(testKey, { data: testData, expiresAt: Date.now() + 60000 });
    const retrieved = memoryCache.get(testKey);
    memoryCache.delete(testKey);

    const memoryHealthy = retrieved?.data?.test === true;

    let redisHealthy = false;
    if (redisClient) {
      try {
        await redisClient.ping();
        redisHealthy = true;
      } catch (error) {
        console.warn('Redis health check failed:', error);
      }
    }

    return {
      healthy: memoryHealthy && (redisClient ? redisHealthy : true),
      redis: redisHealthy,
      memory: memoryHealthy,
    };
  } catch (error) {
    return {
      healthy: false,
      redis: false,
      memory: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cleanup expired memory cache entries
 */
export function cleanupExpiredMemoryCache(): void {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (now > value.expiresAt) {
      memoryCache.delete(key);
    }
  }
}

// Periodic cleanup (run every 5 minutes)
if (typeof global !== 'undefined') {
  setInterval(cleanupExpiredMemoryCache, 5 * 60 * 1000);
}
