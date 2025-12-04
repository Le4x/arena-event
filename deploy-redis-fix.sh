#!/bin/bash
set -e

echo "🚀 Deploying Redis Integration + Bug Fixes"
echo "=========================================="

cd /root/arena-event

echo ""
echo "📥 Step 1: Pulling latest changes..."
git stash
git fetch origin claude/fix-bugs-stabilize-019kR1jS3zCKExSCV2n3oTFt
git checkout claude/fix-bugs-stabilize-019kR1jS3zCKExSCV2n3oTFt
git pull origin claude/fix-bugs-stabilize-019kR1jS3zCKExSCV2n3oTFt

echo ""
echo "📦 Step 2: Installing/updating dependencies..."
cd simple-api
npm install

echo ""
echo "🔍 Step 3: Checking Redis..."
if ! systemctl is-active --quiet redis-server; then
  echo "⚠️  Redis is not running. Starting Redis..."
  sudo systemctl start redis-server
  sudo systemctl enable redis-server
fi
redis-cli ping || echo "❌ Redis connection failed!"

echo ""
echo "🔄 Step 4: Restarting API with PM2..."
cd /root/arena-event
pm2 restart arena-api
sleep 3

echo ""
echo "📊 Step 5: Checking API logs..."
pm2 logs arena-api --lines 30 --nostream

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Expected in logs:"
echo "  - '✅ Socket.IO Redis Adapter configured'"
echo "  - '✅ Redis cache initialized'"
echo "  - 'Multi-instance support: ✅'"
echo ""
echo "Test the fixes:"
echo "  1. Teams showing online/offline correctly"
echo "  2. Real-time sync across studio/player/screen"
echo "  3. Automatic points during reveal"
echo "  4. No duplicate answer errors"
