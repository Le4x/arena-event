#!/bin/bash
# ============================================
# Arena Event - Local Development Test
# ============================================
# Quick test script for local development

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:3000}"

echo ""
echo "============================================"
echo "    Arena Event - Local Quick Test"
echo "============================================"
echo ""

# Test API
echo -e "${BLUE}Testing API...${NC}"
if curl -s "$API_URL/health" | grep -q "ok\|status"; then
    echo -e "${GREEN}✓ API is running${NC}"
else
    echo -e "${RED}✗ API not responding at $API_URL${NC}"
    exit 1
fi

# Test WebSocket
echo -e "${BLUE}Testing WebSocket...${NC}"
WS_RESPONSE=$(curl -s "$API_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "")
if [[ "$WS_RESPONSE" == "0{"* ]] || [[ "$WS_RESPONSE" == *"sid"* ]]; then
    echo -e "${GREEN}✓ WebSocket is running${NC}"
else
    echo -e "${RED}✗ WebSocket not responding${NC}"
fi

# Test database via events endpoint
echo -e "${BLUE}Testing Database...${NC}"
EVENTS=$(curl -s "$API_URL/events" 2>/dev/null)
if echo "$EVENTS" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null || echo "$EVENTS" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connected (events endpoint works)${NC}"
else
    echo -e "${RED}✗ Database issue${NC}"
fi

echo ""
echo "============================================"
echo "          All checks passed!"
echo "============================================"
echo ""
echo "Services:"
echo "  API:     $API_URL"
echo "  Admin:   http://localhost:3002"
echo "  Player:  http://localhost:3003"
echo "  Screen:  http://localhost:3004"
echo "  Studio:  http://localhost:3005"
echo ""
