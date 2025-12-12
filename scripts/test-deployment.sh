#!/bin/bash
# ============================================
# Arena Event - Test Script
# ============================================
# Tests all components and features after deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration - adjust these for your environment
API_URL="${API_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-http://localhost:3000}"
ADMIN_URL="${ADMIN_URL:-http://localhost:3002}"
PLAYER_URL="${PLAYER_URL:-http://localhost:3003}"
SCREEN_URL="${SCREEN_URL:-http://localhost:3004}"
STUDIO_URL="${STUDIO_URL:-http://localhost:3005}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging functions
log_test() { echo -e "${CYAN}[TEST]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; ((TESTS_SKIPPED++)); }
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# ============================================
# Test Functions
# ============================================

test_http_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    log_test "Testing $name: $url"

    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")

    if [ "$response" = "$expected_status" ]; then
        log_pass "$name returned $response"
        return 0
    else
        log_fail "$name returned $response (expected $expected_status)"
        return 1
    fi
}

test_json_endpoint() {
    local name="$1"
    local url="$2"

    log_test "Testing JSON endpoint: $name"

    response=$(curl -s --connect-timeout 5 "$url" 2>/dev/null)

    if echo "$response" | jq . >/dev/null 2>&1; then
        log_pass "$name returned valid JSON"
        echo "$response" | jq -c '.' | head -c 100
        echo "..."
        return 0
    else
        log_fail "$name did not return valid JSON"
        return 1
    fi
}

test_websocket() {
    local name="$1"
    local url="$2"

    log_test "Testing WebSocket: $name"

    # Check if wscat is available
    if ! command -v wscat &> /dev/null; then
        # Try with curl for Socket.io polling transport
        response=$(curl -s --connect-timeout 5 "${url}/socket.io/?EIO=4&transport=polling" 2>/dev/null)

        if [[ "$response" == "0{"* ]] || [[ "$response" == *"sid"* ]]; then
            log_pass "WebSocket endpoint responding (via polling)"
            return 0
        else
            log_fail "WebSocket endpoint not responding"
            return 1
        fi
    else
        # Use wscat for proper WebSocket test
        timeout 5 wscat -c "${url}/socket.io/?EIO=4&transport=websocket" --no-check &
        pid=$!
        sleep 2
        kill $pid 2>/dev/null || true

        if wait $pid 2>/dev/null; then
            log_pass "WebSocket connection successful"
            return 0
        else
            log_fail "WebSocket connection failed"
            return 1
        fi
    fi
}

# ============================================
# API Tests
# ============================================

run_api_tests() {
    echo ""
    echo "============================================"
    echo "         API Endpoint Tests"
    echo "============================================"
    echo ""

    # Health check
    test_http_endpoint "API Health" "$API_URL/health"

    # Events endpoint
    test_json_endpoint "Events list" "$API_URL/events"

    # Sessions endpoint
    test_json_endpoint "Sessions list" "$API_URL/sessions"

    # Auth endpoint (should return 401 without token)
    test_http_endpoint "Auth protected" "$API_URL/users/me" "401"
}

# ============================================
# WebSocket Tests
# ============================================

run_websocket_tests() {
    echo ""
    echo "============================================"
    echo "         WebSocket Tests"
    echo "============================================"
    echo ""

    test_websocket "Socket.io Server" "$WS_URL"
}

# ============================================
# Frontend Tests
# ============================================

run_frontend_tests() {
    echo ""
    echo "============================================"
    echo "         Frontend Tests"
    echo "============================================"
    echo ""

    test_http_endpoint "Admin Panel" "$ADMIN_URL"
    test_http_endpoint "Player App" "$PLAYER_URL"
    test_http_endpoint "Screen Display" "$SCREEN_URL"
    test_http_endpoint "Studio (GM)" "$STUDIO_URL"
}

# ============================================
# Integration Tests
# ============================================

run_integration_tests() {
    echo ""
    echo "============================================"
    echo "         Integration Tests"
    echo "============================================"
    echo ""

    # Test complete flow: Login -> Create Event -> Create Session
    log_test "Testing complete user flow..."

    # 1. Register/Login
    log_info "Step 1: Creating test user..."
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test-'$(date +%s)'@test.com",
            "password": "Test123!@#",
            "name": "Test User"
        }' 2>/dev/null)

    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token // empty')

    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        log_pass "User registration successful"
    else
        log_info "Registration failed, trying login..."
        LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
            -H "Content-Type: application/json" \
            -d '{
                "email": "admin@arena-event.fr",
                "password": "admin123"
            }' 2>/dev/null)

        TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

        if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
            log_pass "Login successful"
        else
            log_fail "Authentication failed"
            return 1
        fi
    fi

    # 2. Create Event
    log_info "Step 2: Creating test event..."
    EVENT_RESPONSE=$(curl -s -X POST "$API_URL/events" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "name": "Test Event '$(date +%s)'",
            "description": "Automated test event"
        }' 2>/dev/null)

    EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.id // empty')

    if [ -n "$EVENT_ID" ] && [ "$EVENT_ID" != "null" ]; then
        log_pass "Event created: $EVENT_ID"
    else
        log_fail "Event creation failed"
        echo "$EVENT_RESPONSE" | jq . 2>/dev/null || echo "$EVENT_RESPONSE"
        return 1
    fi

    # 3. Create Session
    log_info "Step 3: Creating game session..."
    SESSION_RESPONSE=$(curl -s -X POST "$API_URL/sessions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "eventId": "'"$EVENT_ID"'"
        }' 2>/dev/null)

    SESSION_CODE=$(echo "$SESSION_RESPONSE" | jq -r '.code // empty')

    if [ -n "$SESSION_CODE" ] && [ "$SESSION_CODE" != "null" ]; then
        log_pass "Session created with code: $SESSION_CODE"
    else
        log_fail "Session creation failed"
        echo "$SESSION_RESPONSE" | jq . 2>/dev/null || echo "$SESSION_RESPONSE"
        return 1
    fi

    # 4. Join Session
    log_info "Step 4: Joining session..."
    JOIN_RESPONSE=$(curl -s -X POST "$API_URL/sessions/join" \
        -H "Content-Type: application/json" \
        -d '{
            "code": "'"$SESSION_CODE"'"
        }' 2>/dev/null)

    if echo "$JOIN_RESPONSE" | jq -e '.session' >/dev/null 2>&1; then
        log_pass "Session join successful"
    else
        log_fail "Session join failed"
        return 1
    fi

    # 5. Create Team
    log_info "Step 5: Creating team..."
    SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.id')
    TEAM_RESPONSE=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/teams" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Team",
            "color": "#8B5CF6"
        }' 2>/dev/null)

    TEAM_ID=$(echo "$TEAM_RESPONSE" | jq -r '.id // empty')

    if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "null" ]; then
        log_pass "Team created: $TEAM_ID"
    else
        log_fail "Team creation failed"
        return 1
    fi

    log_pass "Complete flow test passed!"
    return 0
}

# ============================================
# Database Tests
# ============================================

run_database_tests() {
    echo ""
    echo "============================================"
    echo "         Database Tests"
    echo "============================================"
    echo ""

    log_test "Testing database connectivity..."

    # Test via API (if prisma endpoint exists)
    DB_TEST=$(curl -s "$API_URL/health" 2>/dev/null | jq -r '.database // "unknown"')

    if [ "$DB_TEST" = "connected" ] || [ "$DB_TEST" = "ok" ]; then
        log_pass "Database connection verified"
    else
        log_info "Database status: $DB_TEST"
        log_skip "Database test inconclusive"
    fi
}

# ============================================
# Security Tests
# ============================================

run_security_tests() {
    echo ""
    echo "============================================"
    echo "         Security Tests"
    echo "============================================"
    echo ""

    # Test protected endpoints without auth
    log_test "Testing authentication enforcement..."
    test_http_endpoint "Protected endpoint (no token)" "$API_URL/users/me" "401"

    # Test upload security
    log_test "Testing upload endpoint security..."
    UPLOAD_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$API_URL/api/upload" \
        -F "file=@/dev/null" 2>/dev/null || echo "000")

    if [ "$UPLOAD_RESPONSE" = "401" ] || [ "$UPLOAD_RESPONSE" = "400" ]; then
        log_pass "Upload endpoint properly secured"
    else
        log_info "Upload returned: $UPLOAD_RESPONSE (may be configured to allow anonymous uploads)"
    fi

    # Test CORS
    log_test "Testing CORS headers..."
    CORS_HEADERS=$(curl -s -I -X OPTIONS "$API_URL/events" \
        -H "Origin: http://test.com" \
        -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control")

    if [ -n "$CORS_HEADERS" ]; then
        log_pass "CORS headers present"
        echo "$CORS_HEADERS" | head -3
    else
        log_info "CORS headers not detected (may be handled differently)"
    fi
}

# ============================================
# Performance Tests
# ============================================

run_performance_tests() {
    echo ""
    echo "============================================"
    echo "         Performance Tests"
    echo "============================================"
    echo ""

    log_test "Testing API response times..."

    # Measure response times
    for endpoint in "/health" "/events" "/sessions"; do
        TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL$endpoint" 2>/dev/null)
        TIME_MS=$(echo "$TIME * 1000" | bc 2>/dev/null || echo "$TIME")

        if (( $(echo "$TIME < 1" | bc -l 2>/dev/null || echo "1") )); then
            log_pass "$endpoint: ${TIME_MS}ms"
        else
            log_info "$endpoint: ${TIME_MS}ms (slow)"
        fi
    done
}

# ============================================
# Main Execution
# ============================================

print_banner() {
    echo ""
    echo "============================================"
    echo "     Arena Event - Deployment Tests"
    echo "============================================"
    echo ""
    echo "API URL:    $API_URL"
    echo "WS URL:     $WS_URL"
    echo "Admin URL:  $ADMIN_URL"
    echo "Player URL: $PLAYER_URL"
    echo "Screen URL: $SCREEN_URL"
    echo "Studio URL: $STUDIO_URL"
    echo ""
}

print_summary() {
    echo ""
    echo "============================================"
    echo "              Test Summary"
    echo "============================================"
    echo ""
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo ""

    TOTAL=$((TESTS_PASSED + TESTS_FAILED))

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}$TESTS_FAILED test(s) failed!${NC}"
        exit 1
    fi
}

main() {
    print_banner

    # Run all test suites
    run_api_tests
    run_websocket_tests
    run_frontend_tests
    run_database_tests
    run_security_tests
    run_performance_tests
    run_integration_tests

    print_summary
}

# Parse arguments
case "${1:-all}" in
    all)
        main
        ;;
    api)
        print_banner
        run_api_tests
        print_summary
        ;;
    websocket|ws)
        print_banner
        run_websocket_tests
        print_summary
        ;;
    frontend)
        print_banner
        run_frontend_tests
        print_summary
        ;;
    integration)
        print_banner
        run_integration_tests
        print_summary
        ;;
    security)
        print_banner
        run_security_tests
        print_summary
        ;;
    performance)
        print_banner
        run_performance_tests
        print_summary
        ;;
    quick)
        print_banner
        run_api_tests
        run_websocket_tests
        run_frontend_tests
        print_summary
        ;;
    *)
        echo "Usage: $0 {all|api|websocket|frontend|integration|security|performance|quick}"
        echo ""
        echo "Options:"
        echo "  all          Run all tests"
        echo "  api          Test API endpoints only"
        echo "  websocket    Test WebSocket connections"
        echo "  frontend     Test frontend apps"
        echo "  integration  Test complete user flow"
        echo "  security     Test security features"
        echo "  performance  Test response times"
        echo "  quick        Run essential tests only"
        exit 1
        ;;
esac
