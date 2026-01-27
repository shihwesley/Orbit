#!/bin/bash
# Detect project type from files in current directory
# Returns: type|supported (e.g., "node|yes" or "swift|no")

set -e

detect_type() {
    local dir="${1:-.}"

    # Node-based detection (refined)
    if [ -f "$dir/package.json" ]; then
        if grep -q "\"next\"" "$dir/package.json"; then
            echo "node-next|yes"
        elif grep -q "\"@remix-run" "$dir/package.json"; then
            echo "node-remix|yes"
        elif grep -q "\"vite\"" "$dir/package.json"; then
            echo "node-vite|yes"
        else
            echo "node|yes"
        fi
    # Python-based detection
    elif [ -f "$dir/requirements.txt" ] || [ -f "$dir/pyproject.toml" ]; then
        if [ -f "$dir/manage.py" ]; then
            echo "python-django|yes"
        elif grep -q "fastapi" "$dir/requirements.txt" 2>/dev/null || grep -q "fastapi" "$dir/pyproject.toml" 2>/dev/null; then
            echo "python-fastapi|yes"
        else
            echo "python|yes"
        fi
    # Go/Rust/Swift
    elif [ -f "$dir/go.mod" ]; then
        echo "go|yes"
    elif [ -f "$dir/Cargo.toml" ]; then
        echo "rust|yes"
    elif [ -f "$dir/Package.swift" ]; then
        echo "swift|no"
    elif ls "$dir"/*.xcodeproj 1>/dev/null 2>&1; then
        echo "xcode|no"
    else
        echo "unknown|no"
    fi
}

detect_type "$1"
