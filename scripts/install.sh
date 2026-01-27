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
for script in detect-project.sh orbit-init.sh; do
    if [ -f "$REPO_ROOT/scripts/$script" ]; then
        cp "$REPO_ROOT/scripts/$script" "$ORBIT_ROOT/scripts/$script"
        chmod +x "$ORBIT_ROOT/scripts/$script"
        echo "  Installed $script"
    fi
done

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

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Orbit root: $ORBIT_ROOT"
echo "Skill: $COMMANDS_DIR/orbit.md"
echo ""
echo "Next steps:"
echo "  1. Run '/orbit init' in a project to register it"
echo "  2. MCP server will be configured in Phase 4"
echo ""
