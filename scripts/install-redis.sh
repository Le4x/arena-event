#!/bin/bash

# Arena Event - Redis Installation Script
set -e

echo "🔧 Installing Redis..."

# Install Redis
apt update
apt install -y redis-server

# Configure Redis for production
cat > /etc/redis/redis.conf << 'EOF'
# Redis Configuration for Arena Event
bind 127.0.0.1
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (optional - for session persistence across reboots)
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Performance
databases 16
EOF

# Restart Redis with new config
systemctl restart redis-server
systemctl enable redis-server

# Verify Redis is running
redis-cli ping

echo "✅ Redis installed and configured!"
echo "   - Host: localhost"
echo "   - Port: 6379"
echo "   - Max Memory: 256MB"
