#!/bin/bash
# ============================================
# Arena Event - Test Script (sans Docker)
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# URLs par défaut (local)
API_URL="${API_URL:-http://localhost:3000}"

PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASSED++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAILED++)); }
info() { echo -e "${BLUE}►${NC} $1"; }

echo ""
echo "============================================"
echo "       Arena Event - Tests"
echo "============================================"
echo ""
echo "API: $API_URL"
echo ""

# ============================================
# Test 1: API Health
# ============================================
info "Test API Health..."
if curl -sf "$API_URL/health" > /dev/null 2>&1; then
    pass "API répond sur /health"
else
    fail "API ne répond pas"
fi

# ============================================
# Test 2: WebSocket (Socket.io polling)
# ============================================
info "Test WebSocket..."
WS_RESPONSE=$(curl -s "$API_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "")
if [[ "$WS_RESPONSE" == "0{"* ]] || [[ "$WS_RESPONSE" == *"sid"* ]]; then
    pass "WebSocket fonctionne (Socket.io)"
else
    fail "WebSocket ne répond pas"
fi

# ============================================
# Test 3: Base de données (via /events)
# ============================================
info "Test Database..."
EVENTS=$(curl -s "$API_URL/events" 2>/dev/null)
if echo "$EVENTS" | grep -q "\[" 2>/dev/null; then
    pass "Database connectée (/events OK)"
else
    fail "Database non accessible"
fi

# ============================================
# Test 4: Sessions endpoint
# ============================================
info "Test Sessions..."
SESSIONS=$(curl -s "$API_URL/sessions" 2>/dev/null)
if echo "$SESSIONS" | grep -q "\[" 2>/dev/null; then
    pass "Endpoint /sessions OK"
else
    fail "Endpoint /sessions KO"
fi

# ============================================
# Test 5: Auth (doit retourner 401)
# ============================================
info "Test Auth protection..."
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/users/me" 2>/dev/null)
if [ "$AUTH_STATUS" = "401" ]; then
    pass "Auth protection active (401)"
else
    fail "Auth non protégée (status: $AUTH_STATUS)"
fi

# ============================================
# Test 6: Créer une session complète
# ============================================
info "Test flow complet..."

# Login admin
LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@arena-event.fr","password":"admin123"}' 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    pass "Login admin OK"

    # Créer un event
    EVENT_RESP=$(curl -s -X POST "$API_URL/events" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"name":"Test Event '$(date +%s)'","description":"Test"}' 2>/dev/null)

    EVENT_ID=$(echo "$EVENT_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$EVENT_ID" ]; then
        pass "Création event OK"

        # Créer une session
        SESSION_RESP=$(curl -s -X POST "$API_URL/sessions" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{"eventId":"'"$EVENT_ID"'"}' 2>/dev/null)

        SESSION_CODE=$(echo "$SESSION_RESP" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)

        if [ -n "$SESSION_CODE" ]; then
            pass "Création session OK (code: $SESSION_CODE)"
        else
            fail "Création session KO"
        fi
    else
        fail "Création event KO"
    fi
else
    echo -e "${YELLOW}⚠${NC} Login admin impossible (user non créé?)"
fi

# ============================================
# Test 7: Frontends (si lancés)
# ============================================
echo ""
info "Test des frontends..."

for port in 3002 3003 3004 3005; do
    name=""
    case $port in
        3002) name="Admin" ;;
        3003) name="Player" ;;
        3004) name="Screen" ;;
        3005) name="Studio" ;;
    esac

    if curl -sf "http://localhost:$port" > /dev/null 2>&1; then
        pass "$name (port $port) accessible"
    else
        echo -e "${YELLOW}⚠${NC} $name (port $port) non lancé"
    fi
done

# ============================================
# Résumé
# ============================================
echo ""
echo "============================================"
echo "              Résumé"
echo "============================================"
echo ""
echo -e "  ${GREEN}Passés:${NC}  $PASSED"
echo -e "  ${RED}Échoués:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Tous les tests critiques sont passés!${NC}"
    exit 0
else
    echo -e "${RED}$FAILED test(s) échoué(s)${NC}"
    exit 1
fi
