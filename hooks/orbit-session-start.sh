#!/bin/bash
# Orbit SessionStart Hook
# Checks if project is initialized with Orbit and shows current environment.
# Runs asynchronously to avoid blocking session start.

# Read session info from stdin (Claude Code passes JSON)
SESSION_INFO=$(cat)
PROJECT=$(echo "$SESSION_INFO" | jq -r '.cwd // empty' 2>/dev/null)

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOME/.orbit/scripts/orbit-utils.sh"

# Exit if no project or not an Orbit project
[ -z "$PROJECT" ] && exit 0
[ ! -f "$PROJECT/.orbit/config.json" ] && exit 0

# Get current environment from database
ENV=$(sqlite3 "$DB_PATH" "SELECT current_env FROM project_state WHERE project='$PROJECT'" 2>/dev/null)
ENV="${ENV:-dev}"

# Output status (will appear in Claude's context)
echo "[Orbit] Project: $(basename "$PROJECT")"
echo "[Orbit] Environment: $ENV"

# If test/staging, check if sidecars should be started
if [ "$ENV" = "test" ] || [ "$ENV" = "staging" ]; then
    SIDECARS=$(jq -r '.sidecars // [] | join(",")' "$PROJECT/.orbit/config.json" 2>/dev/null)
    if [ -n "$SIDECARS" ] && [ "$SIDECARS" != "" ]; then
        echo "[Orbit] Sidecars configured: $SIDECARS"
    fi
fi
