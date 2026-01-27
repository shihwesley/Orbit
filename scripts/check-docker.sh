#!/bin/bash
# Check Docker installation and daemon status
# Returns JSON with status info

set -e

check_docker() {
    local installed=false
    local running=false
    local version=""
    local platform=""
    local install_hint=""

    # Detect platform
    case "$(uname -s)" in
        Darwin)
            platform="macos"
            install_hint="brew install --cask docker  # or download from docker.com/products/docker-desktop"
            ;;
        Linux)
            platform="linux"
            if command -v apt-get &>/dev/null; then
                install_hint="sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2"
            elif command -v dnf &>/dev/null; then
                install_hint="sudo dnf install -y docker docker-compose"
            elif command -v pacman &>/dev/null; then
                install_hint="sudo pacman -S docker docker-compose"
            else
                install_hint="See https://docs.docker.com/engine/install/"
            fi
            ;;
        MINGW*|CYGWIN*|MSYS*)
            platform="windows"
            install_hint="Download Docker Desktop from docker.com/products/docker-desktop"
            ;;
        *)
            platform="unknown"
            install_hint="See https://docs.docker.com/engine/install/"
            ;;
    esac

    # Check if docker command exists
    if command -v docker &>/dev/null; then
        installed=true
        version=$(docker --version 2>/dev/null | head -1 || echo "unknown")

        # Check if daemon is running
        if docker info &>/dev/null 2>&1; then
            running=true
        fi
    fi

    # Output JSON
    cat << EOF
{
  "installed": $installed,
  "running": $running,
  "version": "$version",
  "platform": "$platform",
  "install_hint": "$install_hint"
}
EOF
}

# Parse args
case "${1:-json}" in
    json)
        check_docker
        ;;
    status)
        # Human-readable status
        if command -v docker &>/dev/null; then
            if docker info &>/dev/null 2>&1; then
                echo "Docker: installed and running"
                docker --version
            else
                echo "Docker: installed but NOT running"
                echo "Start Docker Desktop or run: sudo systemctl start docker"
            fi
        else
            echo "Docker: NOT installed"
            case "$(uname -s)" in
                Darwin)
                    echo "Install: brew install --cask docker"
                    ;;
                Linux)
                    echo "Install: sudo apt-get install docker.io (or see docker.com)"
                    ;;
                *)
                    echo "Install: See https://docs.docker.com/engine/install/"
                    ;;
            esac
        fi
        ;;
    check)
        # Exit code based on status (for conditionals)
        if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
            exit 0
        else
            exit 1
        fi
        ;;
    *)
        echo "Usage: check-docker.sh [json|status|check]"
        exit 1
        ;;
esac
