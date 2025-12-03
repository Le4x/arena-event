#!/bin/bash

# Arena Event - Deployment Script for VPS
# This script sets up and deploys Arena Event on a fresh VPS

set -e  # Exit on any error

echo "🚀 Arena Event Deployment Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

echo -e "${GREEN}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}Step 2: Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${GREEN}Step 3: Installing PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib

echo -e "${GREEN}Step 4: Installing Nginx...${NC}"
apt install -y nginx

echo -e "${GREEN}Step 5: Installing PM2...${NC}"
npm install -g pm2

echo -e "${GREEN}Step 6: Setting up PostgreSQL database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE arena_event;" || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER arena_user WITH ENCRYPTED PASSWORD 'ArenaEvent2024!';" || echo "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE arena_event TO arena_user;"
sudo -u postgres psql -c "ALTER DATABASE arena_event OWNER TO arena_user;"

echo -e "${GREEN}Step 7: Installing dependencies...${NC}"
cd /root/arena-event || exit 1
npm install

echo -e "${GREEN}Step 8: Installing dependencies for simple-api...${NC}"
cd simple-api
npm install
cd ..

echo -e "${GREEN}Step 9: Building all applications...${NC}"
cd apps/web-admin && npm install && npm run build && cd ../..
cd apps/web-player && npm install && npm run build && cd ../..
cd apps/web-screen && npm install && npm run build && cd ../..
cd apps/web-studio && npm install && npm run build && cd ../..

echo -e "${GREEN}Step 10: Running database migrations...${NC}"
cd simple-api
npx prisma migrate deploy || npx prisma db push
npx prisma generate
cd ..

echo -e "${GREEN}Step 11: Creating PM2 ecosystem file...${NC}"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'arena-api',
      cwd: './simple-api',
      script: 'index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'arena-admin',
      cwd: './apps/web-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'arena-studio',
      cwd: './apps/web-studio',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },
    {
      name: 'arena-player',
      cwd: './apps/web-player',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      }
    },
    {
      name: 'arena-screen',
      cwd: './apps/web-screen',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3004',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      }
    }
  ]
};
EOF

echo -e "${GREEN}Step 12: Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/arena-event << 'EOF'
# API
server {
    listen 80;
    server_name api.arena-event.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin
server {
    listen 80;
    server_name admin.arena-event.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Studio
server {
    listen 80;
    server_name studio.arena-event.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Player
server {
    listen 80;
    server_name player.arena-event.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Screen
server {
    listen 80;
    server_name screen.arena-event.com;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Main domain redirect to admin
server {
    listen 80;
    server_name arena-event.com www.arena-event.com;
    return 301 http://admin.arena-event.com$request_uri;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/arena-event /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

echo -e "${GREEN}Step 13: Restarting Nginx...${NC}"
systemctl restart nginx
systemctl enable nginx

echo -e "${GREEN}Step 14: Starting applications with PM2...${NC}"
pm2 delete all || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Configure your DNS records to point to this server"
echo "2. Install SSL certificates with: sudo certbot --nginx"
echo "3. Check application status: pm2 status"
echo "4. View logs: pm2 logs"
echo ""
echo -e "${YELLOW}🌐 Your applications will be available at:${NC}"
echo "   - Admin:  https://admin.arena-event.com"
echo "   - API:    https://api.arena-event.com"
echo "   - Studio: https://studio.arena-event.com"
echo "   - Player: https://player.arena-event.com"
echo "   - Screen: https://screen.arena-event.com"
echo ""
