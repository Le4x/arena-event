#!/bin/bash

# Simple Redis Integration Script
set -e

cd /root/arena-event/simple-api

echo "🔧 Integrating Redis into API..."

# 1. Backup
cp index.js index.js.backup-$(date +%Y%m%d-%H%M%S)
echo "✅ Backup created"

# 2. Add Redis import after Socket.io import
sed -i "/import { Server } from 'socket.io';/a import { setupSocketIORedisAdapter, createRedisClient, RedisCache } from './redis-config.js';" index.js
echo "✅ Added Redis import"

# 3. Find line number where Socket.io is initialized
LINE_NUM=$(grep -n "const io = new Server(httpServer" index.js | cut -d: -f1)

# 4. Find the end of the Server initialization (look for the closing })
END_LINE=$((LINE_NUM + 10))  # Assume it's within 10 lines

# 5. Create the Redis initialization code
cat > /tmp/redis-init.txt << 'EOF'

// ========================================
// Redis Integration for Multi-Instance Support
// ========================================
let redisClient = null;
let redisCache = null;

// Initialize Redis adapter asynchronously
(async () => {
  try {
    console.log('🔧 Initializing Redis for multi-instance support...');

    // Setup Socket.io Redis Adapter
    await setupSocketIORedisAdapter(io);

    // Create Redis client for caching
    redisClient = await createRedisClient();
    redisCache = new RedisCache(redisClient);

    console.log('✅ Redis integration complete');
    console.log('   ├─ Socket.io Redis Adapter: Active');
    console.log('   ├─ Redis Cache: Ready');
    console.log('   └─ Multi-instance WebSocket: Enabled');

  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    console.log('⚠️  Running in single-instance mode (Redis not available)');
  }
})();
// ========================================

EOF

# 6. Insert after the io initialization
# Find the line with });  that closes the Server config
CLOSING_LINE=$(awk '/const io = new Server/,/^  \}\);/{if (/^  \}\);/) print NR}' index.js | head -1)

if [ -n "$CLOSING_LINE" ]; then
  # Insert after the closing line
  sed -i "${CLOSING_LINE}r /tmp/redis-init.txt" index.js
  echo "✅ Redis initialization code inserted at line $CLOSING_LINE"
else
  echo "⚠️  Could not find insertion point, trying alternative..."
  # Alternative: insert after line 30 (approximate location)
  sed -i "30r /tmp/redis-init.txt" index.js
fi

rm /tmp/redis-init.txt

echo ""
echo "✅ Redis integration complete!"
echo ""
echo "📋 Restart the API to apply changes:"
echo "   pm2 restart arena-api"
echo "   pm2 logs arena-api --lines 30"
echo ""
