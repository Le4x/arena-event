#!/bin/bash

# ============================================
# Arena Event - Monitoring Jour J
# ============================================
# Script de monitoring temps réel pour l'événement
# Lance-le dans un terminal pendant le quiz
# ============================================

API_URL="${API_URL:-https://api.arena-event.fr}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-3}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Historique pour les alertes
PREV_HEAP=0
PREV_CONNECTIONS=0
ALERT_LOG="/tmp/arena-alerts-$(date +%Y%m%d).log"

# Seuils d'alerte
HEAP_WARNING=150      # MB
HEAP_CRITICAL=250     # MB
LATENCY_WARNING=500   # ms
LATENCY_CRITICAL=1000 # ms
ERROR_RATE_WARNING=2  # %
ERROR_RATE_CRITICAL=5 # %

check_alert() {
    local metric=$1
    local value=$2
    local warning=$3
    local critical=$4
    local unit=$5

    if (( $(echo "$value >= $critical" | bc -l) )); then
        echo -e "${RED}⚠️  CRITIQUE${NC}"
        echo "[$(date '+%H:%M:%S')] CRITIQUE: $metric = $value$unit" >> "$ALERT_LOG"
    elif (( $(echo "$value >= $warning" | bc -l) )); then
        echo -e "${YELLOW}⚡ WARNING${NC}"
        echo "[$(date '+%H:%M:%S')] WARNING: $metric = $value$unit" >> "$ALERT_LOG"
    else
        echo -e "${GREEN}✓ OK${NC}"
    fi
}

format_uptime() {
    local seconds=$1
    local days=$((seconds / 86400))
    local hours=$(( (seconds % 86400) / 3600 ))
    local mins=$(( (seconds % 3600) / 60 ))

    if [ $days -gt 0 ]; then
        echo "${days}j ${hours}h ${mins}m"
    elif [ $hours -gt 0 ]; then
        echo "${hours}h ${mins}m"
    else
        echo "${mins}m"
    fi
}

monitor() {
    # Cacher le curseur et effacer l'écran une seule fois
    tput civis 2>/dev/null  # Cacher curseur
    clear

    # Restaurer le curseur à la sortie
    trap 'tput cnorm 2>/dev/null; echo ""; exit 0' EXIT INT TERM

    while true; do
        # Retourner en haut de l'écran sans effacer (pas de clignotement)
        tput home 2>/dev/null || echo -e "\033[H"

        # Récupérer les données
        local health=$(curl -s --max-time 3 "$API_URL/health" 2>/dev/null)
        local metrics=$(curl -s --max-time 3 "$API_URL/metrics" 2>/dev/null)
        local timestamp=$(date '+%H:%M:%S')

        # Parser les métriques
        local status=$(echo "$health" | jq -r '.status // "unknown"' 2>/dev/null)
        local uptime=$(echo "$metrics" | jq -r '.uptime // 0' 2>/dev/null)
        local uptime_fmt=$(echo "$metrics" | jq -r '.uptimeFormatted // "N/A"' 2>/dev/null)
        local heap=$(echo "$metrics" | jq -r '.memory.heapUsedMB // 0' 2>/dev/null)
        local rss=$(echo "$metrics" | jq -r '.memory.rssMB // 0' 2>/dev/null)
        local ws_connections=$(echo "$metrics" | jq -r '.websocket.activeConnections // 0' 2>/dev/null)
        local ws_messages_in=$(echo "$metrics" | jq -r '.websocket.totalMessagesIn // 0' 2>/dev/null)
        local ws_messages_out=$(echo "$metrics" | jq -r '.websocket.totalMessagesOut // 0' 2>/dev/null)
        local total_requests=$(echo "$metrics" | jq -r '.requests.total // 0' 2>/dev/null)
        local total_errors=$(echo "$metrics" | jq -r '.requests.errors // 0' 2>/dev/null)
        local error_rate=$(echo "$metrics" | jq -r '.requests.errorRate // "0"' 2>/dev/null)
        local avg_latency=$(echo "$metrics" | jq -r '.latency.avgMs // 0' 2>/dev/null)
        local max_latency=$(echo "$metrics" | jq -r '.latency.maxMs // 0' 2>/dev/null)
        local active_timers=$(echo "$metrics" | jq -r '.sessions.activeTimers // 0' 2>/dev/null)
        local active_buzzers=$(echo "$metrics" | jq -r '.sessions.activeBuzzerStates // 0' 2>/dev/null)

        # Header
        echo -e "${BOLD}${CYAN}"
        echo "╔══════════════════════════════════════════════════════════════════╗"
        echo "║            🎮 ARENA EVENT - MONITORING JOUR J 🎮                 ║"
        echo "╚══════════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"

        # Status ligne
        echo -e "${BOLD}[$timestamp]${NC} Rafraîchissement: ${CYAN}${REFRESH_INTERVAL}s${NC} | API: ${CYAN}$API_URL${NC}"
        echo ""

        # Status serveur
        local status_color="${GREEN}"
        local status_icon="✅"
        if [ "$status" != "ok" ]; then
            status_color="${RED}"
            status_icon="❌"
        fi

        echo -e "${BOLD}═══ SERVEUR ═══${NC}"
        echo -e "  Status:    ${status_color}${status_icon} ${status^^}${NC}"
        echo -e "  Uptime:    ${CYAN}$uptime_fmt${NC}"
        echo ""

        # Joueurs connectés (WebSocket)
        echo -e "${BOLD}═══ 👥 JOUEURS CONNECTÉS ═══${NC}"
        echo -e "  ┌─────────────────────────────────────────────┐"

        # Barre de connexions (max 100)
        local bar_max=100
        local bar_width=30
        local filled=$((ws_connections * bar_width / bar_max))
        [ $filled -gt $bar_width ] && filled=$bar_width
        local empty=$((bar_width - filled))
        local bar=$(printf "%${filled}s" | tr ' ' '█')$(printf "%${empty}s" | tr ' ' '░')

        local conn_color="${GREEN}"
        [ $ws_connections -gt 80 ] && conn_color="${YELLOW}"
        [ $ws_connections -gt 95 ] && conn_color="${RED}"

        printf "  │ Connexions: ${conn_color}%-3s${NC} [${bar}] %-3s │\n" "$ws_connections" "$bar_max"
        echo -e "  │ Messages reçus:    ${CYAN}$(printf '%10s' $ws_messages_in)${NC}          │"
        echo -e "  │ Messages envoyés:  ${CYAN}$(printf '%10s' $ws_messages_out)${NC}          │"
        echo -e "  └─────────────────────────────────────────────┘"

        # Variation de connexions
        local conn_diff=$((ws_connections - PREV_CONNECTIONS))
        if [ $conn_diff -gt 0 ]; then
            echo -e "  Tendance: ${GREEN}↑ +$conn_diff${NC}"
        elif [ $conn_diff -lt 0 ]; then
            echo -e "  Tendance: ${RED}↓ $conn_diff${NC}"
        else
            echo -e "  Tendance: ${CYAN}→ stable${NC}"
        fi
        PREV_CONNECTIONS=$ws_connections
        echo ""

        # Sessions de jeu
        echo -e "${BOLD}═══ 🎯 SESSIONS DE JEU ═══${NC}"
        echo -e "  Timers actifs:  ${CYAN}$active_timers${NC}"
        echo -e "  Buzzers actifs: ${CYAN}$active_buzzers${NC}"
        echo ""

        # Performance
        echo -e "${BOLD}═══ ⚡ PERFORMANCE ═══${NC}"
        echo -e "  ┌─────────────────────────────────────────────┐"
        printf "  │ Requêtes totales:  ${CYAN}%10s${NC}              │\n" "$total_requests"
        printf "  │ Erreurs:           ${RED}%10s${NC}              │\n" "$total_errors"

        # Taux d'erreur avec alerte
        local err_color="${GREEN}"
        [ "$(echo "$error_rate >= $ERROR_RATE_WARNING" | bc -l)" -eq 1 ] && err_color="${YELLOW}"
        [ "$(echo "$error_rate >= $ERROR_RATE_CRITICAL" | bc -l)" -eq 1 ] && err_color="${RED}"
        printf "  │ Taux d'erreur:     ${err_color}%9s%%${NC}              │\n" "$error_rate"

        # Latence avec alerte
        local lat_color="${GREEN}"
        [ "$(echo "$avg_latency >= $LATENCY_WARNING" | bc -l 2>/dev/null)" -eq 1 ] && lat_color="${YELLOW}"
        [ "$(echo "$avg_latency >= $LATENCY_CRITICAL" | bc -l 2>/dev/null)" -eq 1 ] && lat_color="${RED}"
        printf "  │ Latence moyenne:   ${lat_color}%8sms${NC}              │\n" "$avg_latency"
        printf "  │ Latence max:       ${CYAN}%8sms${NC}              │\n" "$max_latency"
        echo -e "  └─────────────────────────────────────────────┘"
        echo ""

        # Mémoire
        echo -e "${BOLD}═══ 🖥️  MÉMOIRE ═══${NC}"

        # Barre mémoire heap
        local heap_max=256
        local heap_bar_width=30
        local heap_filled=$((heap * heap_bar_width / heap_max))
        [ $heap_filled -gt $heap_bar_width ] && heap_filled=$heap_bar_width
        local heap_empty=$((heap_bar_width - heap_filled))
        local heap_bar=$(printf "%${heap_filled}s" | tr ' ' '█')$(printf "%${heap_empty}s" | tr ' ' '░')

        local heap_color="${GREEN}"
        [ "$(echo "$heap >= $HEAP_WARNING" | bc -l)" -eq 1 ] && heap_color="${YELLOW}"
        [ "$(echo "$heap >= $HEAP_CRITICAL" | bc -l)" -eq 1 ] && heap_color="${RED}"

        printf "  Heap:  ${heap_color}%3sMB${NC} [${heap_bar}] %sMB\n" "$heap" "$heap_max"
        echo -e "  RSS:   ${CYAN}${rss}MB${NC}"

        # Variation mémoire
        local heap_diff=$((heap - PREV_HEAP))
        if [ $heap_diff -gt 5 ]; then
            echo -e "  Tendance: ${YELLOW}↑ +${heap_diff}MB${NC}"
        elif [ $heap_diff -lt -5 ]; then
            echo -e "  Tendance: ${GREEN}↓ ${heap_diff}MB (GC)${NC}"
        else
            echo -e "  Tendance: ${CYAN}→ stable${NC}"
        fi
        PREV_HEAP=$heap
        echo ""

        # Alertes
        echo -e "${BOLD}═══ 🚨 ALERTES ═══${NC}"
        local has_alerts=false

        if [ "$(echo "$heap >= $HEAP_CRITICAL" | bc -l)" -eq 1 ]; then
            echo -e "  ${RED}⚠️  MÉMOIRE CRITIQUE: ${heap}MB${NC}"
            has_alerts=true
        elif [ "$(echo "$heap >= $HEAP_WARNING" | bc -l)" -eq 1 ]; then
            echo -e "  ${YELLOW}⚡ Mémoire haute: ${heap}MB${NC}"
            has_alerts=true
        fi

        if [ "$(echo "$error_rate >= $ERROR_RATE_CRITICAL" | bc -l)" -eq 1 ]; then
            echo -e "  ${RED}⚠️  TAUX D'ERREUR CRITIQUE: ${error_rate}%${NC}"
            has_alerts=true
        elif [ "$(echo "$error_rate >= $ERROR_RATE_WARNING" | bc -l)" -eq 1 ]; then
            echo -e "  ${YELLOW}⚡ Taux d'erreur élevé: ${error_rate}%${NC}"
            has_alerts=true
        fi

        if [ "$has_alerts" = false ]; then
            echo -e "  ${GREEN}✅ Aucune alerte - Tout fonctionne bien !${NC}"
        fi

        echo ""
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "Appuie sur ${CYAN}Ctrl+C${NC} pour arrêter | Log alertes: ${CYAN}$ALERT_LOG${NC}"

        sleep $REFRESH_INTERVAL
    done
}

# Aide
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL        URL de l'API (défaut: $API_URL)"
    echo "  -i, --interval SEC   Intervalle de rafraîchissement (défaut: $REFRESH_INTERVAL)"
    echo "  -h, --help           Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0                          # Monitoring par défaut"
    echo "  $0 -i 1                     # Rafraîchissement chaque seconde"
    echo "  $0 -u https://api.example.com"
}

# Parser arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url) API_URL="$2"; shift 2 ;;
        -i|--interval) REFRESH_INTERVAL="$2"; shift 2 ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Option inconnue: $1"; show_help; exit 1 ;;
    esac
done

# Vérifier curl et jq
if ! command -v curl &>/dev/null || ! command -v jq &>/dev/null; then
    echo "Erreur: curl et jq sont requis"
    echo "Installation: apt install curl jq"
    exit 1
fi

# Lancer le monitoring
monitor
