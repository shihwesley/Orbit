#!/bin/bash
# Initialize Orbit for a project
# Usage: orbit-init.sh <project_path> <type>

set -e

PROJECT_PATH="${1:-.}"
PROJECT_TYPE="${2:-unknown}"
ORBIT_ROOT="$HOME/.orbit"

# Resolve absolute path
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"

# Ensure global orbit exists
if [ ! -d "$ORBIT_ROOT" ]; then
    echo "ERROR: ~/.orbit not found. Run install.sh first." >&2
    exit 1
fi

# Set defaults based on type
case "$PROJECT_TYPE" in
    node)
        TEST_CMD="npm test"
        BUILD_CMD="npm run build"
        ;;
    python)
        TEST_CMD="pytest"
        BUILD_CMD="pip install -e ."
        ;;
    go)
        TEST_CMD="go test ./..."
        BUILD_CMD="go build"
        ;;
    rust)
        TEST_CMD="cargo test"
        BUILD_CMD="cargo build --release"
        ;;
    *)
        TEST_CMD=""
        BUILD_CMD=""
        ;;
esac

# Create .orbit directory in project
mkdir -p "$PROJECT_PATH/.orbit"

# Write project config
cat > "$PROJECT_PATH/.orbit/config.json" << EOF
{
  "type": "$PROJECT_TYPE",
  "sidecars": [],
  "testCommand": "$TEST_CMD",
  "buildCommand": "$BUILD_CMD",
  "supported": true
}
EOF

echo "Created $PROJECT_PATH/.orbit/config.json"

# Update global registry
REGISTRY="$ORBIT_ROOT/registry.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if command -v jq &>/dev/null; then
    # Use jq if available
    jq --arg path "$PROJECT_PATH" \
       --arg type "$PROJECT_TYPE" \
       --arg ts "$TIMESTAMP" \
       '.projects[$path] = {"type": $type, "registered": $ts, "lastActivity": $ts}' \
       "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"
else
    # Fallback: simple append (less robust)
    echo "WARNING: jq not found, registry update may be imperfect"
    # Read existing, manually insert
    python3 << PYEOF
import json
with open("$REGISTRY", "r") as f:
    data = json.load(f)
data["projects"]["$PROJECT_PATH"] = {
    "type": "$PROJECT_TYPE",
    "registered": "$TIMESTAMP",
    "lastActivity": "$TIMESTAMP"
}
with open("$REGISTRY", "w") as f:
    json.dump(data, f, indent=2)
PYEOF
fi

echo "Updated registry.json"

# Log to audit database
if [ -f "$ORBIT_ROOT/state.db" ]; then
    sqlite3 "$ORBIT_ROOT/state.db" << SQL
INSERT INTO audit_log (project, command, environment, success)
VALUES ('$PROJECT_PATH', 'init', 'dev', 1);

INSERT OR REPLACE INTO project_state (project, current_env, last_activity)
VALUES ('$PROJECT_PATH', 'dev', datetime('now'));
SQL
    echo "Updated state.db"
fi

echo ""
echo "Orbit initialized for $PROJECT_NAME"
echo "Type: $PROJECT_TYPE"
echo "Config: .orbit/config.json"
