#!/bin/bash
# Detect project type from files in current directory
# Returns: type|supported (e.g., "node|yes" or "swift|no")

set -e

detect_type() {
    local dir="${1:-.}"

    # Priority order detection
    if [ -f "$dir/package.json" ]; then
        echo "node|yes"
    elif [ -f "$dir/requirements.txt" ]; then
        echo "python|yes"
    elif [ -f "$dir/pyproject.toml" ]; then
        echo "python|yes"
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
