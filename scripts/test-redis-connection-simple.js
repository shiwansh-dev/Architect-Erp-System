// Quick Redis connection test
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

// Read .env.local
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
    console.error('Error reading .env.local:', e.message);
  }
}

if (!redisUrl) {
  console.error('❌ No Redis URL found in environment variables');
  process.exit(1);
}

console.log('🔍 Testing Redis connection...');
console.log('📍 URL:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const client = createClient({ 
  url: redisUrl,
  socket: {
    connectTimeout: 5000,
  }
});

client.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.error('\n❌ Connection Refused!');
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if Redis server is running');
    console.error('   2. Verify the IP address and port are correct');
    console.error('   3. Check firewall rules (port 6379)');
    console.error('   4. Test network connectivity:');
    console.error(`      telnet ${redisUrl.split('@')[1]?.split(':')[0] || 'localhost'} 6379`);
    console.error('   5. Verify password is correct');
  } else {
    console.error('❌ Error:', err.message);
  }
  process.exit(1);
});

async function test() {
  try {
    console.log('🔄 Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const pong = await client.ping();
    console.log('✅ PING:', pong);
    
    await client.quit();
    console.log('✅ Connection test passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

test();

