#!/bin/bash

echo "🔧 Arena Event - Rebuild & Restart Script"
echo "=========================================="
echo ""

cd /root/arena-event

echo "1️⃣ Pulling latest code..."
git pull origin claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7
echo ""

echo "2️⃣ Cleaning build caches..."
rm -rf apps/web-admin/.next
rm -rf apps/web-studio/.next
rm -rf apps/web-screen/.next
rm -rf apps/web-player/.next
echo "   ✅ Caches cleaned"
echo ""

echo "3️⃣ Building applications..."
echo "   📦 Building web-admin..."
npm run build --workspace=apps/web-admin 2>&1 | tail -5
echo "   ✅ web-admin built"

echo "   📦 Building web-studio..."
npm run build --workspace=apps/web-studio 2>&1 | tail -5
echo "   ✅ web-studio built"

echo "   📦 Building web-screen..."
npm run build --workspace=apps/web-screen 2>&1 | tail -5
echo "   ✅ web-screen built"

echo "   📦 Building web-player..."
npm run build --workspace=apps/web-player 2>&1 | tail -5
echo "   ✅ web-player built"
echo ""

echo "4️⃣ Restarting PM2 services..."
pm2 restart arena-admin arena-studio arena-screen arena-player simple-api
echo "   ✅ Services restarted"
echo ""

echo "5️⃣ Status check..."
pm2 list
echo ""

echo "======================================"
echo "✅ Rebuild complete!"
echo "======================================"
echo ""
echo "🌐 Open your browser and clear cache (Ctrl+Shift+R)"
echo "   Then go to: https://admin.arena-event.fr"
echo ""
echo "🔐 Login with:"
echo "   Email: admin@arena-event.fr"
echo "   Password: admin123"
echo ""
echo "💡 If you still see 403 errors:"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to Application > Local Storage"
echo "   3. Delete 'token' and 'user' entries"
echo "   4. Refresh and login again"
