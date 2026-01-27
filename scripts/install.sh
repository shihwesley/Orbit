#!/bin/bash
# Orbit Installation Script - Refactored
# Creates global ~/.orbit infrastructure and injects enforcement protocol

set -e

# Standard paths
ORBIT_ROOT="$HOME/.orbit"
CLAUDE_DIR="$HOME/.claude"
CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"
MCP_CONFIG="$HOME/.claude.json"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Orbit Installation (Refactored) ==="
echo ""

# Ensure base directories exist
mkdir -p "$CLAUDE_DIR"
mkdir -p "$ORBIT_ROOT"/{docker,templates,scripts,mcp}

# 1. Install Global Files
echo "Installing global configuration and scripts..."

# Copy config and schema
[ -f "$REPO_ROOT/config/config.json" ] && cp "$REPO_ROOT/config/config.json" "$ORBIT_ROOT/config.json"
[ -f "$REPO_ROOT/config/schema.sql" ] && cp "$REPO_ROOT/config/schema.sql" "$ORBIT_ROOT/schema.sql"

# Copy scripts and make executable
for script in detect-project.sh detect-workspace.sh orbit-init.sh check-docker.sh check-parity.sh orbit-test.sh orbit-staging.sh orbit-deploy.sh; do
    if [ -f "$REPO_ROOT/scripts/$script" ]; then
        cp "$REPO_ROOT/scripts/$script" "$ORBIT_ROOT/scripts/$script"
        chmod +x "$ORBIT_ROOT/scripts/$script"
    fi
done

# Copy Docker configs
if [ -d "$REPO_ROOT/docker" ]; then
    cp "$REPO_ROOT/docker/"*.dockerfile "$ORBIT_ROOT/docker/" 2>/dev/null || true
    cp "$REPO_ROOT/docker/docker-compose.yml" "$ORBIT_ROOT/docker/" 2>/dev/null || true
fi

# Copy GitHub Actions templates
if [ -d "$REPO_ROOT/templates" ]; then
    cp "$REPO_ROOT/templates/"*.yml "$ORBIT_ROOT/templates/" 2>/dev/null || true
fi

# 2. Database & Registry Initialization
echo "Initializing state and registry..."
[ ! -f "$ORBIT_ROOT/registry.json" ] && echo '{"projects": {}, "version": "1.0.0"}' > "$ORBIT_ROOT/registry.json"

if [ ! -f "$ORBIT_ROOT/state.db" ]; then
    if command -v sqlite3 &>/dev/null; then
        sqlite3 "$ORBIT_ROOT/state.db" < "$ORBIT_ROOT/schema.sql"
    else
        echo "  WARNING: sqlite3 not found. state.db will be initialized by MCP server on first run."
        touch "$ORBIT_ROOT/state.db" # Create empty file so MCP server can find it
    fi
fi

# 3. Inject Enforcement Protocol
ENFORCEMENT_MARKER="## Environment Management (MANDATORY)"
PROTO_FILE="$REPO_ROOT/PLAN.md" # Or just heredoc

inject_protocol() {
    cat >> "$CLAUDE_MD" << 'ENFORCEMENT_EOF'

## Environment Management (MANDATORY)

All environment tasks MUST use the Orbit system.

- Orbit MCP server monitors your tasks and auto-manages environments
- Use `/orbit status` to see current state
- Use `/orbit init` in new projects
- Use `/orbit use <env>` to override auto-inferred environment
- Do NOT run raw `docker` commands unless Orbit is insufficient
ENFORCEMENT_EOF
}

if [ -f "$CLAUDE_MD" ]; then
    grep -q "$ENFORCEMENT_MARKER" "$CLAUDE_MD" || inject_protocol
else
    echo "# CLAUDE.md" > "$CLAUDE_MD"
    inject_protocol
fi

# 4. Install MCP Server
echo "Installing MCP server..."
cp -r "$REPO_ROOT/orbit-mcp/package.json" "$ORBIT_ROOT/mcp/"
cp -r "$REPO_ROOT/orbit-mcp/tsconfig.json" "$ORBIT_ROOT/mcp/"
cp -r "$REPO_ROOT/orbit-mcp/src" "$ORBIT_ROOT/mcp/"

if [ -d "$REPO_ROOT/orbit-mcp/dist" ]; then
    cp -r "$REPO_ROOT/orbit-mcp/dist" "$ORBIT_ROOT/mcp/"
    cp -r "$REPO_ROOT/orbit-mcp/node_modules" "$ORBIT_ROOT/mcp/" 2>/dev/null || true
    echo "  Using pre-built MCP server"
else
    echo "  Building MCP server..."
    (cd "$ORBIT_ROOT/mcp" && npm install --silent && npm run build --silent)
fi

# 5. Update .mcp.json (Pure Bash Logic for JSON insertion)
echo "Updating MCP configuration..."
INDEX_JS="$ORBIT_ROOT/mcp/dist/index.js"

if [ ! -f "$MCP_CONFIG" ]; then
    echo "{\"mcpServers\": {\"orbit-mcp\": {\"command\": \"node\", \"args\": [\"$INDEX_JS\"]}}}" > "$MCP_CONFIG"
else
    # Simple check if orbit-mcp is already there
    if ! grep -q "orbit-mcp" "$MCP_CONFIG"; then
        # Back up
        cp "$MCP_CONFIG" "$MCP_CONFIG.bak"
        # Use a simpler way to add the config if we don't want python
        # We can use node to do the JSON manipulation since it's a node project!
        node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$MCP_CONFIG', 'utf8'));
            data.mcpServers = data.mcpServers || {};
            data.mcpServers['orbit-mcp'] = {
                command: 'node',
                args: ['$INDEX_JS']
            };
            fs.writeFileSync('$MCP_CONFIG', JSON.stringify(data, null, 2));
        "
    fi
fi

# 6. Install Skill
COMMANDS_DIR="$CLAUDE_DIR/commands"
mkdir -p "$COMMANDS_DIR"
[ -f "$REPO_ROOT/skill/orbit.md" ] && cp "$REPO_ROOT/skill/orbit.md" "$COMMANDS_DIR/orbit.md"

echo ""
echo "=== Installation Complete ==="
echo "Restart Claude Code to apply changes."
