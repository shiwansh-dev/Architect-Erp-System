// scripts/test-redis-connection.js
// Test script to verify Redis connection
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || 'redis://localhost:6379';

console.log('Testing Redis connection...');
console.log('Connection URL:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs

async function testConnection() {
  let client = null;
  
  try {
    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
      }
    });

    client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });

    client.on('connect', () => {
      console.log('🔄 Redis: Connecting...');
    });

    client.on('ready', () => {
      console.log('✅ Redis: Ready');
    });

    console.log('Connecting to Redis...');
    await client.connect();

    // Test basic operations
    console.log('\n📝 Testing cache operations...');
    
    // Test SET
    const testKey = 'test:connection';
    const testValue = { message: 'Hello Redis!', timestamp: Date.now() };
    await client.setEx(testKey, 60, JSON.stringify(testValue));
    console.log('✅ SET operation successful');

    // Test GET
    const retrieved = await client.get(testKey);
    if (retrieved) {
      const parsed = JSON.parse(retrieved);
      console.log('✅ GET operation successful');
      console.log('   Retrieved value:', parsed);
    }

    // Test DELETE
    await client.del(testKey);
    console.log('✅ DELETE operation successful');

    // Test PING
    const pong = await client.ping();
    console.log('✅ PING operation successful:', pong);

    console.log('\n🎉 All Redis operations working correctly!');
    console.log('✅ Redis connection is ready for use in your application.');

  } catch (error) {
    console.error('\n❌ Redis connection failed:');
    console.error('   Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if Redis server is running');
    console.error('   2. Verify REDIS_URL or REDIS_CONNECTION_STRING in .env.local');
    console.error('   3. Check firewall/network settings');
    console.error('   4. Verify password is correct');
    process.exit(1);
  } finally {
    if (client && client.isOpen) {
      await client.quit();
      console.log('\n👋 Disconnected from Redis');
    }
  }
}

testConnection();

