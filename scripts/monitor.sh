#!/bin/bash

# Arena Event - Real-time Monitoring Script
# Shows live stats for all services

echo "🎮 Arena Event - Live Monitoring Dashboard"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service status
check_service() {
    service=$1
    if systemctl is-active --quiet $service; then
        echo -e "${GREEN}✓${NC} $service: Running"
    else
        echo -e "${RED}✗${NC} $service: Stopped"
    fi
}

# System Info
echo -e "${YELLOW}System Resources:${NC}"
echo "  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "  Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "  Disk: $(df -h / | awk '/\// {print $3 "/" $2 " (" $5 " used)"}')"
echo ""

# Services Status
echo -e "${YELLOW}Services Status:${NC}"
check_service "nginx"
check_service "postgresql"
check_service "redis-server"
echo ""

# PM2 Processes
echo -e "${YELLOW}PM2 Processes:${NC}"
pm2 jlist | jq -r '.[] | "  \(.name): \(.pm2_env.status) | CPU: \(.monit.cpu)% | Memory: \(.monit.memory / 1024 / 1024 | floor)MB | Restarts: \(.pm2_env.restart_time)"' 2>/dev/null || pm2 list
echo ""

# Redis Stats
echo -e "${YELLOW}Redis Statistics:${NC}"
redis-cli INFO stats | grep -E "^(total_connections_received|total_commands_processed|instantaneous_ops_per_sec|keyspace_hits|keyspace_misses)" | sed 's/^/  /'
echo ""

# Database Connections
echo -e "${YELLOW}Database Connections:${NC}"
PGPASSWORD='ArenaEvent2024!' psql -U arena_user -d arena_event -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'arena_event';" | sed 's/^/  Active connections: /'
echo ""

# Active Sessions
echo -e "${YELLOW}Active Game Sessions:${NC}"
PGPASSWORD='ArenaEvent2024!' psql -U arena_user -d arena_event -t -c "SELECT COUNT(*) FROM sessions WHERE status IN ('LOBBY', 'ACTIVE', 'PAUSED');" | sed 's/^/  Sessions: /'
PGPASSWORD='ArenaEvent2024!' psql -U arena_user -d arena_event -t -c "SELECT COUNT(*) FROM teams;" | sed 's/^/  Total Teams: /'
echo ""

# Nginx Connections
echo -e "${YELLOW}Nginx Connections:${NC}"
echo "  $(curl -s http://localhost/nginx_status 2>/dev/null | grep -E "Active connections" || echo "Status page not enabled")"
echo ""

# Recent Logs (last 5 errors)
echo -e "${YELLOW}Recent API Errors (last 5):${NC}"
pm2 logs arena-api --err --lines 5 --nostream 2>/dev/null | tail -n 5 | sed 's/^/  /'
echo ""

echo "=========================================="
echo "Run 'pm2 monit' for interactive monitoring"
echo "Run 'pm2 logs' for live log streaming"
echo "Run 'redis-cli monitor' for Redis monitoring"
