#!/bin/bash
# Orbit Stop Hook
# Analyzes the final task state and suggests/triggers environment switching.
# Runs asynchronously to avoid blocking agent completion.

# Read session info from stdin
SESSION_INFO=$(cat)
SESSION_ID=$(echo "$SESSION_INFO" | jq -r '.session_id // empty' 2>/dev/null)
PROJECT=$(echo "$SESSION_INFO" | jq -r '.cwd // empty' 2>/dev/null)

[ -z "$SESSION_ID" ] || [ -z "$PROJECT" ] && exit 0
[ ! -f "$PROJECT/.orbit/config.json" ] && exit 0

TASK_DIR="$HOME/.claude/tasks/$SESSION_ID"
[ ! -d "$TASK_DIR" ] && exit 0

# Find the most relevant task (latest in_progress or latest modified)
LATEST_TASK=$(ls -t "$TASK_DIR"/*.json 2>/dev/null | head -n 1)
[ -z "$LATEST_TASK" ] && exit 0

TASK_CONTENT=$(cat "$LATEST_TASK")
SUBJECT=$(echo "$TASK_CONTENT" | jq -r '.subject' | tr '[:upper:]' '[:lower:]')
DESC=$(echo "$TASK_CONTENT" | jq -r '.description' | tr '[:upper:]' '[:lower:]')

# Simple inference logic
NEW_ENV=""
if [[ "$SUBJECT" == *"test"* ]] || [[ "$DESC" == *"test"* ]] || [[ "$SUBJECT" == *"verify"* ]]; then
    NEW_ENV="test"
elif [[ "$SUBJECT" == *"staging"* ]] || [[ "$DESC" == *"staging"* ]]; then
    NEW_ENV="staging"
elif [[ "$SUBJECT" == *"prod"* ]] || [[ "$DESC" == *"deploy"* ]]; then
    NEW_ENV="prod"
else
    NEW_ENV="dev"
fi

# Get current env from Orbit state
ORBIT_ROOT="$HOME/.orbit"
DB_PATH="$ORBIT_ROOT/state.db"
CURRENT_ENV=$(sqlite3 "$DB_PATH" "SELECT current_env FROM project_state WHERE project='$PROJECT'" 2>/dev/null)
CURRENT_ENV="${CURRENT_ENV:-dev}"

# If env changed, suggest switch or trigger it
if [ "$NEW_ENV" != "$CURRENT_ENV" ]; then
    echo "[Orbit] Task analysis suggests switching to: $NEW_ENV (Current: $CURRENT_ENV)"
    # We don't automatically switch here to avoid surprises, 
    # but we inform the agent so it can suggest it to the user.
    # The agent reading this output will see the suggestion.
fi
