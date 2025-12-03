#!/bin/bash

# Arena Event - Redis Integration Script
# Integrates Redis adapter into the API for multi-instance support

set -e

echo "🔧 Integrating Redis into Arena Event API..."
echo "=============================================="

cd /root/arena-event/simple-api

# Backup original file
cp index.js index.js.backup
echo "✅ Backup created: index.js.backup"

# Create a temporary file with the integration
cat > redis-integration.js << 'INTEGRATION_EOF'
// Redis Integration for Socket.io
import { setupSocketIORedisAdapter, createRedisClient, RedisCache } from './redis-config.js';

// Global Redis client and cache
let redisClient = null;
let redisCache = null;

// Initialize Redis
async function initializeRedis(io) {
  try {
    console.log('🔧 Initializing Redis...');

    // Setup Socket.io Redis Adapter
    await setupSocketIORedisAdapter(io);

    // Create Redis client for caching
    redisClient = await createRedisClient();
    redisCache = new (await import('./redis-config.js')).RedisCache(redisClient);

    console.log('✅ Redis integration complete');
    console.log('   - Socket.io Redis Adapter: Active');
    console.log('   - Redis Cache: Ready');
    console.log('   - Multi-instance support: Enabled');

    return { redisClient, redisCache };
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    console.log('⚠️  Continuing without Redis (single instance mode)');
    return { redisClient: null, redisCache: null };
  }
}

export { initializeRedis, redisClient, redisCache };
INTEGRATION_EOF

echo "✅ Redis integration module created"

# Now create a patch script that will insert the Redis initialization
node << 'NODE_EOF'
import { readFileSync, writeFileSync } from 'fs';

const indexJs = readFileSync('index.js', 'utf-8');
const lines = indexJs.split('\n');

let modified = false;
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);

  // After Socket.io import, add Redis import
  if (lines[i].includes("import { Server } from 'socket.io'") && !modified) {
    newLines.push("import { setupSocketIORedisAdapter, createRedisClient, RedisCache } from './redis-config.js';");
    console.log('✅ Added Redis import');
  }

  // After Socket.io server creation, add Redis initialization
  if (lines[i].includes('const io = new Server(httpServer') && !modified) {
    // Find the closing of the Server() constructor
    let j = i;
    while (j < lines.length && !lines[j].includes('});')) {
      newLines.push(lines[++j]);
    }
    newLines.push(lines[++j]); // Add the closing line

    // Now add Redis initialization
    newLines.push('');
    newLines.push('// Initialize Redis adapter for multi-instance support');
    newLines.push('let redisClient = null;');
    newLines.push('let redisCache = null;');
    newLines.push('');
    newLines.push('(async () => {');
    newLines.push('  try {');
    newLines.push("    console.log('🔧 Setting up Redis adapter...');");
    newLines.push('    await setupSocketIORedisAdapter(io);');
    newLines.push('    redisClient = await createRedisClient();');
    newLines.push('    redisCache = new RedisCache(redisClient);');
    newLines.push("    console.log('✅ Redis adapter configured');");
    newLines.push('  } catch (error) {');
    newLines.push("    console.error('❌ Redis setup failed:', error);");
    newLines.push("    console.log('⚠️  Running in single-instance mode');");
    newLines.push('  }');
    newLines.push('})();');
    newLines.push('');

    i = j; // Skip the lines we already added
    modified = true;
    console.log('✅ Added Redis initialization');
  }
}

if (modified) {
  writeFileSync('index.js', newLines.join('\n'));
  console.log('✅ index.js updated with Redis integration');
} else {
  console.log('⚠️  Could not find insertion point');
  process.exit(1);
}
NODE_EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Redis integration successful!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Restart PM2: pm2 restart arena-api"
  echo "2. Check logs: pm2 logs arena-api"
  echo "3. Verify Redis: redis-cli monitor"
  echo ""
  echo "To rollback: cp index.js.backup index.js && pm2 restart arena-api"
else
  echo "❌ Integration failed - restoring backup"
  cp index.js.backup index.js
  exit 1
fi
