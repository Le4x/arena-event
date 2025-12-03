#!/bin/bash

# Arena Event - Deploy Performance Optimizations
# This script applies all performance improvements for 60+ team support

set -e

echo "🚀 Arena Event - Performance Optimization Deployment"
echo "===================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running from correct directory
if [ ! -f "simple-api/index.js" ]; then
    echo "❌ Error: Must run from /root/arena-event directory"
    exit 1
fi

echo -e "${GREEN}Step 1: Installing Redis...${NC}"
bash scripts/install-redis.sh

echo ""
echo -e "${GREEN}Step 2: Installing Redis dependencies in API...${NC}"
cd simple-api
npm install redis @socket.io/redis-adapter ioredis
cd ..

echo ""
echo -e "${GREEN}Step 3: Optimizing database with indexes...${NC}"
PGPASSWORD='ArenaEvent2024!' psql -U arena_user -d arena_event -f scripts/optimize-database.sql

echo ""
echo -e "${GREEN}Step 4: Updating Nginx configuration...${NC}"
cp nginx-production.conf /etc/nginx/sites-available/arena-event
nginx -t
systemctl reload nginx

echo ""
echo -e "${GREEN}Step 5: Stopping current PM2 processes...${NC}"
pm2 delete all || true

echo ""
echo -e "${GREEN}Step 6: Starting with new clustered configuration...${NC}"
pm2 start ecosystem.production.js
pm2 save

echo ""
echo -e "${GREEN}Step 7: Setting up PM2 startup script...${NC}"
pm2 startup systemd -u root --hp /root

echo ""
echo -e "${GREEN}✅ Optimization deployment complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Current Configuration:${NC}"
echo "  - Redis: Running on localhost:6379"
echo "  - API Instances: 2 (clustered)"
echo "  - Load Balancing: IP Hash (sticky sessions)"
echo "  - WebSocket: Redis adapter enabled"
echo "  - Database: Optimized with indexes"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Monitor PM2 status: pm2 status"
echo "2. View PM2 logs: pm2 logs"
echo "3. Monitor Redis: redis-cli monitor"
echo "4. Check metrics: pm2 monit"
echo ""
echo -e "${YELLOW}🔍 Testing Commands:${NC}"
echo "  # Check Redis connection"
echo "  redis-cli ping"
echo ""
echo "  # Monitor API logs"
echo "  pm2 logs arena-api"
echo ""
echo "  # View PM2 monitoring dashboard"
echo "  pm2 monit"
echo ""
echo "  # Check Nginx upstream status"
echo "  curl -I https://api.arena-event.fr"
echo ""
