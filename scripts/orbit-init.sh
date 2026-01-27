#!/bin/bash
# Initialize Orbit for a project
# Usage: orbit-init.sh <project_path> <type>

set -e

PROJECT_PATH="${1:-.}"
PROJECT_TYPE="${2:-unknown}"
ORBIT_ROOT="$HOME/.orbit"

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/orbit-utils.sh"

# Resolve absolute path
PROJECT_PATH=$(get_abs_path "$PROJECT_PATH")
PROJECT_NAME="$(basename "$PROJECT_PATH")"

# Ensure global orbit exists
[ ! -d "$ORBIT_ROOT" ] && error "~/.orbit not found. Run install.sh first."

# Set defaults based on type
case "$PROJECT_TYPE" in
    node)   TEST_CMD="npm test"; BUILD_CMD="npm run build" ;;
    python) TEST_CMD="pytest"; BUILD_CMD="pip install -e ." ;;
    go)     TEST_CMD="go test ./..."; BUILD_CMD="go build" ;;
    rust)   TEST_CMD="cargo test"; BUILD_CMD="cargo build --release" ;;
    *)      TEST_CMD=""; BUILD_CMD="" ;;
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

echo "Updating registry.json..."
if command -v jq &>/dev/null; then
    # Use jq if available
    jq --arg path "$PROJECT_PATH" \
       --arg type "$PROJECT_TYPE" \
       --arg ts "$TIMESTAMP" \
       '.projects[$path] = {"type": $type, "registered": $ts, "lastActivity": $ts}' \
       "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"
else
    # Better Node fallback than the previous Python one
    node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$REGISTRY', 'utf8'));
        data.projects['$PROJECT_PATH'] = {
            type: '$PROJECT_TYPE',
            registered: '$TIMESTAMP',
            lastActivity: '$TIMESTAMP'
        };
        fs.writeFileSync('$REGISTRY', JSON.stringify(data, null, 2));
    "
fi

# Log to audit database
log_audit "$PROJECT_PATH" "init" "dev" 1

# Detect workspace
WORKSPACE_INFO=$("$SCRIPT_DIR/detect-workspace.sh" "$PROJECT_PATH" 2>/dev/null || echo "none|")
WORKSPACE_TYPE=$(echo "$WORKSPACE_INFO" | cut -d'|' -f1)
WORKSPACE_MEMBERS=$(echo "$WORKSPACE_INFO" | cut -d'|' -f2)

if [ "$WORKSPACE_TYPE" != "none" ] && [ -n "$WORKSPACE_MEMBERS" ]; then
    # Update config with workspace info using Node
    node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('$PROJECT_PATH/.orbit/config.json', 'utf8'));
        config.workspace = {
            type: '$WORKSPACE_TYPE',
            members: '$WORKSPACE_MEMBERS'.split(',')
        };
        fs.writeFileSync('$PROJECT_PATH/.orbit/config.json', JSON.stringify(config, null, 2));
    "
    echo "Detected workspace: $WORKSPACE_TYPE"
fi

# Run parity check
PARITY=$("$SCRIPT_DIR/check-parity.sh" "$PROJECT_PATH" 2>/dev/null || echo '{"status":"skip"}')
PARITY_STATUS=$(echo "$PARITY" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    console.log(data.status || 'ok');
" 2>/dev/null || echo "ok")

if [ "$PARITY_STATUS" = "warning" ]; then
    echo ""
    echo "⚠️  Version parity warning detected. Run /orbit status for details."
fi

echo ""
echo "Orbit initialized for $PROJECT_NAME"
echo "Type: $PROJECT_TYPE"
echo "Config: .orbit/config.json"
if [ "$WORKSPACE_TYPE" != "none" ]; then
    echo "Workspace: $WORKSPACE_TYPE"
fi
