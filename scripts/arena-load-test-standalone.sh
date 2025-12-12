#!/bin/bash

# ============================================
# Arena Event - Test de Charge Complet
# ============================================
# Script autonome - fonctionne avec curl/jq/bc
# Peut être exécuté depuis n'importe quelle machine
# ============================================

# Configuration par défaut
API_URL="${API_URL:-https://api.arena-event.fr}"
TEST_DURATION="${TEST_DURATION:-60}"
CONCURRENT_USERS="${CONCURRENT_USERS:-50}"
REQUESTS_PER_SECOND="${REQUESTS_PER_SECOND:-20}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Initialiser fichiers
> "$TEMP_DIR/latencies.txt"
> "$TEMP_DIR/status_codes.txt"
> "$TEMP_DIR/errors.txt"
> "$TEMP_DIR/ws_results.txt"

# Variables
TOTAL_REQUESTS=0
TOTAL_SUCCESS=0
TOTAL_ERRORS=0
TEST_START_TIME=$(date +%s)

# ============================================
# FONCTIONS UTILITAIRES
# ============================================

print_header() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║         🎮 ARENA EVENT - TEST DE CHARGE COMPLET 🎮                 ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${BLUE}Configuration:${NC}"
    echo -e "  🌐 API URL:     ${CYAN}$API_URL${NC}"
    echo -e "  ⏱️  Durée:       ${CYAN}${TEST_DURATION}s${NC}"
    echo -e "  👥 Utilisateurs: ${CYAN}$CONCURRENT_USERS${NC}"
    echo -e "  🚀 Débit cible:  ${CYAN}$REQUESTS_PER_SECOND req/s${NC}"
    echo ""
}

check_deps() {
    local missing=()
    command -v curl &>/dev/null || missing+=("curl")
    command -v jq &>/dev/null || missing+=("jq")
    command -v bc &>/dev/null || missing+=("bc")

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Dépendances manquantes: ${missing[*]}${NC}"
        echo "Installation: sudo apt install curl jq bc"
        exit 1
    fi
    echo -e "${GREEN}✅ Dépendances OK${NC}"
}

format_duration() {
    local seconds=$1
    printf "%dm%02ds" $((seconds/60)) $((seconds%60))
}

# ============================================
# TESTS DE CONNECTIVITÉ
# ============================================

test_connectivity() {
    echo -e "\n${BOLD}━━━ TEST DE CONNECTIVITÉ ━━━${NC}"

    # Test Health
    echo -n "  Health endpoint... "
    local health_response
    health_response=$(curl -s -w "\n%{http_code}" --max-time 10 "$API_URL/health" 2>/dev/null)
    local health_code=$(echo "$health_response" | tail -1)
    local health_body=$(echo "$health_response" | head -n -1)

    if [ "$health_code" == "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        local status=$(echo "$health_body" | jq -r '.status // "unknown"' 2>/dev/null)
        echo -e "    Status: ${CYAN}$status${NC}"
    else
        echo -e "${RED}❌ ERREUR (code: $health_code)${NC}"
        exit 1
    fi

    # Test Metrics
    echo -n "  Metrics endpoint... "
    local metrics_response
    metrics_response=$(curl -s -w "\n%{http_code}" --max-time 10 "$API_URL/metrics" 2>/dev/null)
    local metrics_code=$(echo "$metrics_response" | tail -1)
    local metrics_body=$(echo "$metrics_response" | head -n -1)

    if [ "$metrics_code" == "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        local uptime=$(echo "$metrics_body" | jq -r '.uptimeFormatted // "unknown"' 2>/dev/null)
        local heap=$(echo "$metrics_body" | jq -r '.memory.heapUsedMB // 0' 2>/dev/null)
        echo -e "    Uptime: ${CYAN}$uptime${NC} | Heap: ${CYAN}${heap}MB${NC}"
    else
        echo -e "${YELLOW}⚠️ Non disponible${NC}"
    fi

    # Test Socket.IO
    echo -n "  Socket.IO polling... "
    local ws_response
    ws_response=$(curl -s --max-time 10 "$API_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null)

    if echo "$ws_response" | grep -q '"sid"'; then
        echo -e "${GREEN}✅ OK${NC}"
        local sid=$(echo "$ws_response" | grep -o '"sid":"[^"]*"' | cut -d'"' -f4)
        echo -e "    SID: ${CYAN}${sid:0:20}...${NC}"
    else
        echo -e "${YELLOW}⚠️ Non disponible${NC}"
    fi
}

# ============================================
# TEST DE LATENCE
# ============================================

test_latency() {
    echo -e "\n${BOLD}━━━ TEST DE LATENCE (10 requêtes) ━━━${NC}"

    local latencies=()
    for i in {1..10}; do
        local start_ns=$(date +%s%N)
        local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL/health" 2>/dev/null)
        local end_ns=$(date +%s%N)
        local latency_ms=$(( (end_ns - start_ns) / 1000000 ))

        if [ "$code" == "200" ]; then
            latencies+=($latency_ms)
            echo -e "  Requête $i: ${GREEN}${latency_ms}ms${NC}"
        else
            echo -e "  Requête $i: ${RED}ERREUR ($code)${NC}"
        fi
    done

    if [ ${#latencies[@]} -gt 0 ]; then
        local sum=0
        local min=${latencies[0]}
        local max=${latencies[0]}

        for lat in "${latencies[@]}"; do
            sum=$((sum + lat))
            [ $lat -lt $min ] && min=$lat
            [ $lat -gt $max ] && max=$lat
        done

        local avg=$((sum / ${#latencies[@]}))
        echo -e "\n  ${BOLD}Résumé:${NC} Min: ${CYAN}${min}ms${NC} | Moy: ${CYAN}${avg}ms${NC} | Max: ${CYAN}${max}ms${NC}"
    fi
}

# ============================================
# TEST DE CHARGE HTTP
# ============================================

http_worker() {
    local worker_id=$1
    local duration=$2
    local end_time=$(($(date +%s) + duration))
    local endpoints=("/health" "/metrics" "/api/sessions")

    while [ $(date +%s) -lt $end_time ]; do
        local endpoint="${endpoints[$((RANDOM % ${#endpoints[@]}))]}"
        local start_ns=$(date +%s%N)
        local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL$endpoint" 2>/dev/null || echo "000")
        local end_ns=$(date +%s%N)
        local latency_ms=$(( (end_ns - start_ns) / 1000000 ))

        echo "$latency_ms" >> "$TEMP_DIR/latencies.txt"
        echo "$code" >> "$TEMP_DIR/status_codes.txt"

        # Délai pour respecter le RPS cible
        local delay=$(echo "scale=3; 1 / ($REQUESTS_PER_SECOND / $CONCURRENT_USERS)" | bc)
        sleep "$delay" 2>/dev/null || sleep 0.1
    done
}

test_http_load() {
    echo -e "\n${BOLD}━━━ TEST DE CHARGE HTTP ━━━${NC}"
    echo -e "  Lancement de ${CYAN}$CONCURRENT_USERS${NC} workers pendant ${CYAN}${TEST_DURATION}s${NC}..."
    echo ""

    # Lancer les workers
    local pids=()
    for i in $(seq 1 $CONCURRENT_USERS); do
        http_worker $i $TEST_DURATION &
        pids+=($!)
    done

    # Afficher la progression
    local start_time=$(date +%s)
    while true; do
        local now=$(date +%s)
        local elapsed=$((now - start_time))

        if [ $elapsed -ge $TEST_DURATION ]; then
            break
        fi

        local requests=$(wc -l < "$TEMP_DIR/latencies.txt" 2>/dev/null || echo "0")
        local errors=$(grep -v "200\|401" "$TEMP_DIR/status_codes.txt" 2>/dev/null | wc -l || echo "0")
        local progress=$((elapsed * 100 / TEST_DURATION))
        local rps=0
        [ $elapsed -gt 0 ] && rps=$((requests / elapsed))

        # Barre de progression
        local bar_filled=$((progress / 2))
        local bar_empty=$((50 - bar_filled))
        local bar=$(printf "%${bar_filled}s" | tr ' ' '█')$(printf "%${bar_empty}s" | tr ' ' '░')

        printf "\r  [${bar}] ${progress}%% | Requêtes: ${requests} | Erreurs: ${errors} | RPS: ${rps}    "

        sleep 1
    done

    # Attendre la fin des workers
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null
    done

    echo ""
}

# ============================================
# TEST SOCKET.IO
# ============================================

socketio_client() {
    local client_id=$1
    local duration=$2
    local end_time=$(($(date +%s) + duration))
    local connections=0
    local polls=0

    while [ $(date +%s) -lt $end_time ]; do
        # Handshake
        local handshake=$(curl -s --max-time 5 "$API_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null)
        local sid=$(echo "$handshake" | grep -o '"sid":"[^"]*"' | cut -d'"' -f4 2>/dev/null)

        if [ -n "$sid" ]; then
            connections=$((connections + 1))

            # Maintenir la connexion
            for i in {1..10}; do
                [ $(date +%s) -ge $end_time ] && break
                curl -s --max-time 3 "$API_URL/socket.io/?EIO=4&transport=polling&sid=$sid" &>/dev/null
                polls=$((polls + 1))
                sleep 0.5
            done
        fi

        sleep 1
    done

    echo "$client_id:$connections:$polls" >> "$TEMP_DIR/ws_results.txt"
}

test_socketio_load() {
    local ws_clients=$((CONCURRENT_USERS / 2))
    [ $ws_clients -lt 5 ] && ws_clients=5

    echo -e "\n${BOLD}━━━ TEST SOCKET.IO (${ws_clients} clients) ━━━${NC}"

    local pids=()
    for i in $(seq 1 $ws_clients); do
        socketio_client $i $TEST_DURATION &
        pids+=($!)
    done

    # Attendre
    local start_time=$(date +%s)
    while true; do
        local now=$(date +%s)
        local elapsed=$((now - start_time))
        [ $elapsed -ge $TEST_DURATION ] && break

        local active=$(jobs -r | wc -l)
        printf "\r  Clients actifs: ${CYAN}$active${NC} | Temps restant: ${CYAN}$((TEST_DURATION - elapsed))s${NC}    "
        sleep 2
    done

    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null
    done

    echo ""
}

# ============================================
# GÉNÉRATION DU RAPPORT
# ============================================

generate_report() {
    echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}                    📊 RAPPORT DE PERFORMANCE 📊                      ${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local end_time=$(date +%s)
    local total_duration=$((end_time - TEST_START_TIME))

    # Stats HTTP
    local total_requests=$(wc -l < "$TEMP_DIR/latencies.txt" 2>/dev/null || echo "0")
    local success_count=$(grep -c "200\|401" "$TEMP_DIR/status_codes.txt" 2>/dev/null || echo "0")
    local error_count=$((total_requests - success_count))
    local error_rate=0
    [ $total_requests -gt 0 ] && error_rate=$(echo "scale=2; $error_count * 100 / $total_requests" | bc)
    local effective_rps=0
    [ $total_duration -gt 0 ] && effective_rps=$(echo "scale=1; $total_requests / $total_duration" | bc)

    # Latences
    local lat_min=0 lat_max=0 lat_avg=0 lat_p50=0 lat_p95=0 lat_p99=0
    if [ -s "$TEMP_DIR/latencies.txt" ]; then
        lat_min=$(sort -n "$TEMP_DIR/latencies.txt" | head -1)
        lat_max=$(sort -n "$TEMP_DIR/latencies.txt" | tail -1)
        lat_avg=$(awk '{ sum += $1 } END { if(NR>0) printf "%.0f", sum/NR; else print "0" }' "$TEMP_DIR/latencies.txt")

        local count=$(wc -l < "$TEMP_DIR/latencies.txt")
        local p50_idx=$((count * 50 / 100))
        local p95_idx=$((count * 95 / 100))
        local p99_idx=$((count * 99 / 100))
        [ $p50_idx -lt 1 ] && p50_idx=1
        [ $p95_idx -lt 1 ] && p95_idx=1
        [ $p99_idx -lt 1 ] && p99_idx=1

        lat_p50=$(sort -n "$TEMP_DIR/latencies.txt" | sed -n "${p50_idx}p")
        lat_p95=$(sort -n "$TEMP_DIR/latencies.txt" | sed -n "${p95_idx}p")
        lat_p99=$(sort -n "$TEMP_DIR/latencies.txt" | sed -n "${p99_idx}p")
    fi

    # Stats Socket.IO
    local ws_connections=0 ws_polls=0
    if [ -s "$TEMP_DIR/ws_results.txt" ]; then
        ws_connections=$(awk -F: '{ sum += $2 } END { print sum }' "$TEMP_DIR/ws_results.txt")
        ws_polls=$(awk -F: '{ sum += $3 } END { print sum }' "$TEMP_DIR/ws_results.txt")
    fi

    # Métriques serveur
    local server_metrics=$(curl -s --max-time 5 "$API_URL/metrics" 2>/dev/null || echo "{}")
    local server_heap=$(echo "$server_metrics" | jq -r '.memory.heapUsedMB // 0' 2>/dev/null)
    local server_rss=$(echo "$server_metrics" | jq -r '.memory.rssMB // 0' 2>/dev/null)
    local server_ws=$(echo "$server_metrics" | jq -r '.websocket.activeConnections // 0' 2>/dev/null)

    echo ""
    echo -e "${BOLD}⏱️  DURÉE DU TEST${NC}"
    echo -e "  Total: ${CYAN}$(format_duration $total_duration)${NC}"
    echo ""

    echo -e "${BOLD}🌐 REQUÊTES HTTP${NC}"
    echo -e "  ┌────────────────────┬────────────────────┐"
    printf "  │ Total              │ %-18s │\n" "$total_requests"
    printf "  │ Succès             │ ${GREEN}%-18s${NC} │\n" "$success_count"
    printf "  │ Erreurs            │ ${RED}%-18s${NC} │\n" "$error_count"
    printf "  │ Taux d'erreur      │ %-17s%% │\n" "$error_rate"
    printf "  │ Débit effectif     │ %-14s req/s │\n" "$effective_rps"
    echo -e "  └────────────────────┴────────────────────┘"
    echo ""

    echo -e "${BOLD}⚡ LATENCES (ms)${NC}"
    echo -e "  ┌────────────────────┬────────────────────┐"
    printf "  │ Min                │ ${CYAN}%-18s${NC} │\n" "${lat_min}ms"
    printf "  │ Max                │ ${CYAN}%-18s${NC} │\n" "${lat_max}ms"
    printf "  │ Moyenne            │ ${CYAN}%-18s${NC} │\n" "${lat_avg}ms"
    printf "  │ P50 (médiane)      │ ${CYAN}%-18s${NC} │\n" "${lat_p50}ms"
    printf "  │ P95                │ ${YELLOW}%-18s${NC} │\n" "${lat_p95}ms"
    printf "  │ P99                │ ${MAGENTA}%-18s${NC} │\n" "${lat_p99}ms"
    echo -e "  └────────────────────┴────────────────────┘"
    echo ""

    echo -e "${BOLD}🔌 SOCKET.IO${NC}"
    echo -e "  ┌────────────────────┬────────────────────┐"
    printf "  │ Connexions totales │ %-18s │\n" "$ws_connections"
    printf "  │ Polls effectués    │ %-18s │\n" "$ws_polls"
    printf "  │ Connexions actives │ %-18s │\n" "$server_ws"
    echo -e "  └────────────────────┴────────────────────┘"
    echo ""

    echo -e "${BOLD}🖥️  SERVEUR${NC}"
    echo -e "  ┌────────────────────┬────────────────────┐"
    printf "  │ Mémoire Heap       │ %-16sMB │\n" "$server_heap"
    printf "  │ Mémoire RSS        │ %-16sMB │\n" "$server_rss"
    echo -e "  └────────────────────┴────────────────────┘"
    echo ""

    # Verdict
    local verdict_color="${GREEN}"
    local verdict_text="✅ SUCCÈS"
    local verdict_emoji="🎉"

    if [ "$(echo "$error_rate > 5" | bc)" -eq 1 ]; then
        verdict_color="${RED}"
        verdict_text="❌ ÉCHEC"
        verdict_emoji="💥"
    elif [ "$(echo "$error_rate > 1" | bc)" -eq 1 ]; then
        verdict_color="${YELLOW}"
        verdict_text="⚠️ ATTENTION"
        verdict_emoji="⚠️"
    fi

    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${verdict_color}            VERDICT: $verdict_text $verdict_emoji${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Sauvegarder en JSON
    local report_file="/tmp/arena-load-report-$(date +%Y%m%d-%H%M%S).json"
    cat > "$report_file" << EOF
{
  "test_info": {
    "date": "$(date -Iseconds)",
    "api_url": "$API_URL",
    "duration_seconds": $total_duration,
    "concurrent_users": $CONCURRENT_USERS,
    "target_rps": $REQUESTS_PER_SECOND
  },
  "http_metrics": {
    "total_requests": $total_requests,
    "successful": $success_count,
    "errors": $error_count,
    "error_rate_percent": $error_rate,
    "effective_rps": $effective_rps
  },
  "latency_ms": {
    "min": $lat_min,
    "max": $lat_max,
    "avg": $lat_avg,
    "p50": $lat_p50,
    "p95": $lat_p95,
    "p99": $lat_p99
  },
  "websocket": {
    "total_connections": $ws_connections,
    "polls": $ws_polls,
    "server_active": $server_ws
  },
  "server": {
    "heap_mb": $server_heap,
    "rss_mb": $server_rss
  },
  "verdict": "$(echo $verdict_text | sed 's/[^a-zA-Z]//g')"
}
EOF

    echo ""
    echo -e "📄 Rapport JSON: ${CYAN}$report_file${NC}"
}

# ============================================
# AIDE
# ============================================

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL       URL de l'API (défaut: $API_URL)"
    echo "  -d, --duration SEC  Durée du test (défaut: $TEST_DURATION)"
    echo "  -c, --clients N     Utilisateurs simultanés (défaut: $CONCURRENT_USERS)"
    echo "  -r, --rps N         Requêtes/seconde cible (défaut: $REQUESTS_PER_SECOND)"
    echo "  -q, --quick         Test rapide (15s, 10 clients)"
    echo "  -f, --full          Test complet (120s, 100 clients)"
    echo "  -h, --help          Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 --quick                    # Test rapide"
    echo "  $0 -d 300 -c 100 -r 50        # 5 min, 100 clients, 50 req/s"
    echo "  $0 -u https://api.example.com # Tester une autre URL"
}

# ============================================
# MAIN
# ============================================

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url) API_URL="$2"; shift 2 ;;
        -d|--duration) TEST_DURATION="$2"; shift 2 ;;
        -c|--clients) CONCURRENT_USERS="$2"; shift 2 ;;
        -r|--rps) REQUESTS_PER_SECOND="$2"; shift 2 ;;
        -q|--quick) TEST_DURATION=15; CONCURRENT_USERS=10; REQUESTS_PER_SECOND=10; shift ;;
        -f|--full) TEST_DURATION=120; CONCURRENT_USERS=100; REQUESTS_PER_SECOND=50; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Option inconnue: $1"; show_help; exit 1 ;;
    esac
done

# Exécuter les tests
print_header
check_deps
test_connectivity
test_latency
test_http_load
test_socketio_load
generate_report

echo ""
echo -e "${GREEN}Test terminé !${NC}"
