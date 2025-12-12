#!/bin/bash

# ============================================
# Arena Event - Test de Charge Soutenue
# ============================================
# Simule une situation réelle avec joueurs connectés
# pendant une durée prolongée avec monitoring continu
# ============================================

set -e

# Configuration
API_URL="${API_URL:-https://api.music-blind-test.fr}"
TEST_DURATION="${TEST_DURATION:-300}"  # 5 minutes par défaut (en secondes)
WS_CLIENTS="${WS_CLIENTS:-50}"         # Clients WebSocket simultanés
HTTP_RPS="${HTTP_RPS:-10}"             # Requêtes HTTP par seconde
SAMPLE_INTERVAL="${SAMPLE_INTERVAL:-5}" # Intervalle d'échantillonnage (secondes)
REPORT_FILE="${REPORT_FILE:-/tmp/arena-sustained-report-$(date +%Y%m%d-%H%M%S).json}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Variables globales
TEMP_DIR=$(mktemp -d)
WS_PIDS=()
HTTP_PID=""
START_TIME=$(date +%s)
TOTAL_REQUESTS=0
TOTAL_ERRORS=0
LATENCY_SAMPLES=()
MEMORY_SAMPLES=()
CPU_SAMPLES=()
CONNECTION_SAMPLES=()

# Initialiser les fichiers de log immédiatement
touch "$TEMP_DIR/http_success.log"
touch "$TEMP_DIR/http_errors.log"
touch "$TEMP_DIR/http_latencies.log"
touch "$TEMP_DIR/ws_reconnects.log"
touch "$TEMP_DIR/ws_success.log"
touch "$TEMP_DIR/samples.csv"

# Nettoyage à la sortie
cleanup() {
    echo -e "\n${YELLOW}Arrêt des tests...${NC}"

    # Arrêter tous les clients WebSocket
    for pid in "${WS_PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done

    # Arrêter le générateur HTTP
    if [ -n "$HTTP_PID" ]; then
        kill "$HTTP_PID" 2>/dev/null || true
    fi

    # Tuer tous les processus curl restants du test
    pkill -f "curl.*socket.io.*load-test" 2>/dev/null || true

    # Générer le rapport final
    generate_report

    # Nettoyer les fichiers temporaires
    rm -rf "$TEMP_DIR"

    echo -e "${GREEN}Nettoyage terminé${NC}"
}

trap cleanup EXIT INT TERM

# Affichage du header
print_header() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║           ARENA EVENT - TEST DE CHARGE SOUTENUE                  ║"
    echo "║                    Simulation Production                          ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${BLUE}Configuration:${NC}"
    echo -e "  API URL:        ${CYAN}$API_URL${NC}"
    echo -e "  Durée:          ${CYAN}${TEST_DURATION}s ($(( TEST_DURATION / 60 ))min)${NC}"
    echo -e "  Clients WS:     ${CYAN}$WS_CLIENTS${NC}"
    echo -e "  HTTP RPS:       ${CYAN}$HTTP_RPS req/s${NC}"
    echo -e "  Rapport:        ${CYAN}$REPORT_FILE${NC}"
    echo ""
}

# Vérifier les dépendances
check_dependencies() {
    local missing=()

    command -v curl &>/dev/null || missing+=("curl")
    command -v jq &>/dev/null || missing+=("jq")
    command -v bc &>/dev/null || missing+=("bc")

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Dépendances manquantes: ${missing[*]}${NC}"
        echo "Installation: apt-get install curl jq bc"
        exit 1
    fi

    # Note: websocat est optionnel, on utilise le polling Socket.IO avec curl
}

# Récupérer les métriques du serveur
get_server_metrics() {
    local metrics
    metrics=$(curl -s --max-time 5 "$API_URL/metrics" 2>/dev/null || echo "{}")
    echo "$metrics"
}

# Récupérer la santé du serveur
get_server_health() {
    local health
    health=$(curl -s --max-time 5 "$API_URL/health" 2>/dev/null || echo "{}")
    echo "$health"
}

# Client Socket.IO persistant (utilise le polling HTTP, pas besoin de websocat)
start_ws_client() {
    local client_id=$1
    local session_id="load-test-session-$client_id"

    while true; do
        # Handshake Socket.IO - obtenir le SID
        local handshake
        handshake=$(curl -s --max-time 10 "${API_URL}/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "")

        if [ -n "$handshake" ]; then
            local sid
            sid=$(echo "$handshake" | grep -o '"sid":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

            if [ -n "$sid" ]; then
                echo "success" >> "$TEMP_DIR/ws_success.log"

                # Maintenir la connexion avec des polling réguliers
                local poll_count=0
                while [ $poll_count -lt 30 ]; do
                    # Poll pour maintenir la connexion
                    local poll_result
                    poll_result=$(curl -s --max-time 5 "${API_URL}/socket.io/?EIO=4&transport=polling&sid=$sid" 2>/dev/null || echo "error")

                    if [ "$poll_result" == "error" ] || [ -z "$poll_result" ]; then
                        break
                    fi

                    sleep 1
                    poll_count=$((poll_count + 1))
                done
            fi
        fi

        # Incrémenter le compteur de reconnexions
        echo "reconnect" >> "$TEMP_DIR/ws_reconnects.log"

        # Petite pause avant reconnexion
        sleep 2
    done
}

# Générateur de requêtes HTTP
start_http_generator() {
    local interval=$(echo "scale=3; 1 / $HTTP_RPS" | bc)
    local endpoints=(
        "/health"
        "/metrics"
        "/api/sessions"
    )

    while true; do
        # Sélectionner un endpoint aléatoire
        local endpoint="${endpoints[$RANDOM % ${#endpoints[@]}]}"
        local start_time=$(date +%s%N)

        # Faire la requête
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL$endpoint" 2>/dev/null || echo "000")

        local end_time=$(date +%s%N)
        local latency=$(( (end_time - start_time) / 1000000 )) # en ms

        # Logger les résultats
        echo "$latency" >> "$TEMP_DIR/http_latencies.log"

        if [ "$status" == "200" ] || [ "$status" == "401" ]; then
            echo "success" >> "$TEMP_DIR/http_success.log"
        else
            echo "$status" >> "$TEMP_DIR/http_errors.log"
        fi

        sleep "$interval"
    done
}

# Collecter les métriques système locales
collect_local_metrics() {
    # CPU usage
    local cpu
    cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "0")

    # Memory usage
    local mem
    mem=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}' 2>/dev/null || echo "0")

    echo "$cpu $mem"
}

# Affichage en temps réel
display_realtime_stats() {
    local elapsed=$1
    local remaining=$(( TEST_DURATION - elapsed ))
    local progress=$(( elapsed * 100 / TEST_DURATION ))

    # Calculer les statistiques
    local success_count=$(wc -l < "$TEMP_DIR/http_success.log" 2>/dev/null || echo "0")
    local error_count=$(wc -l < "$TEMP_DIR/http_errors.log" 2>/dev/null || echo "0")
    local total_requests=$(( success_count + error_count ))
    local error_rate=0
    if [ "$total_requests" -gt 0 ]; then
        error_rate=$(echo "scale=2; $error_count * 100 / $total_requests" | bc)
    fi

    # Calculer la latence moyenne
    local avg_latency=0
    if [ -f "$TEMP_DIR/http_latencies.log" ] && [ -s "$TEMP_DIR/http_latencies.log" ]; then
        avg_latency=$(awk '{ sum += $1; count++ } END { if(count>0) printf "%.0f", sum/count; else print "0" }' "$TEMP_DIR/http_latencies.log")
    fi

    # Récupérer les métriques serveur
    local server_metrics
    server_metrics=$(get_server_metrics)
    local ws_connections=$(echo "$server_metrics" | jq -r '.websocket.activeConnections // 0' 2>/dev/null || echo "0")
    local server_heap=$(echo "$server_metrics" | jq -r '.memory.heapUsedMB // 0' 2>/dev/null || echo "0")
    local server_rss=$(echo "$server_metrics" | jq -r '.memory.rssMB // 0' 2>/dev/null || echo "0")
    local server_uptime=$(echo "$server_metrics" | jq -r '.uptimeFormatted // "N/A"' 2>/dev/null || echo "N/A")

    # Barre de progression
    local bar_width=40
    local filled=$(( progress * bar_width / 100 ))
    local empty=$(( bar_width - filled ))
    local bar=$(printf "%${filled}s" | tr ' ' '█')$(printf "%${empty}s" | tr ' ' '░')

    # Affichage
    echo -e "\033[10;0H" # Positionner le curseur
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}PROGRESSION${NC}"
    echo -e "  [$bar] ${progress}%"
    echo -e "  Temps écoulé: ${CYAN}$(format_duration $elapsed)${NC} | Restant: ${CYAN}$(format_duration $remaining)${NC}"
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}METRIQUES TEMPS REEL${NC}"
    echo -e "  ┌─────────────────────┬─────────────────────┐"
    echo -e "  │ ${CYAN}Requêtes HTTP${NC}       │ ${CYAN}WebSocket${NC}           │"
    echo -e "  ├─────────────────────┼─────────────────────┤"
    printf "  │ Total: %-12s │ Connexions: %-8s│\n" "$total_requests" "$ws_connections"
    printf "  │ Succès: %-11s │                     │\n" "$success_count"
    printf "  │ Erreurs: %-10s │                     │\n" "$error_count"
    printf "  │ Taux erreur: %5s%% │                     │\n" "$error_rate"
    printf "  │ Latence moy: %4sms │                     │\n" "$avg_latency"
    echo -e "  └─────────────────────┴─────────────────────┘"
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}SERVEUR${NC}"
    echo -e "  Uptime: ${CYAN}$server_uptime${NC}"
    echo -e "  Mémoire Heap: ${CYAN}${server_heap}MB${NC} | RSS: ${CYAN}${server_rss}MB${NC}"
    echo ""

    # Stocker les échantillons pour le rapport
    echo "$elapsed,$total_requests,$error_count,$avg_latency,$ws_connections,$server_heap,$server_rss" >> "$TEMP_DIR/samples.csv"
}

# Formater la durée
format_duration() {
    local seconds=$1
    local hours=$(( seconds / 3600 ))
    local minutes=$(( (seconds % 3600) / 60 ))
    local secs=$(( seconds % 60 ))

    if [ $hours -gt 0 ]; then
        printf "%dh%02dm%02ds" $hours $minutes $secs
    elif [ $minutes -gt 0 ]; then
        printf "%dm%02ds" $minutes $secs
    else
        printf "%ds" $secs
    fi
}

# Calculer les percentiles
calculate_percentile() {
    local file=$1
    local percentile=$2

    if [ ! -f "$file" ] || [ ! -s "$file" ]; then
        echo "0"
        return
    fi

    local count=$(wc -l < "$file")
    local index=$(echo "scale=0; $count * $percentile / 100" | bc)
    [ "$index" -lt 1 ] && index=1

    sort -n "$file" | sed -n "${index}p"
}

# Générer le rapport final
generate_report() {
    echo -e "\n${BOLD}${CYAN}Génération du rapport de performance...${NC}"

    local end_time=$(date +%s)
    local total_duration=$(( end_time - START_TIME ))

    # Statistiques HTTP
    local http_success=$(wc -l < "$TEMP_DIR/http_success.log" 2>/dev/null || echo "0")
    local http_errors=$(wc -l < "$TEMP_DIR/http_errors.log" 2>/dev/null || echo "0")
    local http_total=$(( http_success + http_errors ))
    local http_error_rate=0
    [ "$http_total" -gt 0 ] && http_error_rate=$(echo "scale=4; $http_errors * 100 / $http_total" | bc)

    # Latences
    local latency_min=0
    local latency_max=0
    local latency_avg=0
    local latency_p50=0
    local latency_p95=0
    local latency_p99=0

    if [ -f "$TEMP_DIR/http_latencies.log" ] && [ -s "$TEMP_DIR/http_latencies.log" ]; then
        latency_min=$(sort -n "$TEMP_DIR/http_latencies.log" | head -1)
        latency_max=$(sort -n "$TEMP_DIR/http_latencies.log" | tail -1)
        latency_avg=$(awk '{ sum += $1; count++ } END { if(count>0) printf "%.2f", sum/count; else print "0" }' "$TEMP_DIR/http_latencies.log")
        latency_p50=$(calculate_percentile "$TEMP_DIR/http_latencies.log" 50)
        latency_p95=$(calculate_percentile "$TEMP_DIR/http_latencies.log" 95)
        latency_p99=$(calculate_percentile "$TEMP_DIR/http_latencies.log" 99)
    fi

    # Reconnexions WebSocket
    local ws_reconnects=$(wc -l < "$TEMP_DIR/ws_reconnects.log" 2>/dev/null || echo "0")

    # RPS effectif
    local effective_rps=0
    [ "$total_duration" -gt 0 ] && effective_rps=$(echo "scale=2; $http_total / $total_duration" | bc)

    # Métriques serveur finales
    local final_metrics
    final_metrics=$(get_server_metrics)
    local final_heap=$(echo "$final_metrics" | jq -r '.memory.heapUsedMB // 0' 2>/dev/null || echo "0")
    local final_rss=$(echo "$final_metrics" | jq -r '.memory.rssMB // 0' 2>/dev/null || echo "0")
    local final_ws=$(echo "$final_metrics" | jq -r '.websocket.activeConnections // 0' 2>/dev/null || echo "0")

    # Créer le rapport JSON
    cat > "$REPORT_FILE" << EOF
{
  "test_info": {
    "type": "sustained_load_test",
    "date": "$(date -Iseconds)",
    "api_url": "$API_URL",
    "duration_seconds": $total_duration,
    "duration_formatted": "$(format_duration $total_duration)",
    "ws_clients_configured": $WS_CLIENTS,
    "http_rps_configured": $HTTP_RPS
  },
  "http_metrics": {
    "total_requests": $http_total,
    "successful_requests": $http_success,
    "failed_requests": $http_errors,
    "error_rate_percent": $http_error_rate,
    "effective_rps": $effective_rps
  },
  "latency_ms": {
    "min": $latency_min,
    "max": $latency_max,
    "avg": $latency_avg,
    "p50": $latency_p50,
    "p95": $latency_p95,
    "p99": $latency_p99
  },
  "websocket_metrics": {
    "clients_configured": $WS_CLIENTS,
    "reconnections": $ws_reconnects,
    "final_active_connections": $final_ws
  },
  "server_metrics": {
    "final_heap_mb": $final_heap,
    "final_rss_mb": $final_rss
  },
  "verdict": {
    "status": "$([ "$http_error_rate" = "0" ] || [ "$(echo "$http_error_rate < 1" | bc)" -eq 1 ] && echo "PASS" || echo "WARN")",
    "notes": [
      "Taux d'erreur HTTP: ${http_error_rate}%",
      "Latence P99: ${latency_p99}ms",
      "Reconnexions WS: $ws_reconnects"
    ]
  }
}
EOF

    # Afficher le résumé
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║               RAPPORT DE PERFORMANCE - RÉSUMÉ                    ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Durée du test:${NC} $(format_duration $total_duration)"
    echo ""
    echo -e "${BOLD}═══ Requêtes HTTP ═══${NC}"
    echo -e "  Total:           ${CYAN}$http_total${NC} requêtes"
    echo -e "  Succès:          ${GREEN}$http_success${NC}"
    echo -e "  Erreurs:         ${RED}$http_errors${NC}"
    echo -e "  Taux d'erreur:   $([ "$(echo "$http_error_rate < 1" | bc)" -eq 1 ] && echo "${GREEN}" || echo "${RED}")${http_error_rate}%${NC}"
    echo -e "  RPS effectif:    ${CYAN}$effective_rps${NC} req/s"
    echo ""
    echo -e "${BOLD}═══ Latences (ms) ═══${NC}"
    echo -e "  Min:    ${CYAN}$latency_min${NC}"
    echo -e "  Max:    ${CYAN}$latency_max${NC}"
    echo -e "  Moy:    ${CYAN}$latency_avg${NC}"
    echo -e "  P50:    ${CYAN}$latency_p50${NC}"
    echo -e "  P95:    ${YELLOW}$latency_p95${NC}"
    echo -e "  P99:    ${MAGENTA}$latency_p99${NC}"
    echo ""
    echo -e "${BOLD}═══ WebSocket ═══${NC}"
    echo -e "  Clients configurés:  ${CYAN}$WS_CLIENTS${NC}"
    echo -e "  Reconnexions:        ${CYAN}$ws_reconnects${NC}"
    echo -e "  Connexions finales:  ${CYAN}$final_ws${NC}"
    echo ""
    echo -e "${BOLD}═══ Mémoire Serveur ═══${NC}"
    echo -e "  Heap final:  ${CYAN}${final_heap}MB${NC}"
    echo -e "  RSS final:   ${CYAN}${final_rss}MB${NC}"
    echo ""

    # Verdict final
    local verdict_color="${GREEN}"
    local verdict_text="SUCCÈS"
    if [ "$(echo "$http_error_rate > 5" | bc)" -eq 1 ]; then
        verdict_color="${RED}"
        verdict_text="ÉCHEC"
    elif [ "$(echo "$http_error_rate > 1" | bc)" -eq 1 ]; then
        verdict_color="${YELLOW}"
        verdict_text="ATTENTION"
    fi

    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}VERDICT: ${verdict_color}${verdict_text}${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Rapport complet sauvegardé: ${CYAN}$REPORT_FILE${NC}"
    echo ""

    # Afficher le contenu JSON formaté
    echo -e "${BOLD}Contenu du rapport JSON:${NC}"
    cat "$REPORT_FILE" | jq '.'
}

# Fonction principale
main() {
    print_header
    check_dependencies

    # Header du fichier CSV
    echo "elapsed,requests,errors,latency_avg,ws_connections,heap_mb,rss_mb" > "$TEMP_DIR/samples.csv"

    # Vérifier la connectivité
    echo -e "${YELLOW}Vérification de la connectivité...${NC}"
    if ! curl -s --max-time 10 "$API_URL/health" &>/dev/null; then
        echo -e "${RED}Impossible de contacter $API_URL${NC}"
        exit 1
    fi
    echo -e "${GREEN}Serveur accessible${NC}"
    echo ""

    # Démarrer les clients WebSocket en arrière-plan
    echo -e "${YELLOW}Démarrage de $WS_CLIENTS clients WebSocket...${NC}"
    for i in $(seq 1 $WS_CLIENTS); do
        start_ws_client $i &
        WS_PIDS+=($!)

        # Afficher la progression
        if [ $((i % 10)) -eq 0 ]; then
            echo -e "  ${CYAN}$i/$WS_CLIENTS${NC} clients démarrés"
        fi

        # Petit délai pour éviter la surcharge
        sleep 0.1
    done
    echo -e "${GREEN}$WS_CLIENTS clients WebSocket démarrés${NC}"
    echo ""

    # Démarrer le générateur HTTP en arrière-plan
    echo -e "${YELLOW}Démarrage du générateur HTTP ($HTTP_RPS req/s)...${NC}"
    start_http_generator &
    HTTP_PID=$!
    echo -e "${GREEN}Générateur HTTP démarré${NC}"
    echo ""

    # Boucle principale de monitoring
    echo -e "${YELLOW}Test en cours... (Ctrl+C pour arrêter)${NC}"
    echo ""

    local elapsed=0
    while [ $elapsed -lt $TEST_DURATION ]; do
        display_realtime_stats $elapsed
        sleep $SAMPLE_INTERVAL
        elapsed=$(( $(date +%s) - START_TIME ))
    done

    echo ""
    echo -e "${GREEN}Test terminé!${NC}"
}

# Afficher l'aide
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL          URL de l'API (défaut: $API_URL)"
    echo "  -d, --duration SECS    Durée du test en secondes (défaut: $TEST_DURATION)"
    echo "  -w, --ws-clients N     Nombre de clients WebSocket (défaut: $WS_CLIENTS)"
    echo "  -r, --rps N            Requêtes HTTP par seconde (défaut: $HTTP_RPS)"
    echo "  -o, --output FILE      Fichier de rapport (défaut: auto-généré)"
    echo "  -h, --help             Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 -d 3600 -w 100 -r 20    # Test 1 heure, 100 WS, 20 req/s"
    echo "  $0 -d 300 -w 50            # Test 5 min, 50 WS clients"
    echo ""
    echo "Variables d'environnement:"
    echo "  API_URL, TEST_DURATION, WS_CLIENTS, HTTP_RPS, REPORT_FILE"
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        -d|--duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        -w|--ws-clients)
            WS_CLIENTS="$2"
            shift 2
            ;;
        -r|--rps)
            HTTP_RPS="$2"
            shift 2
            ;;
        -o|--output)
            REPORT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# Lancer le test
main
