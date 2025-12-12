#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Arena Event - Load Test Runner
# ═══════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./run-test.sh                    # Default: 100 WS, 200 HTTP, 2 minutes
#   ./run-test.sh light              # Light: 50 WS, 100 HTTP, 1 minute
#   ./run-test.sh heavy              # Heavy: 200 WS, 500 HTTP, 5 minutes
#   ./run-test.sh stress             # Stress: 500 WS, 1000 HTTP, 10 minutes
#   ./run-test.sh custom 100 200 120 # Custom: WS, HTTP, Duration(s)
#
# ═══════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Default configuration
API_URL="${API_URL:-http://localhost:3001}"

# Parse profile
PROFILE="${1:-default}"

case "$PROFILE" in
    light)
        WS_CLIENTS=50
        HTTP_CLIENTS=100
        DURATION=60
        RAMP_UP=15
        ;;
    default)
        WS_CLIENTS=100
        HTTP_CLIENTS=200
        DURATION=120
        RAMP_UP=30
        ;;
    heavy)
        WS_CLIENTS=200
        HTTP_CLIENTS=500
        DURATION=300
        RAMP_UP=60
        ;;
    stress)
        WS_CLIENTS=500
        HTTP_CLIENTS=1000
        DURATION=600
        RAMP_UP=120
        ;;
    custom)
        WS_CLIENTS="${2:-100}"
        HTTP_CLIENTS="${3:-200}"
        DURATION="${4:-120}"
        RAMP_UP="${5:-30}"
        ;;
    *)
        echo -e "${RED}Unknown profile: $PROFILE${NC}"
        echo "Usage: $0 [light|default|heavy|stress|custom WS HTTP DURATION RAMP_UP]"
        exit 1
        ;;
esac

echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🚀 ARENA EVENT - LOAD TEST RUNNER${NC}"
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Profile:          ${YELLOW}${PROFILE}${NC}"
echo -e "  API URL:          ${GREEN}${API_URL}${NC}"
echo -e "  WebSocket Clients: ${GREEN}${WS_CLIENTS}${NC}"
echo -e "  HTTP Clients:      ${GREEN}${HTTP_CLIENTS}${NC}"
echo -e "  Duration:          ${GREEN}${DURATION}s${NC}"
echo -e "  Ramp-up:           ${GREEN}${RAMP_UP}s${NC}"
echo ""

# Check if API is reachable
echo -e "${YELLOW}Checking API availability...${NC}"
if ! curl -s --connect-timeout 5 "${API_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: API is not reachable at ${API_URL}${NC}"
    echo "Please ensure the API is running and accessible."
    exit 1
fi
echo -e "${GREEN}API is reachable${NC}"
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo ""
fi

# System info before test
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📊 SYSTEM STATE BEFORE TEST${NC}"
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}CPU Load:${NC}"
uptime
echo ""
echo -e "  ${YELLOW}Memory:${NC}"
free -h | grep -E "Mem|Swap"
echo ""
echo -e "  ${YELLOW}Connections:${NC}"
ss -s | grep -E "TCP|estab" || echo "  (ss not available)"
echo ""

# Increase file descriptor limits if possible
ulimit -n 65535 2>/dev/null || true

# Run the test
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🏃 STARTING LOAD TEST${NC}"
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

API_URL="$API_URL" \
WS_URL="$API_URL" \
WS_CLIENTS="$WS_CLIENTS" \
HTTP_CLIENTS="$HTTP_CLIENTS" \
DURATION="$DURATION" \
RAMP_UP="$RAMP_UP" \
node load-test.js

EXIT_CODE=$?

# System info after test
echo ""
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📊 SYSTEM STATE AFTER TEST${NC}"
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}CPU Load:${NC}"
uptime
echo ""
echo -e "  ${YELLOW}Memory:${NC}"
free -h | grep -E "Mem|Swap"
echo ""

# List generated reports
echo -e "  ${YELLOW}Generated Reports:${NC}"
ls -la load-test-report-*.json 2>/dev/null || echo "  (No reports found)"
echo ""

exit $EXIT_CODE
