#!/bin/bash
# Check version parity between local toolchain and project requirements
# Usage: check-parity.sh [project_path]
# Returns JSON with warnings

set -e

PROJECT_PATH="${1:-.}"
# Source utilities (sets ORBIT_ROOT for assets, ORBIT_STATE for persistent data)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/orbit-utils.sh"

# Get expected versions from global config
GLOBAL_CONFIG="$ORBIT_ROOT/config.json"
PROJECT_CONFIG="$PROJECT_PATH/.orbit/config.json"

# Get local version
get_local_version() {
    local tool="$1"
    case "$tool" in
        node)
            node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo ""
            ;;
        python)
            python3 --version 2>/dev/null | awk '{print $2}' | cut -d. -f1,2 || echo ""
            ;;
        go)
            go version 2>/dev/null | awk '{print $3}' | sed 's/go//' | cut -d. -f1,2 || echo ""
            ;;
        rust)
            rustc --version 2>/dev/null | awk '{print $2}' | cut -d. -f1,2 || echo ""
            ;;
        *)
            echo ""
            ;;
    esac
}

# Detect tool based on project type
PROJECT_TYPE=$(get_json_val "$PROJECT_CONFIG" ".type")
TOOL=""
case "$PROJECT_TYPE" in
    node)   TOOL="node" ;;
    python) TOOL="python" ;;
    go)     TOOL="go" ;;
    rust)   TOOL="rust" ;;
esac

if [ -z "$TOOL" ]; then
    echo '{"status": "skip", "message": "No project type detected", "warnings": []}'
    exit 0
fi

# Get versions
LOCAL_VERSION=$(get_local_version "$TOOL")
PROJECT_VERSION=$(get_json_val "$PROJECT_CONFIG" ".versions.$TOOL")
EXPECTED_VERSION=$(get_json_val "$GLOBAL_CONFIG" ".defaults.$TOOL")

REQUIRED_VERSION="${PROJECT_VERSION:-$EXPECTED_VERSION}"

# Compare
STATUS="ok"
WARNINGS="[]"

if [ -z "$LOCAL_VERSION" ]; then
    STATUS="warning"
    WARNINGS="[{\"tool\": \"$TOOL\", \"message\": \"$TOOL not installed\", \"local\": null, \"required\": \"$REQUIRED_VERSION\"}]"
elif [ -n "$REQUIRED_VERSION" ]; then
    LOCAL_MAJOR=$(echo "$LOCAL_VERSION" | cut -d. -f1)
    REQUIRED_MAJOR=$(echo "$REQUIRED_VERSION" | cut -d. -f1)

    if [ "$LOCAL_MAJOR" != "$REQUIRED_MAJOR" ]; then
        STATUS="warning"
        WARNINGS="[{\"tool\": \"$TOOL\", \"message\": \"Version mismatch\", \"local\": \"$LOCAL_VERSION\", \"required\": \"$REQUIRED_VERSION\"}]"
    fi
fi

# Output JSON
cat << EOF
{
  "status": "$STATUS",
  "project_type": "$PROJECT_TYPE",
  "tool": "$TOOL",
  "local_version": "$LOCAL_VERSION",
  "required_version": "$REQUIRED_VERSION",
  "warnings": $WARNINGS
}
EOF
