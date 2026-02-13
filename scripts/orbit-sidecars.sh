#!/bin/bash
# Orbit Sidecars Wrapper
# Manages persistent sidecar services via CLI.

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/orbit-utils.sh"

ACTION="${1:-list}"
SIDECAR="$2"

check_docker

COMPOSE_FILE="$ORBIT_ROOT/docker/docker-compose.yml"

case "$ACTION" in
    list)
        echo "Available Sidecars:"
        grep "sidecar-" "$COMPOSE_FILE" | sed 's/.*sidecar-//;s/".*//' | sort | uniq | xargs -I {} echo "  - {}"
        
        echo ""
        echo "Running Sidecars:"
        docker ps --filter "label=com.orbit.type=sidecar" --format "  - {{.Names}} ({{.Status}})"
        ;;
    start)
        [ -z "$SIDECAR" ] && error "Sidecar name required. Run 'orbit sidecars list' to see available options."
        echo "Starting sidecar: $SIDECAR"
        docker compose -f "$COMPOSE_FILE" --profile "sidecar-$SIDECAR" up -d
        ;;
    stop)
        [ -z "$SIDECAR" ] && error "Sidecar name required."
        echo "Stopping sidecar: $SIDECAR"
        docker compose -f "$COMPOSE_FILE" --profile "sidecar-$SIDECAR" stop
        ;;
    *)
        echo "Usage: orbit sidecars [list|start|stop <name>]"
        exit 1
        ;;
esac
