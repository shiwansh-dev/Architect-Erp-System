// src/lib/redis.js
import { createClient } from 'redis';

const isNextBuildProcess = process.argv.some((arg) => arg === 'build')
  && process.argv.some((arg) => arg.includes('next'));

// Redis connection configuration
const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || 'redis://localhost:6379';

// Log which environment variable was used (for debugging)
if (isNextBuildProcess) {
  console.log('📌 Redis: Disabled during next build; cache calls will be skipped');
} else if (process.env.REDIS_URL) {
  console.log('📌 Redis: Using REDIS_URL from environment');
} else if (process.env.REDIS_CONNECTION_STRING) {
  console.log('📌 Redis: Using REDIS_CONNECTION_STRING from environment');
} else {
  console.log('⚠️  Redis: No environment variable found, using default localhost:6379');
  console.log('   Set REDIS_URL or REDIS_CONNECTION_STRING in .env.local');
}

// Log the connection URL (with password hidden) on startup
if (!isNextBuildProcess) {
  console.log(`🔗 Redis: Connection URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
}

// Redis client options
const redisOptions = {
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        // Stop trying after 3 attempts to reduce spam
        console.error('❌ Redis: Max reconnection attempts reached. Stopping reconnection attempts.');
        console.error('   The app will continue without Redis caching.');
        return false; // Stop reconnecting
      }
      // Exponential backoff: 2s, 4s, 8s
      return Math.min(2000 * Math.pow(2, retries), 8000);
    },
    connectTimeout: 10000,
  },
  // Disable offline queue to fail fast if Redis is unavailable
  enableOfflineQueue: false,
};

let redisClient = null;
let redisClientPromise = null;

/**
 * Get or create Redis client (singleton pattern)
 * @returns {Promise<RedisClient>}
 */
async function getRedisClient() {
  if (isNextBuildProcess) {
    return null;
  }

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient(redisOptions);
        
        client.on('error', (err) => {
          // Only log errors, don't spam on every reconnection attempt
          if (err.code === 'ECONNREFUSED') {
            console.error('❌ Redis: Connection refused. Check:');
            console.error('   1. Redis server is running and accessible');
            console.error('   2. Firewall allows connection to port 6379');
            console.error('   3. Connection string is correct');
            console.error(`   4. Server: ${redisUrl.split('@')[1] || redisUrl}`);
          } else {
            console.error('Redis Client Error:', err.message || err);
          }
        });

        client.on('connect', () => {
          console.log('🔄 Redis: Connecting...');
        });

        client.on('reconnecting', () => {
          // Suppress reconnection spam - only log first few attempts
          if (!client._reconnectAttempts) client._reconnectAttempts = 0;
          client._reconnectAttempts++;
          if (client._reconnectAttempts <= 3) {
            console.log(`🔄 Redis: Reconnecting... (attempt ${client._reconnectAttempts})`);
          }
        });

        client.on('ready', () => {
          console.log('✅ Redis: Ready and connected');
          console.log(`📍 Redis URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
        });

        await client.connect();
        redisClient = client;
        return client;
      } catch (error) {
        console.error('❌ Redis: Failed to connect');
        console.error(`   Error: ${error.message}`);
        console.error(`   Connection URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
        console.error('   The app will continue without Redis caching.');
        // Return null to allow graceful degradation
        redisClientPromise = null;
        return null;
      }
    })();
  }

  return redisClientPromise;
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
export async function getCache(key) {
  try {
    const client = await getRedisClient();
    if (!client) {
      console.log(`🔴 Redis: Cache MISS (Redis unavailable) - ${key}`);
      return null;
    }

    const value = await client.get(key);
    if (value) {
      console.log(`✅ Redis: Cache HIT - ${key}`);
      return JSON.parse(value);
    }
    console.log(`🔴 Redis: Cache MISS - ${key}`);
    return null;
  } catch (error) {
    console.error(`Redis: Error getting cache for key ${key}:`, error.message);
    console.log(`🔴 Redis: Cache MISS (Error) - ${key}`);
    return null; // Graceful degradation - return null on error
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
 * @returns {Promise<boolean>} - Success status
 */
export async function setCache(key, value, ttl = 3600) {
  try {
    const client = await getRedisClient();
    if (!client) {
      console.log(`⚠️  Redis: Cannot cache (Redis unavailable) - ${key}`);
      return false;
    }

    const serialized = JSON.stringify(value);
    await client.setEx(key, ttl, serialized);
    const ttlHours = (ttl / 3600).toFixed(1);
    console.log(`💾 Redis: Cache SET - ${key} (TTL: ${ttlHours}h)`);
    return true;
  } catch (error) {
    console.error(`Redis: Error setting cache for key ${key}:`, error.message);
    return false; // Graceful degradation - fail silently
  }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteCache(key) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Redis: Error deleting cache for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param {string} pattern - Redis key pattern (e.g., "cache:analyze-offtime:*")
 * @returns {Promise<number>} - Number of keys deleted
 */
export async function deleteCachePattern(pattern) {
  try {
    const client = await getRedisClient();
    if (!client) return 0;

    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;

    return await client.del(keys);
  } catch (error) {
    console.error(`Redis: Error deleting cache pattern ${pattern}:`, error.message);
    return 0;
  }
}

/**
 * Check if Redis is available
 * @returns {Promise<boolean>}
 */
export async function isRedisAvailable() {
  try {
    const client = await getRedisClient();
    return client !== null && client.isOpen;
  } catch {
    return false;
  }
}

/**
 * Generate cache key from parameters
 * @param {string} prefix - Key prefix (e.g., "analyze-offtime")
 * @param {object} params - Parameters to hash
 * @returns {string} - Cache key
 */
export function generateCacheKey(prefix, params) {
  // Sort params to ensure consistent keys
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  
  return `${prefix}:${sortedParams}`;
}

// Export client for advanced usage
export { getRedisClient };
