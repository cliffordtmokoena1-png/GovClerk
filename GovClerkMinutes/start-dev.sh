#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PIDS=()
DOCKER_RUNNING=false
CLEANUP_DONE=false

cleanup() {
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    CLEANUP_DONE=true
    
    echo ""
    echo -e "${YELLOW}[start-dev]${NC} Shutting down all services..."
    
    pkill -P $$ 2>/dev/null || true
    
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    
    pkill -f "cargo.watch" 2>/dev/null || true
    pkill -f "cargo-watch" 2>/dev/null || true
    pkill -f "bun --watch" 2>/dev/null || true
    
    if [ "$DOCKER_RUNNING" = true ]; then
        echo -e "${YELLOW}[start-dev]${NC} Stopping docker containers..."
        (cd platform/sophon/dev && docker compose down) 2>/dev/null || true
        (cd dev && docker compose down) 2>/dev/null || true
    fi
    
    sleep 0.5
    
    pkill -9 -P $$ 2>/dev/null || true
    
    echo -e "${GREEN}[start-dev]${NC} All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

prefix_output() {
    local prefix="$1"
    local color="$2"
    while IFS= read -r line; do
        echo -e "${color}[${prefix}]${NC} $line"
    done
}

echo -e "${GREEN}[start-dev]${NC} Starting development environment..."
echo ""

echo -e "${MAGENTA}[rtmp]${NC} Starting RTMP server via docker compose..."
(cd platform/sophon/dev && docker compose up 2>&1) | prefix_output "rtmp" "$MAGENTA" &
PIDS+=($!)
DOCKER_RUNNING=true
sleep 2

echo -e "${CYAN}[sophon]${NC} Building Sophon server..."
(cd platform/sophon && npm run build) || { echo -e "${RED}[sophon]${NC} Build failed"; exit 1; }

echo -e "${CYAN}[sophon]${NC} Starting Sophon server with watch-and-build..."
(cd platform/sophon && npx nodemon --watch src --ext ts --exec "npm run build && node dist/index.js" 2>&1) | prefix_output "sophon" "$CYAN" &
PIDS+=($!)

echo -e "${BLUE}[next]${NC} Starting Next.js frontend on port 3223..."
(NODE_OPTIONS=--inspect npx next dev -p 3223 2>&1) | prefix_output "next" "$BLUE" &
PIDS+=($!)

echo -e "${YELLOW}[caddy]${NC} Starting Caddy proxy for GovClerkMinutes on port 3224..."
(cd dev && docker compose up 2>&1) | prefix_output "caddy" "$YELLOW" &
PIDS+=($!)

echo -e "${GREEN}[rust]${NC} Starting Rust server with cargo watch..."
(cargo watch -x "run -- --clerk-test-mode" 2>&1) | prefix_output "rust" "$GREEN" &
PIDS+=($!)

echo ""
echo -e "${GREEN}[start-dev]${NC} All services starting. Press Ctrl+C to stop all."
echo -e "${GREEN}[start-dev]${NC} Services (with file watchers):"
echo -e "  ${MAGENTA}• RTMP${NC}    - Docker Compose (no watcher)"
echo -e "  ${CYAN}• Sophon${NC}  - http://localhost:3000 (watches platform/sophon/**)"
echo -e "  ${BLUE}• Next.js${NC} - http://localhost:3223 (GovClerk, built-in HMR)"
echo -e "  ${YELLOW}• Caddy${NC}   - http://localhost:3224 (GovClerkMinutes proxy)"
echo -e "  ${GREEN}• Rust${NC}    - cargo watch (watches platform/server/**)"
echo ""

while true; do
    for i in "${!PIDS[@]}"; do
        pid="${PIDS[$i]}"
        if ! kill -0 "$pid" 2>/dev/null; then
            case $i in
                0) service="RTMP" ;;
                1) service="Sophon" ;;
                2) service="Next.js" ;;
                3) service="Caddy" ;;
                4) service="Rust" ;;
                *) service="Unknown" ;;
            esac
            echo -e "${RED}[start-dev]${NC} Service $service (PID $pid) exited unexpectedly"
            cleanup
            exit 1
        fi
    done
    
    sleep 2
done
