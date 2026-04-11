# Redis Caching Guide

This guide explains how to use Redis caching in your API routes to reduce MongoDB load and improve response times.

## Setup

### 1. Install Redis

**Local Development:**
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest
```

**Production:**
- Use Redis Cloud (free tier available): https://redis.com/try-free/
- Or set up your own Redis server

### 2. Install Dependencies

```bash
npm install redis
```

### 3. Configure Environment Variables

Add to your `.env.local`:

```env
# Local Redis
REDIS_URL=redis://localhost:6379

# Redis Cloud or remote Redis
REDIS_URL=redis://username:password@host:port

# With SSL (Redis Cloud)
REDIS_URL=rediss://username:password@host:port
```

## Usage in API Routes

### Basic Example

```javascript
import { getCache, setCache, generateCacheKey } from "@/lib/redis";

export async function GET(request) {
  // Generate cache key from request parameters
  const cacheKey = generateCacheKey('my-endpoint', {
    param1: value1,
    param2: value2
  });
  
  // Try to get from cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  // If not cached, fetch from database
  const data = await db.collection('myCollection').findOne({ ... });
  
  // Cache the result (TTL in seconds)
  await setCache(cacheKey, data, 3600); // Cache for 1 hour
  
  return NextResponse.json(data);
}
```

### Cache TTL Guidelines

- **Static/rarely changing data**: 24 hours (86400 seconds)
  - Device settings
  - User profiles
  - Configuration data

- **Semi-static data**: 1-6 hours (3600-21600 seconds)
  - Past date queries (24 hours)
  - Today's data (1 hour)
  - Generated images (6 hours)

- **Dynamic data**: 5-30 minutes (300-1800 seconds)
  - Real-time data
  - Frequently updated data

### Advanced Example with Cache Invalidation

```javascript
import { getCache, setCache, deleteCache, deleteCachePattern } from "@/lib/redis";

export async function POST(request) {
  const { deviceNo, date } = await request.json();
  
  // Update database
  await db.collection('devicedatas').updateOne(
    { deviceno: deviceNo },
    { $set: { ... } }
  );
  
  // Invalidate related cache entries
  await deleteCachePattern(`graph-data:*deviceNo:${deviceNo}*`);
  await deleteCachePattern(`table-image:*deviceNo:${deviceNo}*`);
  
  return NextResponse.json({ success: true });
}
```

## Cache Key Best Practices

1. **Use descriptive prefixes**: `device-settings:`, `graph-data:`, `table-image:`
2. **Include all relevant parameters** in the cache key
3. **Use `generateCacheKey()` helper** for consistent key generation
4. **Keep keys short** but descriptive

## Monitoring Cache Performance

Check the `X-Cache` header in responses:
- `X-Cache: HIT` - Data served from cache (fast!)
- `X-Cache: MISS` - Data fetched from database

## Graceful Degradation

The Redis client is designed to gracefully degrade:
- If Redis is unavailable, the app continues working
- Cache operations return `null` or `false` on errors
- No exceptions are thrown that would break your API

## Example: Caching MongoDB Queries

```javascript
import { getCache, setCache, generateCacheKey } from "@/lib/redis";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const deviceNo = searchParams.get("deviceNo");
  const date = searchParams.get("date");
  
  // Generate cache key
  const cacheKey = generateCacheKey('device-data', { deviceNo, date });
  
  // Try cache first
  let data = await getCache(cacheKey);
  
  if (!data) {
    // Fetch from MongoDB
    const client = await clientPromise;
    const db = client.db(databaseName);
    data = await db.collection("devicedatas")
      .find({ deviceno: parseInt(deviceNo) })
      .toArray();
    
    // Cache for 1 hour
    await setCache(cacheKey, data, 3600);
  }
  
  return NextResponse.json(data);
}
```

## Cache Invalidation Strategies

### 1. Time-based (TTL)
- Let cache expire naturally
- Best for data that doesn't change frequently

### 2. Event-based
- Invalidate when data is updated
- Use `deleteCache()` or `deleteCachePattern()`

### 3. Hybrid
- Combine TTL with manual invalidation
- Best of both worlds

## Performance Benefits

With Redis caching enabled:
- **MongoDB queries**: Reduced by 70-90% for cached requests
- **Response times**: 10-100x faster for cached data
- **Database load**: Significantly reduced
- **Image generation**: Cached images served instantly

## Troubleshooting

### Redis Connection Issues

```javascript
import { isRedisAvailable } from "@/lib/redis";

// Check if Redis is available
if (await isRedisAvailable()) {
  // Use caching
} else {
  // Fallback to direct database queries
  console.warn('Redis not available, skipping cache');
}
```

### Clear All Cache (Development)

```bash
# Connect to Redis CLI
redis-cli

# Clear all keys (use with caution!)
FLUSHALL

# Or clear specific pattern
redis-cli --scan --pattern "graph-data:*" | xargs redis-cli DEL
```

## Production Considerations

1. **Use Redis Cloud** or managed Redis service for production
2. **Set appropriate memory limits** to prevent OOM
3. **Monitor cache hit rates** to optimize TTL values
4. **Use Redis persistence** (RDB or AOF) for important cache data
5. **Set up alerts** for Redis connection issues

