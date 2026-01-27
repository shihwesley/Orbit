#!/bin/bash
# Switch to staging environment
# Usage: orbit-staging.sh [project_path]

set -e

PROJECT_PATH="${1:-.}"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"
ORBIT_ROOT="$HOME/.orbit"

# Check Docker
if ! "$ORBIT_ROOT/scripts/check-docker.sh" check 2>/dev/null; then
    echo "ERROR: Docker required for staging environment"
    "$ORBIT_ROOT/scripts/check-docker.sh" status
    exit 1
fi

# Check project initialized
if [ ! -f "$PROJECT_PATH/.orbit/config.json" ]; then
    echo "ERROR: Project not initialized. Run /orbit init first."
    exit 1
fi

echo "=== Orbit Staging ==="
echo "Project: $PROJECT_NAME"
echo ""

# Get sidecars from config
SIDECARS=$(python3 -c "import json; print(' '.join(json.load(open('$PROJECT_PATH/.orbit/config.json')).get('sidecars', [])))" 2>/dev/null || echo "")

# Start sidecars
COMPOSE_FILE="$ORBIT_ROOT/docker/docker-compose.yml"
STARTED_SIDECARS=""

if [ -n "$SIDECARS" ]; then
    echo "Starting sidecars..."
    for sidecar in $SIDECARS; do
        echo "  Starting $sidecar..."
        docker compose -f "$COMPOSE_FILE" --profile "sidecar-$sidecar" up -d
        STARTED_SIDECARS="$STARTED_SIDECARS $sidecar"
    done
    echo ""
fi

# Update state
if [ -f "$ORBIT_ROOT/state.db" ]; then
    SIDECARS_JSON=$(python3 -c "import json; print(json.dumps('$SIDECARS'.split()))" 2>/dev/null || echo "[]")

    sqlite3 "$ORBIT_ROOT/state.db" << SQL
INSERT OR REPLACE INTO project_state (project, current_env, last_activity, sidecars_running)
VALUES ('$PROJECT_PATH', 'staging', datetime('now'), '$SIDECARS_JSON');

INSERT INTO audit_log (project, command, environment, success)
VALUES ('$PROJECT_PATH', 'switch_env:staging', 'staging', 1);
SQL
fi

echo "Switched to staging environment"
if [ -n "$STARTED_SIDECARS" ]; then
    echo "Sidecars started:$STARTED_SIDECARS"
fi
echo ""
echo "Staging env uses Docker with staging-like configuration."
echo "Run /orbit use dev to return to local development."
