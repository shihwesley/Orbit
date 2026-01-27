#!/bin/bash
# Orbit Installation Script
# Creates global ~/.orbit infrastructure and injects enforcement protocol

set -e

# Standard paths for end users
ORBIT_ROOT="$HOME/.orbit"
CLAUDE_DIR="$HOME/.claude"
CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Orbit Installation ==="
echo ""

# Ensure ~/.claude exists
mkdir -p "$CLAUDE_DIR"

# Create directory structure
echo "Creating $ORBIT_ROOT..."
mkdir -p "$ORBIT_ROOT"
mkdir -p "$ORBIT_ROOT/docker"
mkdir -p "$ORBIT_ROOT/templates"
mkdir -p "$ORBIT_ROOT/scripts"

# Copy config.json from repo
if [ -f "$REPO_ROOT/config/config.json" ]; then
    cp "$REPO_ROOT/config/config.json" "$ORBIT_ROOT/config.json"
    echo "  Created config.json"
else
    echo "  WARNING: config/config.json not found in repo"
fi

# Copy helper scripts
for script in detect-project.sh orbit-init.sh check-docker.sh orbit-test.sh; do
    if [ -f "$REPO_ROOT/scripts/$script" ]; then
        cp "$REPO_ROOT/scripts/$script" "$ORBIT_ROOT/scripts/$script"
        chmod +x "$ORBIT_ROOT/scripts/$script"
        echo "  Installed $script"
    fi
done

# Copy Docker files
if [ -d "$REPO_ROOT/docker" ]; then
    cp "$REPO_ROOT/docker/"*.dockerfile "$ORBIT_ROOT/docker/" 2>/dev/null || true
    cp "$REPO_ROOT/docker/docker-compose.yml" "$ORBIT_ROOT/docker/" 2>/dev/null || true
    echo "  Installed Docker configs"
fi

# Initialize empty registry
if [ ! -f "$ORBIT_ROOT/registry.json" ]; then
    echo '{"projects": {}, "version": "1.0.0"}' > "$ORBIT_ROOT/registry.json"
    echo "  Created registry.json"
else
    echo "  registry.json already exists, skipping"
fi

# Initialize SQLite database
if [ ! -f "$ORBIT_ROOT/state.db" ]; then
    if [ -f "$REPO_ROOT/config/schema.sql" ]; then
        sqlite3 "$ORBIT_ROOT/state.db" < "$REPO_ROOT/config/schema.sql"
        echo "  Created state.db"
    else
        echo "  WARNING: config/schema.sql not found in repo"
    fi
else
    echo "  state.db already exists, skipping"
fi

# Check Docker status
echo ""
echo "Checking Docker..."
if command -v docker &>/dev/null; then
    if docker info &>/dev/null 2>&1; then
        echo "  Docker: installed and running"
        docker --version | sed 's/^/  /'
    else
        echo "  Docker: installed but NOT running"
        echo ""
        echo "  NOTE: Docker daemon is not running."
        echo "  /orbit test and /orbit staging require Docker."
        echo "  Start Docker Desktop or run: sudo systemctl start docker"
    fi
else
    echo "  Docker: NOT installed"
    echo ""
    echo "  NOTE: Docker is required for /orbit test and /orbit staging."
    echo "  Dev environment (/orbit init, /orbit status) works without Docker."
    echo ""
    case "$(uname -s)" in
        Darwin)
            echo "  To install Docker on macOS:"
            echo "    brew install --cask docker"
            echo "    # or download from docker.com/products/docker-desktop"
            ;;
        Linux)
            echo "  To install Docker on Linux:"
            if command -v apt-get &>/dev/null; then
                echo "    sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2"
            else
                echo "    See https://docs.docker.com/engine/install/"
            fi
            ;;
        *)
            echo "  See https://docs.docker.com/engine/install/"
            ;;
    esac
fi

# Inject enforcement protocol into CLAUDE.md
ENFORCEMENT_MARKER="## Environment Management (MANDATORY)"

if [ -f "$CLAUDE_MD" ]; then
    if grep -q "$ENFORCEMENT_MARKER" "$CLAUDE_MD"; then
        echo ""
        echo "Enforcement protocol already in $CLAUDE_MD, skipping"
    else
        echo ""
        echo "Injecting enforcement protocol into $CLAUDE_MD..."
        cat >> "$CLAUDE_MD" << 'ENFORCEMENT_EOF'

## Environment Management (MANDATORY)

All environment tasks MUST use the Orbit system.

- Orbit MCP server monitors your tasks and auto-manages environments
- Use `/orbit status` to see current state
- Use `/orbit init` in new projects
- Use `/orbit use <env>` to override auto-inferred environment
- Do NOT run raw `docker` commands unless Orbit is insufficient

**Note**: MCP server configuration added in Phase 4.
ENFORCEMENT_EOF
        echo "  Done"
    fi
else
    echo ""
    echo "Creating $CLAUDE_MD..."
    cat > "$CLAUDE_MD" << 'CLAUDE_EOF'
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code).

## Environment Management (MANDATORY)

All environment tasks MUST use the Orbit system.

- Orbit MCP server monitors your tasks and auto-manages environments
- Use `/orbit status` to see current state
- Use `/orbit init` in new projects
- Use `/orbit use <env>` to override auto-inferred environment
- Do NOT run raw `docker` commands unless Orbit is insufficient
CLAUDE_EOF
    echo "  Done"
fi

# Install skill
COMMANDS_DIR="$CLAUDE_DIR/commands"
mkdir -p "$COMMANDS_DIR"
if [ -f "$REPO_ROOT/skill/orbit.md" ]; then
    cp "$REPO_ROOT/skill/orbit.md" "$COMMANDS_DIR/orbit.md"
    echo ""
    echo "Installed /orbit skill to $COMMANDS_DIR/orbit.md"
fi

# Install MCP server
echo ""
echo "Installing MCP server..."
if [ -d "$REPO_ROOT/orbit-mcp" ]; then
    mkdir -p "$ORBIT_ROOT/mcp"
    cp -r "$REPO_ROOT/orbit-mcp/package.json" "$ORBIT_ROOT/mcp/"
    cp -r "$REPO_ROOT/orbit-mcp/tsconfig.json" "$ORBIT_ROOT/mcp/"
    cp -r "$REPO_ROOT/orbit-mcp/src" "$ORBIT_ROOT/mcp/"

    # Check if node_modules exists in source (pre-built) or need to install
    if [ -d "$REPO_ROOT/orbit-mcp/dist" ]; then
        cp -r "$REPO_ROOT/orbit-mcp/dist" "$ORBIT_ROOT/mcp/"
        cp -r "$REPO_ROOT/orbit-mcp/node_modules" "$ORBIT_ROOT/mcp/" 2>/dev/null || true
        echo "  Copied pre-built MCP server"
    else
        echo "  Building MCP server (this may take a moment)..."
        (cd "$ORBIT_ROOT/mcp" && npm install --silent && npm run build --silent)
        echo "  Built MCP server"
    fi

    # Update .mcp.json
    MCP_CONFIG="$CLAUDE_DIR/.mcp.json"
    if [ -f "$MCP_CONFIG" ]; then
        # Add orbit-mcp to existing config using python
        python3 << PYEOF
import json
import os

config_path = "$MCP_CONFIG"
orbit_root = "$ORBIT_ROOT"

with open(config_path, 'r') as f:
    config = json.load(f)

# Ensure mcpServers key exists
if 'mcpServers' not in config:
    config['mcpServers'] = {}

# Add orbit-mcp
config['mcpServers']['orbit-mcp'] = {
    "command": "node",
    "args": [os.path.join(orbit_root, "mcp", "dist", "index.js")]
}

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)
PYEOF
        echo "  Updated $MCP_CONFIG with orbit-mcp"
    else
        # Create new .mcp.json
        cat > "$MCP_CONFIG" << MCPEOF
{
  "mcpServers": {
    "orbit-mcp": {
      "command": "node",
      "args": ["$ORBIT_ROOT/mcp/dist/index.js"]
    }
  }
}
MCPEOF
        echo "  Created $MCP_CONFIG"
    fi
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Orbit root: $ORBIT_ROOT"
echo "Skill: $COMMANDS_DIR/orbit.md"
echo "MCP server: $ORBIT_ROOT/mcp/"
echo "MCP config: $CLAUDE_DIR/.mcp.json"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code to load the MCP server"
echo "  2. Run '/orbit init' in a project to register it"
echo "  3. Use '/orbit status' to check environment state"
echo ""
