#!/bin/bash
# Orbit Shared Utilities
# Centralized logic for Docker checks, JSON parsing, and path resolution

ORBIT_ROOT="$HOME/.orbit"
DB_PATH="$ORBIT_ROOT/state.db"

# 1. Error handling
error() {
    echo "ERROR: $1" >&2
    exit 1
}

warn() {
    echo "WARNING: $1" >&2
}

# 2. Docker Utilities
check_docker() {
    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. Install Docker Desktop or docker.io"
    fi
    if ! docker info &>/dev/null 2>&1; then
        error "Docker daemon is not running. Start Docker Desktop."
    fi
}

# 3. JSON Utilities (Prefer jq, fallback to Node)
# Usage: get_json_val <file> <key> [default]
get_json_val() {
    local file="$1"
    local key="$2"
    local default="$3"
    local val=""

    if [ ! -f "$file" ]; then
        echo "$default"
        return
    fi

    if command -v jq &>/dev/null; then
        val=$(jq -r "$key" "$file" 2>/dev/null)
    else
        val=$(node -e "
            try {
                const data = JSON.parse(require('fs').readFileSync('$file', 'utf8'));
                const keys = '$key'.split('.').map(k => k.replace(/^\\./, ''));
                let result = data;
                for (const k of keys) {
                    if (k === '') continue;
                    result = result[k];
                }
                console.log(result === undefined || result === null ? '' : result);
            } catch(e) { console.log(''); }
        ")
    fi

    if [ -z "$val" ] || [ "$val" == "null" ]; then
        echo "$default"
    else
        echo "$val"
    fi
}

# 4. Path Utilities
get_abs_path() {
    echo "$(cd "$1" && pwd)"
}

# 5. Audit Logging
log_audit() {
    local project="$1"
    local command="$2"
    local env="$3"
    local success="$4"
    local duration="${5:-0}"
    local commit="${6:-}"
    local error_msg="${7:-}"

    if [ -f "$DB_PATH" ]; then
        sqlite3 "$DB_PATH" << SQL
INSERT INTO audit_log (project, command, environment, duration_ms, git_commit, success, error_message)
VALUES ('$project', '$command', '$env', $duration, '$commit', $success, '$error_msg');

UPDATE project_state
SET current_env = '$env', last_activity = datetime('now')
WHERE project = '$project';
SQL
    fi
}
