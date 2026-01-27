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

# Check Docker
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is not installed."
    echo ""
    "$ORBIT_ROOT/scripts/check-docker.sh" status
    exit 1
fi

if ! docker info &>/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running."
    echo "Start Docker Desktop or run: sudo systemctl start docker"
    exit 1
fi

# Check project is initialized
if [ ! -f "$PROJECT_PATH/.orbit/config.json" ]; then
    echo "ERROR: Project not initialized. Run /orbit init first."
    exit 1
fi

# Get project type
PROJECT_TYPE=$(python3 -c "import json; print(json.load(open('$PROJECT_PATH/.orbit/config.json'))['type'])" 2>/dev/null)
if [ -z "$PROJECT_TYPE" ]; then
    echo "ERROR: Could not determine project type from .orbit/config.json"
    exit 1
fi

# Get sidecars
SIDECARS=$(python3 -c "import json; print(' '.join(json.load(open('$PROJECT_PATH/.orbit/config.json')).get('sidecars', [])))" 2>/dev/null)

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
if [ -f "$ORBIT_ROOT/state.db" ]; then
    SUCCESS=$( [ $TEST_EXIT_CODE -eq 0 ] && echo 1 || echo 0 )
    GIT_COMMIT=$(cd "$PROJECT_PATH" && git rev-parse --short HEAD 2>/dev/null || echo "")

    sqlite3 "$ORBIT_ROOT/state.db" << SQL
INSERT INTO audit_log (project, command, environment, duration_ms, git_commit, success)
VALUES ('$PROJECT_PATH', 'test', 'test', $((DURATION * 1000)), '$GIT_COMMIT', $SUCCESS);

UPDATE project_state
SET current_env = 'test', last_activity = datetime('now')
WHERE project = '$PROJECT_PATH';
SQL
fi

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "Tests PASSED (${DURATION}s)"
else
    echo "Tests FAILED (${DURATION}s)"
fi

exit $TEST_EXIT_CODE
