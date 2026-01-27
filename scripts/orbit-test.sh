#!/bin/bash
# Run tests in Docker container
# Usage: orbit-test.sh [--fresh] [project_path]

set -e

FRESH=false
PROJECT_PATH="${1:-.}"

# Parse flags
for arg in "$@"; do
    case $arg in
        --fresh)
            FRESH=true
            shift
            ;;
        *)
            PROJECT_PATH="$arg"
            ;;
    esac
done

PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"
ORBIT_ROOT="$HOME/.orbit"

# Source utilities
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

echo "=== Orbit Test ==="
echo "Project: $PROJECT_NAME"
echo "Type: $PROJECT_TYPE"
echo "Sidecars: ${SIDECARS:-none}"
echo ""

# Build command
COMPOSE_FILE="$ORBIT_ROOT/docker/docker-compose.yml"

export PROJECT_PATH
export ORBIT_ROOT
export PROJECT_TYPE
export NODE_ENV=test
export CI=true

# Start sidecars if defined
if [ -n "$SIDECARS" ]; then
    echo "Starting sidecars..."
    for sidecar in $SIDECARS; do
        docker compose -f "$COMPOSE_FILE" --profile "sidecar-$sidecar" up -d
    done
    echo "Waiting for sidecars to be healthy..."
    sleep 3
fi

# Build args
BUILD_ARGS=""
if [ "$FRESH" = true ]; then
    echo "Fresh build (no cache)..."
    BUILD_ARGS="--no-cache"
fi

# Run tests
echo "Building and running tests..."
START_TIME=$(date +%s)

docker compose -f "$COMPOSE_FILE" --profile "$PROJECT_TYPE" build $BUILD_ARGS
TEST_EXIT_CODE=0
docker compose -f "$COMPOSE_FILE" --profile "$PROJECT_TYPE" run --rm "test-$PROJECT_TYPE" || TEST_EXIT_CODE=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Log to audit
GIT_COMMIT=$(cd "$PROJECT_PATH" && git rev-parse --short HEAD 2>/dev/null || echo "")
SUCCESS=$( [ $TEST_EXIT_CODE -eq 0 ] && echo 1 || echo 0 )

log_audit "$PROJECT_PATH" "test" "test" $SUCCESS $((DURATION * 1000)) "$GIT_COMMIT" ""

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "Tests PASSED (${DURATION}s)"
else
    echo "Tests FAILED (${DURATION}s)"
fi

exit $TEST_EXIT_CODE
