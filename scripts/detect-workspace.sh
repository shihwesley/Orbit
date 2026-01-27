#!/bin/bash
# Detect if project is a monorepo/workspace
# Returns: workspace_type|subprojects (e.g., "npm|packages/a,packages/b" or "none|")

set -e

PROJECT_PATH="${1:-.}"

detect_workspace() {
    local dir="$1"

    # Check npm/yarn workspaces
    if [ -f "$dir/package.json" ]; then
        WORKSPACES=$(python3 << PYEOF
import json
import glob
import os

try:
    with open('$dir/package.json') as f:
        pkg = json.load(f)

    workspaces = pkg.get('workspaces', [])

    # Handle yarn workspaces format (can be object with packages key)
    if isinstance(workspaces, dict):
        workspaces = workspaces.get('packages', [])

    if workspaces:
        # Expand glob patterns
        all_dirs = []
        for pattern in workspaces:
            matches = glob.glob(os.path.join('$dir', pattern))
            for m in matches:
                if os.path.isdir(m) and os.path.exists(os.path.join(m, 'package.json')):
                    all_dirs.append(os.path.relpath(m, '$dir'))
        if all_dirs:
            print(f"npm|{','.join(sorted(all_dirs))}")
        else:
            print("none|")
    else:
        print("none|")
except:
    print("none|")
PYEOF
)
        if [ "$WORKSPACES" != "none|" ]; then
            echo "$WORKSPACES"
            return
        fi
    fi

    # Check pnpm workspaces
    if [ -f "$dir/pnpm-workspace.yaml" ]; then
        WORKSPACES=$(python3 << PYEOF
import yaml
import glob
import os

try:
    with open('$dir/pnpm-workspace.yaml') as f:
        config = yaml.safe_load(f)

    packages = config.get('packages', [])
    if packages:
        all_dirs = []
        for pattern in packages:
            # Remove negation patterns
            if pattern.startswith('!'):
                continue
            matches = glob.glob(os.path.join('$dir', pattern))
            for m in matches:
                if os.path.isdir(m):
                    all_dirs.append(os.path.relpath(m, '$dir'))
        if all_dirs:
            print(f"pnpm|{','.join(sorted(all_dirs))}")
        else:
            print("none|")
    else:
        print("none|")
except:
    print("none|")
PYEOF
)
        if [ "$WORKSPACES" != "none|" ]; then
            echo "$WORKSPACES"
            return
        fi
    fi

    # Check Cargo workspaces (Rust)
    if [ -f "$dir/Cargo.toml" ]; then
        WORKSPACES=$(python3 << PYEOF
import tomllib
import glob
import os

try:
    with open('$dir/Cargo.toml', 'rb') as f:
        config = tomllib.load(f)

    members = config.get('workspace', {}).get('members', [])
    if members:
        all_dirs = []
        for pattern in members:
            matches = glob.glob(os.path.join('$dir', pattern))
            for m in matches:
                if os.path.isdir(m) and os.path.exists(os.path.join(m, 'Cargo.toml')):
                    all_dirs.append(os.path.relpath(m, '$dir'))
        if all_dirs:
            print(f"cargo|{','.join(sorted(all_dirs))}")
        else:
            print("none|")
    else:
        print("none|")
except:
    print("none|")
PYEOF
)
        if [ "$WORKSPACES" != "none|" ]; then
            echo "$WORKSPACES"
            return
        fi
    fi

    # Check Go workspaces
    if [ -f "$dir/go.work" ]; then
        WORKSPACES=$(grep -E "^\s*use\s+" "$dir/go.work" 2>/dev/null | awk '{print $2}' | tr '\n' ',' | sed 's/,$//')
        if [ -n "$WORKSPACES" ]; then
            echo "go|$WORKSPACES"
            return
        fi
    fi

    echo "none|"
}

detect_workspace "$PROJECT_PATH"
