// Simple Redis connection test
// Usage: REDIS_CONNECTION_STRING=redis://... node scripts/test-redis.js
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

// Try to read .env.local file
let redisUrl = process.env.REDIS_CONNECTION_STRING || process.env.REDIS_URL;

if (!redisUrl) {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/REDIS_CONNECTION_STRING=(.+)/);
      if (match) {
        redisUrl = match[1].trim();
      } else {
        const match2 = envContent.match(/REDIS_URL=(.+)/);
        if (match2) {
          redisUrl = match2[1].trim();
        }
      }
    }
  } catch (e) {
    // Ignore
  }
}

if (!redisUrl) {
  redisUrl = 'redis://localhost:6379';
  console.log('⚠️  No Redis URL found, using default:', redisUrl);
}

console.log('🔍 Testing Redis connection...');
console.log('📍 Connection URL:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

async function testRedis() {
  const client = createClient({ url: redisUrl });

  client.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
  });

  try {
    console.log('🔄 Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Test operations
    console.log('\n📝 Testing operations...');
    
    await client.set('test:key', 'test:value');
    const value = await client.get('test:key');
    console.log('✅ SET/GET test:', value === 'test:value' ? 'PASSED' : 'FAILED');
    
    await client.del('test:key');
    console.log('✅ DELETE test: PASSED');
    
    const pong = await client.ping();
    console.log('✅ PING test:', pong === 'PONG' ? 'PASSED' : 'FAILED');
    
    console.log('\n🎉 All tests passed! Redis is ready to use.');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('\n💡 Check:');
    console.error('   1. Redis server is running');
    console.error('   2. REDIS_CONNECTION_STRING in .env.local is correct');
    console.error('   3. Network/firewall allows connection');
    console.error('   4. Password is correct');
    process.exit(1);
  } finally {
    if (client.isOpen) {
      await client.quit();
      console.log('\n👋 Disconnected');
    }
  }
}

testRedis();
