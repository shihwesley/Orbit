#!/bin/bash
# Orbit Stop Hook
# Analyzes the final task state and suggests/triggers environment switching.
# Runs asynchronously to avoid blocking agent completion.

# Read session info from stdin
SESSION_INFO=$(cat)
SESSION_ID=$(echo "$SESSION_INFO" | jq -r '.session_id // empty' 2>/dev/null)
PROJECT=$(echo "$SESSION_INFO" | jq -r '.cwd // empty' 2>/dev/null)

# Resolve plugin root
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Source utilities from plugin, state.db stays at ~/.orbit/
source "$PLUGIN_ROOT/scripts/orbit-utils.sh"

[ -z "$SESSION_ID" ] || [ -z "$PROJECT" ] && exit 0
[ ! -f "$PROJECT/.orbit/config.json" ] && exit 0

TASK_DIR="$HOME/.claude/tasks/$SESSION_ID"
[ ! -d "$TASK_DIR" ] && exit 0

# Find the most relevant task
LATEST_TASK=$(ls -t "$TASK_DIR"/*.json 2>/dev/null | head -n 1)
[ -z "$LATEST_TASK" ] && exit 0

TASK_CONTENT=$(cat "$LATEST_TASK")
SUBJECT=$(echo "$TASK_CONTENT" | jq -r '.subject' | tr '[:upper:]' '[:lower:]')
DESC=$(echo "$TASK_CONTENT" | jq -r '.description' | tr '[:upper:]' '[:lower:]')

# Simple inference logic
NEW_ENV="dev"
[[ "$SUBJECT" == *"test"* ]] || [[ "$DESC" == *"test"* ]] || [[ "$SUBJECT" == *"verify"* ]] && NEW_ENV="test"
[[ "$SUBJECT" == *"staging"* ]] || [[ "$DESC" == *"staging"* ]] && NEW_ENV="staging"
[[ "$SUBJECT" == *"prod"* ]] || [[ "$DESC" == *"deploy"* ]] && NEW_ENV="prod"

# Get current environment
CURRENT_ENV=$(sqlite3 "$DB_PATH" "SELECT current_env FROM project_state WHERE project='$PROJECT'" 2>/dev/null)
CURRENT_ENV="${CURRENT_ENV:-dev}"

# If env changed, suggest switch or trigger it
if [ "$NEW_ENV" != "$CURRENT_ENV" ]; then
    echo "[Orbit] Task analysis suggests switching to: $NEW_ENV (Current: $CURRENT_ENV)"
    # We don't automatically switch here to avoid surprises, 
    # but we inform the agent so it can suggest it to the user.
    # The agent reading this output will see the suggestion.
fi
