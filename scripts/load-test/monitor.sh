#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Arena Event - Real-time Performance Monitor
# ═══════════════════════════════════════════════════════════════════════════

API_URL="${API_URL:-http://localhost:3001}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-2}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  🖥️  ARENA EVENT - MONITORING TEMPS RÉEL${NC}"
    echo -e "${GRAY}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════${NC}"
}

print_section() {
    echo -e "\n${WHITE}$1${NC}"
    echo -e "${GRAY}─────────────────────────────────────────────────────────────────────────${NC}"
}

# Function to format bytes
format_bytes() {
    local bytes=$1
    if [ $bytes -ge 1073741824 ]; then
        echo "$(echo "scale=2; $bytes/1073741824" | bc)GB"
    elif [ $bytes -ge 1048576 ]; then
        echo "$(echo "scale=2; $bytes/1048576" | bc)MB"
    elif [ $bytes -ge 1024 ]; then
        echo "$(echo "scale=2; $bytes/1024" | bc)KB"
    else
        echo "${bytes}B"
    fi
}

while true; do
    clear
    print_header

    # ─────────────────────────────────────────────────────────────────────────
    # CPU & LOAD
    # ─────────────────────────────────────────────────────────────────────────
    print_section "📊 CPU & CHARGE SYSTÈME"

    # Load averages
    LOAD=$(cat /proc/loadavg 2>/dev/null)
    LOAD_1=$(echo $LOAD | awk '{print $1}')
    LOAD_5=$(echo $LOAD | awk '{print $2}')
    LOAD_15=$(echo $LOAD | awk '{print $3}')

    CPU_CORES=$(nproc 2>/dev/null || echo "1")

    # Color based on load
    if (( $(echo "$LOAD_1 < $CPU_CORES * 0.7" | bc -l) )); then
        LOAD_COLOR=$GREEN
    elif (( $(echo "$LOAD_1 < $CPU_CORES" | bc -l) )); then
        LOAD_COLOR=$YELLOW
    else
        LOAD_COLOR=$RED
    fi

    echo -e "  Load Average:  ${LOAD_COLOR}${LOAD_1}${NC} (1m)  ${LOAD_5} (5m)  ${LOAD_15} (15m)"
    echo -e "  CPU Cores:     ${CPU_CORES}"

    # CPU Usage per core (top 3 processes)
    echo -e "\n  ${GRAY}Top CPU Processes:${NC}"
    ps aux --sort=-%cpu | head -4 | tail -3 | while read line; do
        CPU=$(echo $line | awk '{print $3}')
        CMD=$(echo $line | awk '{print $11}' | cut -c1-30)
        printf "    ${GRAY}%-30s${NC} %5s%%\n" "$CMD" "$CPU"
    done

    # ─────────────────────────────────────────────────────────────────────────
    # MEMORY
    # ─────────────────────────────────────────────────────────────────────────
    print_section "💾 MÉMOIRE"

    MEM_INFO=$(free -b | grep Mem)
    MEM_TOTAL=$(echo $MEM_INFO | awk '{print $2}')
    MEM_USED=$(echo $MEM_INFO | awk '{print $3}')
    MEM_FREE=$(echo $MEM_INFO | awk '{print $4}')
    MEM_CACHE=$(echo $MEM_INFO | awk '{print $6}')

    MEM_PERCENT=$(echo "scale=1; $MEM_USED * 100 / $MEM_TOTAL" | bc)

    if (( $(echo "$MEM_PERCENT < 70" | bc -l) )); then
        MEM_COLOR=$GREEN
    elif (( $(echo "$MEM_PERCENT < 85" | bc -l) )); then
        MEM_COLOR=$YELLOW
    else
        MEM_COLOR=$RED
    fi

    # Progress bar
    MEM_BAR_WIDTH=40
    MEM_FILLED=$(echo "scale=0; $MEM_PERCENT * $MEM_BAR_WIDTH / 100" | bc)
    MEM_EMPTY=$((MEM_BAR_WIDTH - MEM_FILLED))
    MEM_BAR=$(printf "%${MEM_FILLED}s" | tr ' ' '█')$(printf "%${MEM_EMPTY}s" | tr ' ' '░')

    echo -e "  RAM:  [${MEM_COLOR}${MEM_BAR}${NC}] ${MEM_COLOR}${MEM_PERCENT}%${NC}"
    echo -e "        Used: $(format_bytes $MEM_USED) / Total: $(format_bytes $MEM_TOTAL)"
    echo -e "        Cache: $(format_bytes $MEM_CACHE)"

    # Swap
    SWAP_INFO=$(free -b | grep Swap)
    SWAP_TOTAL=$(echo $SWAP_INFO | awk '{print $2}')
    SWAP_USED=$(echo $SWAP_INFO | awk '{print $3}')

    if [ "$SWAP_TOTAL" -gt 0 ]; then
        SWAP_PERCENT=$(echo "scale=1; $SWAP_USED * 100 / $SWAP_TOTAL" | bc)
        echo -e "  Swap: Used: $(format_bytes $SWAP_USED) / Total: $(format_bytes $SWAP_TOTAL) (${SWAP_PERCENT}%)"
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # NETWORK CONNECTIONS
    # ─────────────────────────────────────────────────────────────────────────
    print_section "🔌 CONNEXIONS RÉSEAU"

    # TCP connections summary
    TCP_STATS=$(ss -s 2>/dev/null | grep TCP:)
    TCP_ESTAB=$(echo "$TCP_STATS" | grep -oP 'estab \K\d+' || echo "0")
    TCP_TOTAL=$(ss -tan 2>/dev/null | wc -l)

    echo -e "  TCP Established:  ${GREEN}${TCP_ESTAB}${NC}"
    echo -e "  TCP Total:        ${TCP_TOTAL}"

    # Connections to API port
    API_PORT=$(echo $API_URL | grep -oP ':\K\d+' || echo "3001")
    API_CONNS=$(ss -tan "sport = :${API_PORT}" 2>/dev/null | grep -c ESTAB || echo "0")
    echo -e "  API Port ${API_PORT}:     ${CYAN}${API_CONNS}${NC} connections"

    # WebSocket connections (if available)
    WS_CONNS=$(ss -tan "sport = :${API_PORT}" 2>/dev/null | grep -c "ESTAB" || echo "0")

    # ─────────────────────────────────────────────────────────────────────────
    # ARENA API METRICS
    # ─────────────────────────────────────────────────────────────────────────
    print_section "🎮 API ARENA METRICS"

    METRICS=$(curl -s --connect-timeout 2 "${API_URL}/metrics" 2>/dev/null)

    if [ -n "$METRICS" ] && echo "$METRICS" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        echo "$METRICS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)

    # WebSocket
    ws = d.get('websocket', {})
    ws_conn = ws.get('activeConnections', 0)
    ws_peak = ws.get('peakConnections', 0)
    ws_total = ws.get('totalConnections', 0)

    # Color for connections
    ws_color = '\033[0;32m' if ws_conn < 50 else '\033[1;33m' if ws_conn < 100 else '\033[0;31m'

    print(f'  WebSocket:')
    print(f'    Active:     {ws_color}{ws_conn}\033[0m connections')
    print(f'    Peak:       {ws_peak}')
    print(f'    Total:      {ws_total}')

    # Requests
    req = d.get('requests', {})
    req_total = req.get('total', 0)
    req_errors = req.get('errors', 0)
    error_rate = (req_errors / req_total * 100) if req_total > 0 else 0

    error_color = '\033[0;32m' if error_rate < 1 else '\033[1;33m' if error_rate < 5 else '\033[0;31m'

    print(f'  Requests:')
    print(f'    Total:      {req_total}')
    print(f'    Errors:     {error_color}{req_errors} ({error_rate:.2f}%)\033[0m')

    # Memory
    mem = d.get('memory', {})
    heap_mb = mem.get('heapUsedMB', 0)
    rss_mb = mem.get('rssMB', 0)

    mem_color = '\033[0;32m' if heap_mb < 200 else '\033[1;33m' if heap_mb < 500 else '\033[0;31m'

    print(f'  Memory:')
    print(f'    Heap:       {mem_color}{heap_mb}MB\033[0m')
    print(f'    RSS:        {rss_mb}MB')

    # Latency
    lat = d.get('latency', {})
    avg_ms = lat.get('avgMs', 0)
    max_ms = lat.get('maxMs', 0)

    lat_color = '\033[0;32m' if avg_ms < 50 else '\033[1;33m' if avg_ms < 200 else '\033[0;31m'

    print(f'  Latency:')
    print(f'    Average:    {lat_color}{avg_ms}ms\033[0m')
    print(f'    Max:        {max_ms}ms')

    # Sessions
    sessions = d.get('sessions', {})
    active = sessions.get('active', 0)
    print(f'  Sessions:     {active} active')

except Exception as e:
    print(f'  \033[0;31m(Erreur parsing: {e})\033[0m')
"
    else
        echo -e "  ${RED}(API non accessible ou pas de métriques)${NC}"
        echo -e "  ${GRAY}URL: ${API_URL}/metrics${NC}"
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # PM2 PROCESSES
    # ─────────────────────────────────────────────────────────────────────────
    print_section "⚙️  PROCESSUS PM2"

    if command -v pm2 &> /dev/null; then
        pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    if not procs:
        print('  (Aucun processus PM2)')
    else:
        print('  {:<20} {:<10} {:<10} {:<10} {:<10}'.format('NAME', 'STATUS', 'CPU', 'MEM', 'RESTARTS'))
        print('  ' + '-' * 60)
        for p in procs:
            name = p.get('name', 'unknown')[:18]
            status = p.get('pm2_env', {}).get('status', 'unknown')
            cpu = str(p.get('monit', {}).get('cpu', 0)) + '%'
            mem = str(round(p.get('monit', {}).get('memory', 0) / 1024 / 1024, 1)) + 'MB'
            restarts = p.get('pm2_env', {}).get('restart_time', 0)

            status_color = '\033[0;32m' if status == 'online' else '\033[0;31m'
            print(f'  {name:<20} {status_color}{status:<10}\033[0m {cpu:<10} {mem:<10} {restarts}')
except:
    print('  (Erreur lecture PM2)')
" 2>/dev/null || echo -e "  ${GRAY}(PM2 non disponible ou erreur)${NC}"
    else
        echo -e "  ${GRAY}(PM2 non installé)${NC}"
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # DISK I/O
    # ─────────────────────────────────────────────────────────────────────────
    print_section "💿 DISQUE"

    DISK_INFO=$(df -h / 2>/dev/null | tail -1)
    DISK_SIZE=$(echo $DISK_INFO | awk '{print $2}')
    DISK_USED=$(echo $DISK_INFO | awk '{print $3}')
    DISK_AVAIL=$(echo $DISK_INFO | awk '{print $4}')
    DISK_PERCENT=$(echo $DISK_INFO | awk '{print $5}' | tr -d '%')

    if [ "$DISK_PERCENT" -lt 70 ]; then
        DISK_COLOR=$GREEN
    elif [ "$DISK_PERCENT" -lt 85 ]; then
        DISK_COLOR=$YELLOW
    else
        DISK_COLOR=$RED
    fi

    echo -e "  Usage:    ${DISK_COLOR}${DISK_PERCENT}%${NC} (${DISK_USED} / ${DISK_SIZE})"
    echo -e "  Available: ${DISK_AVAIL}"

    # ─────────────────────────────────────────────────────────────────────────
    # FOOTER
    # ─────────────────────────────────────────────────────────────────────────
    echo -e "\n${GRAY}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GRAY}  🔄 Rafraîchissement dans ${REFRESH_INTERVAL}s... (Ctrl+C pour quitter)${NC}"
    echo -e "${GRAY}═══════════════════════════════════════════════════════════════════════════${NC}"

    sleep $REFRESH_INTERVAL
done
