#!/bin/bash
# Check version parity between local toolchain and project requirements
# Usage: check-parity.sh [project_path]
# Returns JSON with warnings

set -e

PROJECT_PATH="${1:-.}"
ORBIT_ROOT="$HOME/.orbit"

# Get expected versions from global config
get_expected_version() {
    local tool="$1"
    python3 -c "import json; print(json.load(open('$ORBIT_ROOT/config.json')).get('defaults', {}).get('$tool', ''))" 2>/dev/null || echo ""
}

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

# Check if project has custom version requirement
get_project_version() {
    local tool="$1"
    local project_config="$PROJECT_PATH/.orbit/config.json"

    if [ -f "$project_config" ]; then
        python3 -c "import json; print(json.load(open('$project_config')).get('versions', {}).get('$tool', ''))" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Detect project type
PROJECT_TYPE=""
if [ -f "$PROJECT_PATH/.orbit/config.json" ]; then
    PROJECT_TYPE=$(python3 -c "import json; print(json.load(open('$PROJECT_PATH/.orbit/config.json')).get('type', ''))" 2>/dev/null || echo "")
fi

# Determine which tool to check based on project type
TOOL=""
case "$PROJECT_TYPE" in
    node) TOOL="node" ;;
    python) TOOL="python" ;;
    go) TOOL="go" ;;
    rust) TOOL="rust" ;;
esac

if [ -z "$TOOL" ]; then
    echo '{"status": "skip", "message": "No project type detected", "warnings": []}'
    exit 0
fi

# Get versions
LOCAL_VERSION=$(get_local_version "$TOOL")
PROJECT_VERSION=$(get_project_version "$TOOL")
EXPECTED_VERSION=$(get_expected_version "$TOOL")

# Use project version if set, otherwise use global default
REQUIRED_VERSION="${PROJECT_VERSION:-$EXPECTED_VERSION}"

# Compare versions
WARNINGS="[]"
STATUS="ok"

if [ -z "$LOCAL_VERSION" ]; then
    STATUS="warning"
    WARNINGS=$(python3 -c "import json; print(json.dumps([{'tool': '$TOOL', 'message': '$TOOL not installed', 'local': None, 'required': '$REQUIRED_VERSION'}]))")
elif [ -n "$REQUIRED_VERSION" ]; then
    # Simple major version comparison
    LOCAL_MAJOR=$(echo "$LOCAL_VERSION" | cut -d. -f1)
    REQUIRED_MAJOR=$(echo "$REQUIRED_VERSION" | cut -d. -f1)

    if [ "$LOCAL_MAJOR" != "$REQUIRED_MAJOR" ]; then
        STATUS="warning"
        WARNINGS=$(python3 -c "import json; print(json.dumps([{'tool': '$TOOL', 'message': 'Version mismatch', 'local': '$LOCAL_VERSION', 'required': '$REQUIRED_VERSION'}]))")
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
