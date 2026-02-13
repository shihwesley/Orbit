#!/bin/bash
# Switch to staging environment
# Usage: orbit-staging.sh [project_path]

set -e

PROJECT_PATH="${1:-.}"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"
# Source utilities (sets ORBIT_ROOT for assets, ORBIT_STATE for persistent data)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/orbit-utils.sh"

check_docker

# Check project is initialized
[ ! -f "$PROJECT_PATH/.orbit/config.json" ] && error "Project not initialized. Run /orbit init first."

# Get config
CONFIG="$PROJECT_PATH/.orbit/config.json"
PROJECT_TYPE=$(get_json_val "$CONFIG" ".type")
[ -z "$PROJECT_TYPE" ] && error "Could not determine project type from .orbit/config.json"

SIDECARS=$(get_json_val "$CONFIG" ".sidecars | join(\" \")")

echo "=== Orbit Staging (Production-Mimic) ==="
echo "Project: $PROJECT_NAME"
echo "Type: $PROJECT_TYPE"
echo "Status: Running high-fidelity verification container"
echo ""

# Build command (staging uses internal compose flow with production-like settings)
COMPOSE_FILE="$ORBIT_ROOT/docker/docker-compose.yml"

export PROJECT_PATH
export ORBIT_ROOT
export PROJECT_TYPE
export NODE_ENV=production
export CI=true

# Deploy to staging
echo "Building and starting production-mimic staging container..."
START_TIME=$(date +%s)

docker compose -f "$COMPOSE_FILE" --profile "$PROJECT_TYPE" up -d --build --force-recreate
STAGING_EXIT_CODE=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Log to audit
GIT_COMMIT=$(cd "$PROJECT_PATH" && git rev-parse --short HEAD 2>/dev/null || echo "")
SUCCESS=$( [ $STAGING_EXIT_CODE -eq 0 ] && echo 1 || echo 0 )

log_audit "$PROJECT_PATH" "staging" "staging" $SUCCESS $((DURATION * 1000)) "$GIT_COMMIT" ""

if [ $STAGING_EXIT_CODE -eq 0 ]; then
    echo "Staging DEPLOYED successfully."
else
    echo "Staging DEPLOY FAILED."
fi

exit $STAGING_EXIT_CODE
