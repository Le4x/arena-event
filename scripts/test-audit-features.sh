#!/bin/bash

# ============================================
# Arena Event - Script de Test des Fonctionnalités Audit
# ============================================
# Ce script teste toutes les optimisations implémentées:
# - Health check & Metrics
# - CORS configuration
# - Upload validation
# - Timer sync (via WebSocket)
# - Session cleanup tracking
# ============================================

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Fonction pour afficher un header
print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} ${BOLD}$1${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Fonction pour afficher un sous-titre
print_section() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo -e "${YELLOW}────────────────────────────────────────${NC}"
}

# Fonction pour afficher le résultat d'un test
test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$1" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "  ${GREEN}✓ PASS${NC} - $2"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "  ${RED}✗ FAIL${NC} - $2"
        if [ -n "$3" ]; then
            echo -e "    ${RED}↳ $3${NC}"
        fi
    fi
}

# Fonction pour afficher des données JSON formatées
print_json() {
    echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

# Vérifier que le serveur est accessible
check_server() {
    print_header "VÉRIFICATION DU SERVEUR"

    echo -e "${BLUE}Tentative de connexion à ${API_URL}...${NC}"

    if curl -s --connect-timeout 5 "${API_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Serveur accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ Serveur inaccessible à ${API_URL}${NC}"
        echo -e "${YELLOW}Assurez-vous que le serveur est démarré avec: cd simple-api && npm start${NC}"
        exit 1
    fi
}

# ============================================
# TEST 1: Health Check
# ============================================
test_health_check() {
    print_header "TEST 1: HEALTH CHECK ENDPOINT"

    print_section "GET /health"
    echo -e "${BLUE}Requête:${NC} curl ${API_URL}/health"
    echo ""

    RESPONSE=$(curl -s "${API_URL}/health")
    echo -e "${BLUE}Réponse:${NC}"
    print_json "$RESPONSE"
    echo ""

    # Vérifier le statut
    STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" = "healthy" ]; then
        test_result "PASS" "Health check retourne status: healthy"
    else
        test_result "FAIL" "Health check status invalide" "Attendu: healthy, Reçu: $STATUS"
    fi

    # Vérifier l'uptime
    UPTIME=$(echo "$RESPONSE" | grep -o '"uptime":[0-9]*' | cut -d':' -f2)
    if [ -n "$UPTIME" ]; then
        test_result "PASS" "Uptime présent: ${UPTIME}s"
    else
        test_result "FAIL" "Uptime manquant dans la réponse"
    fi
}

# ============================================
# TEST 2: Metrics Endpoint
# ============================================
test_metrics() {
    print_header "TEST 2: METRICS ENDPOINT"

    print_section "GET /metrics"
    echo -e "${BLUE}Requête:${NC} curl ${API_URL}/metrics"
    echo ""

    RESPONSE=$(curl -s "${API_URL}/metrics")
    echo -e "${BLUE}Réponse complète:${NC}"
    print_json "$RESPONSE"
    echo ""

    # Vérifier les différentes sections
    print_section "Analyse des métriques"

    # Uptime
    if echo "$RESPONSE" | grep -q '"uptimeFormatted"'; then
        UPTIME_FMT=$(echo "$RESPONSE" | grep -o '"uptimeFormatted":"[^"]*"' | cut -d'"' -f4)
        test_result "PASS" "Uptime formaté: $UPTIME_FMT"
    else
        test_result "FAIL" "Uptime formaté manquant"
    fi

    # Requests
    if echo "$RESPONSE" | grep -q '"requests"'; then
        TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
        ERRORS=$(echo "$RESPONSE" | grep -o '"errors":[0-9]*' | head -1 | cut -d':' -f2)
        test_result "PASS" "Compteur requêtes: total=$TOTAL, errors=$ERRORS"
    else
        test_result "FAIL" "Compteurs de requêtes manquants"
    fi

    # WebSocket
    if echo "$RESPONSE" | grep -q '"websocket"'; then
        CONNECTIONS=$(echo "$RESPONSE" | grep -o '"activeConnections":[0-9]*' | cut -d':' -f2)
        test_result "PASS" "Connexions WebSocket actives: $CONNECTIONS"
    else
        test_result "FAIL" "Métriques WebSocket manquantes"
    fi

    # Sessions
    if echo "$RESPONSE" | grep -q '"sessions"'; then
        TIMERS=$(echo "$RESPONSE" | grep -o '"activeTimers":[0-9]*' | cut -d':' -f2)
        BUZZERS=$(echo "$RESPONSE" | grep -o '"activeBuzzerStates":[0-9]*' | cut -d':' -f2)
        test_result "PASS" "État sessions: timers=$TIMERS, buzzers=$BUZZERS"
    else
        test_result "FAIL" "Métriques sessions manquantes"
    fi

    # Memory
    if echo "$RESPONSE" | grep -q '"memory"'; then
        HEAP=$(echo "$RESPONSE" | grep -o '"heapUsedMB":[0-9]*' | cut -d':' -f2)
        RSS=$(echo "$RESPONSE" | grep -o '"rssMB":[0-9]*' | cut -d':' -f2)
        test_result "PASS" "Mémoire: heap=${HEAP}MB, rss=${RSS}MB"
    else
        test_result "FAIL" "Métriques mémoire manquantes"
    fi

    # Latency
    if echo "$RESPONSE" | grep -q '"latency"'; then
        AVG=$(echo "$RESPONSE" | grep -o '"avgMs":[0-9]*' | cut -d':' -f2)
        MAX=$(echo "$RESPONSE" | grep -o '"maxMs":[0-9]*' | cut -d':' -f2)
        test_result "PASS" "Latence: avg=${AVG}ms, max=${MAX}ms"
    else
        test_result "FAIL" "Métriques latence manquantes"
    fi
}

# ============================================
# TEST 3: CORS Configuration
# ============================================
test_cors() {
    print_header "TEST 3: CONFIGURATION CORS"

    print_section "Test CORS avec origine autorisée"
    echo -e "${BLUE}Requête:${NC} curl -H 'Origin: https://player.arena-event.fr' ${API_URL}/health"
    echo ""

    HEADERS=$(curl -s -I -H "Origin: https://player.arena-event.fr" "${API_URL}/health" 2>&1)
    echo -e "${BLUE}Headers de réponse:${NC}"
    echo "$HEADERS" | grep -i "access-control" || echo "(aucun header CORS)"
    echo ""

    if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
        test_result "PASS" "Headers CORS présents"
    else
        test_result "FAIL" "Headers CORS manquants"
    fi

    print_section "Test CORS Preflight (OPTIONS)"
    echo -e "${BLUE}Requête:${NC} curl -X OPTIONS -H 'Origin: https://player.arena-event.fr' ${API_URL}/api/auth/login"
    echo ""

    PREFLIGHT=$(curl -s -I -X OPTIONS \
        -H "Origin: https://player.arena-event.fr" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        "${API_URL}/api/auth/login" 2>&1)
    echo -e "${BLUE}Headers Preflight:${NC}"
    echo "$PREFLIGHT" | grep -i "access-control" || echo "(aucun header CORS)"
    echo ""

    if echo "$PREFLIGHT" | grep -qi "access-control-allow-methods"; then
        test_result "PASS" "Preflight CORS configuré"
    else
        test_result "FAIL" "Preflight CORS non configuré"
    fi
}

# ============================================
# TEST 4: Upload Validation
# ============================================
test_upload_validation() {
    print_header "TEST 4: VALIDATION DES UPLOADS"

    print_section "Test upload avec extension invalide"
    echo -e "${BLUE}Requête:${NC} POST /api/upload avec fichier .exe"
    echo ""

    RESPONSE=$(curl -s -X POST "${API_URL}/api/upload" \
        -H "Content-Type: application/json" \
        -d '{"filename": "malware.exe", "data": "data:application/octet-stream;base64,dGVzdA==", "type": "audio"}')

    echo -e "${BLUE}Réponse:${NC}"
    print_json "$RESPONSE"
    echo ""

    if echo "$RESPONSE" | grep -qi "invalid file extension"; then
        test_result "PASS" "Extension .exe rejetée correctement"
    else
        test_result "FAIL" "Extension .exe devrait être rejetée"
    fi

    print_section "Test upload avec MIME type invalide"
    echo -e "${BLUE}Requête:${NC} POST /api/upload avec MIME type application/javascript"
    echo ""

    RESPONSE=$(curl -s -X POST "${API_URL}/api/upload" \
        -H "Content-Type: application/json" \
        -d '{"filename": "test.mp3", "data": "data:application/javascript;base64,dGVzdA==", "type": "audio"}')

    echo -e "${BLUE}Réponse:${NC}"
    print_json "$RESPONSE"
    echo ""

    if echo "$RESPONSE" | grep -qi "invalid file type"; then
        test_result "PASS" "MIME type application/javascript rejeté"
    else
        test_result "FAIL" "MIME type invalide devrait être rejeté"
    fi

    print_section "Test upload valide (petit fichier audio)"
    echo -e "${BLUE}Requête:${NC} POST /api/upload avec fichier .mp3 valide"
    echo ""

    # Créer un petit fichier audio base64 valide (juste pour le test)
    RESPONSE=$(curl -s -X POST "${API_URL}/api/upload" \
        -H "Content-Type: application/json" \
        -d '{"filename": "test.mp3", "data": "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNNPHZAAAAAAAAAAAAAAAAAAAAAAD/+9DEAAAIAANIAAAACAADSAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQxBQAAADSAAAAAAAAANIAAAAA", "type": "audio"}')

    echo -e "${BLUE}Réponse:${NC}"
    print_json "$RESPONSE"
    echo ""

    if echo "$RESPONSE" | grep -qi '"url"'; then
        test_result "PASS" "Upload MP3 valide accepté"
    else
        test_result "FAIL" "Upload MP3 valide devrait être accepté"
    fi
}

# ============================================
# TEST 5: API Endpoints de base
# ============================================
test_api_endpoints() {
    print_header "TEST 5: ENDPOINTS API DE BASE"

    print_section "GET /api/events"
    RESPONSE=$(curl -s "${API_URL}/api/events")
    echo -e "${BLUE}Réponse:${NC}"
    print_json "$RESPONSE" | head -20
    echo ""

    if echo "$RESPONSE" | grep -qE '^\[|"id"'; then
        test_result "PASS" "Endpoint /api/events fonctionnel"
    else
        test_result "FAIL" "Endpoint /api/events non fonctionnel"
    fi

    print_section "GET /api/sessions"
    RESPONSE=$(curl -s "${API_URL}/api/sessions")
    echo -e "${BLUE}Réponse:${NC}"
    print_json "$RESPONSE" | head -20
    echo ""

    if echo "$RESPONSE" | grep -qE '^\[|"id"'; then
        test_result "PASS" "Endpoint /api/sessions fonctionnel"
    else
        test_result "FAIL" "Endpoint /api/sessions non fonctionnel"
    fi
}

# ============================================
# TEST 6: WebSocket Connection Test
# ============================================
test_websocket() {
    print_header "TEST 6: TEST CONNEXION WEBSOCKET"

    print_section "Vérification Socket.IO"
    echo -e "${BLUE}Requête:${NC} GET ${API_URL}/socket.io/?EIO=4&transport=polling"
    echo ""

    RESPONSE=$(curl -s "${API_URL}/socket.io/?EIO=4&transport=polling")
    echo -e "${BLUE}Réponse:${NC}"
    echo "$RESPONSE" | head -c 200
    echo ""
    echo ""

    if echo "$RESPONSE" | grep -q "sid"; then
        test_result "PASS" "Socket.IO répond (session ID reçu)"
    else
        test_result "FAIL" "Socket.IO ne répond pas correctement"
    fi
}

# ============================================
# TEST 7: Charge simulée (latence)
# ============================================
test_load() {
    print_header "TEST 7: TEST DE CHARGE SIMPLE"

    print_section "Envoi de 20 requêtes rapides"
    echo -e "${BLUE}Mesure de la latence sur 20 requêtes /health...${NC}"
    echo ""

    TOTAL_TIME=0
    MIN_TIME=99999
    MAX_TIME=0

    for i in {1..20}; do
        START=$(date +%s%N)
        curl -s "${API_URL}/health" > /dev/null
        END=$(date +%s%N)
        DURATION=$(( (END - START) / 1000000 ))
        TOTAL_TIME=$((TOTAL_TIME + DURATION))

        if [ $DURATION -lt $MIN_TIME ]; then MIN_TIME=$DURATION; fi
        if [ $DURATION -gt $MAX_TIME ]; then MAX_TIME=$DURATION; fi

        echo -ne "\r  Requête $i/20 - ${DURATION}ms"
    done

    AVG_TIME=$((TOTAL_TIME / 20))
    echo ""
    echo ""
    echo -e "${BLUE}Résultats:${NC}"
    echo -e "  Min: ${MIN_TIME}ms"
    echo -e "  Max: ${MAX_TIME}ms"
    echo -e "  Moyenne: ${AVG_TIME}ms"
    echo ""

    if [ $AVG_TIME -lt 100 ]; then
        test_result "PASS" "Latence moyenne acceptable (${AVG_TIME}ms < 100ms)"
    elif [ $AVG_TIME -lt 500 ]; then
        test_result "PASS" "Latence moyenne correcte (${AVG_TIME}ms < 500ms)"
    else
        test_result "FAIL" "Latence moyenne trop élevée (${AVG_TIME}ms)"
    fi

    print_section "Vérification des métriques après charge"
    METRICS=$(curl -s "${API_URL}/metrics")
    echo -e "${BLUE}Métriques mises à jour:${NC}"
    echo "$METRICS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  Requêtes totales: {d['requests']['total']}\"); print(f\"  Latence avg: {d['latency']['avgMs']}ms\"); print(f\"  Latence max: {d['latency']['maxMs']}ms\")" 2>/dev/null || print_json "$METRICS"
}

# ============================================
# RÉSUMÉ FINAL
# ============================================
print_summary() {
    print_header "RÉSUMÉ DES TESTS"

    echo -e "  ${BOLD}Tests totaux:${NC}  $TOTAL_TESTS"
    echo -e "  ${GREEN}Réussis:${NC}       $PASSED_TESTS"
    echo -e "  ${RED}Échoués:${NC}       $FAILED_TESTS"
    echo ""

    PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ TOUS LES TESTS PASSENT - PRÊT POUR LA PRODUCTION!        ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    elif [ $PERCENTAGE -ge 80 ]; then
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  ⚠ ${PERCENTAGE}% des tests passent - Vérifiez les échecs ci-dessus      ║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ✗ ATTENTION: Seulement ${PERCENTAGE}% des tests passent                  ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    fi
    echo ""
}

# ============================================
# MAIN
# ============================================
main() {
    clear
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║   🎮 ARENA EVENT - TEST DES FONCTIONNALITÉS AUDIT           ║"
    echo "║                                                              ║"
    echo "║   Version 2.1.0 - Tests des optimisations production        ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${YELLOW}API URL: ${API_URL}${NC}"
    echo -e "${YELLOW}Date: $(date)${NC}"
    echo ""

    # Vérifier le serveur
    check_server

    # Exécuter tous les tests
    test_health_check
    test_metrics
    test_cors
    test_upload_validation
    test_api_endpoints
    test_websocket
    test_load

    # Afficher le résumé
    print_summary
}

# Exécuter le script
main "$@"
