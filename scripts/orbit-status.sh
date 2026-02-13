#!/bin/bash
# Orbit Status Script
# Shows current environment, Docker status, and recent activity.

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/orbit-utils.sh"

PROJECT_PATH="${1:-$(pwd)}"
PROJECT_NAME="$(basename "$PROJECT_PATH")"

echo "=== Orbit Status ==="
echo "Project: $PROJECT_NAME"
echo "Path:    $PROJECT_PATH"

# 1. Check if initialized
if [ ! -f "$PROJECT_PATH/.orbit/config.json" ]; then
    echo "Status:  NOT INITIALIZED"
    echo "Run '/orbit init' to onboard this project."
    exit 0
fi

# 2. Get State
if [ -f "$DB_PATH" ]; then
    ENV=$(sqlite3 "$DB_PATH" "SELECT current_env FROM project_state WHERE project='$PROJECT_PATH'" 2>/dev/null)
    ACTIVITY=$(sqlite3 "$DB_PATH" "SELECT last_activity FROM project_state WHERE project='$PROJECT_PATH'" 2>/dev/null)
    echo "Status:  ACTIVE"
    echo "Current Environment: ${ENV:-dev}"
    echo "Last Activity:       ${ACTIVITY:-unknown}"
else
    echo "Status:  INITIALIZED (No state yet)"
fi

# 3. Docker Status
echo ""
echo "=== Docker Status ==="
if check_docker; then
    echo "Daemon: Running"
    docker --version
    
    # Show running Orbit containers
    CONTAINERS=$(docker ps --filter "label=com.orbit.managed=true" --format "{{.Names}} ({{.Status}})")
    if [ -n "$CONTAINERS" ]; then
        echo "Active Orbit Containers:"
        echo "$CONTAINERS"
    else
        echo "No active Orbit containers."
    fi
else
    echo "Daemon: NOT RUNNING"
fi

# 4. Recent Audit Logs
echo ""
echo "=== Recent Activity ==="
if [ -f "$DB_PATH" ]; then
    sqlite3 -header -column "$DB_PATH" "SELECT timestamp, command, environment, success FROM audit_log WHERE project='$PROJECT_PATH' ORDER BY timestamp DESC LIMIT 5;"
else
    echo "No activity recorded."
fi
