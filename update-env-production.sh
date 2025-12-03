#!/bin/bash

# Script to update .env files for production deployment
# Run this on your VPS after cloning the repository

echo "🔧 Updating environment variables for production..."

# Simple API .env
cat > simple-api/.env << 'EOF'
PORT=3001
HOST=0.0.0.0
DATABASE_URL="postgresql://arena_user:ArenaEvent2024!@localhost:5432/arena_event"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(date +%s)
JWT_EXPIRES_IN=7d
CORS_ORIGINS=*
API_BASE_URL=https://api.arena-event.com
EOF

# Web Admin .env.local
cat > apps/web-admin/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.arena-event.com
NEXT_PUBLIC_STUDIO_URL=https://studio.arena-event.com
NEXT_PUBLIC_PLAYER_URL=https://player.arena-event.com
NEXT_PUBLIC_SCREEN_URL=https://screen.arena-event.com
EOF

# Web Player .env.local
cat > apps/web-player/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.arena-event.com
EOF

# Web Screen .env.local
cat > apps/web-screen/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.arena-event.com
NEXT_PUBLIC_PLAYER_URL=https://player.arena-event.com
EOF

# Web Studio .env.local
cat > apps/web-studio/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.arena-event.com
NEXT_PUBLIC_ADMIN_URL=https://admin.arena-event.com
NEXT_PUBLIC_SCREEN_URL=https://screen.arena-event.com
NEXT_PUBLIC_PLAYER_URL=https://player.arena-event.com
EOF

echo "✅ Environment variables updated for production!"
echo ""
echo "⚠️  IMPORTANT: Change the JWT_SECRET in simple-api/.env to a secure random value!"
echo "⚠️  IMPORTANT: Update the database password if needed!"
