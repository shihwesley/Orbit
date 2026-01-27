#!/bin/bash
# Deploy to production
# Usage: orbit-deploy.sh [project_path]
# Note: This script is called after user confirmation in the skill

set -e

PROJECT_PATH="${1:-.}"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"
ORBIT_ROOT="$HOME/.orbit"

# Check project initialized
if [ ! -f "$PROJECT_PATH/.orbit/config.json" ]; then
    echo "ERROR: Project not initialized. Run /orbit init first."
    exit 1
fi

echo "=== Orbit Deploy ==="
echo "Project: $PROJECT_NAME"
echo ""

# Read prod config
PROD_CONFIG=$(python3 << PYEOF
import json
import sys

try:
    with open('$PROJECT_PATH/.orbit/config.json') as f:
        config = json.load(f)
    prod = config.get('prod', {})
    provider = prod.get('provider', '')
    method = prod.get('method', 'cli')
    print(f"{provider}|{method}")
except Exception as e:
    print(f"error|{e}", file=sys.stderr)
    sys.exit(1)
PYEOF
)

PROVIDER=$(echo "$PROD_CONFIG" | cut -d'|' -f1)
METHOD=$(echo "$PROD_CONFIG" | cut -d'|' -f2)

if [ -z "$PROVIDER" ]; then
    echo "ERROR: No prod.provider configured in .orbit/config.json"
    echo ""
    echo "Add to .orbit/config.json:"
    echo '  "prod": {'
    echo '    "provider": "vercel",  // or "railway"'
    echo '    "method": "cli"        // or "github-actions"'
    echo '  }'
    exit 1
fi

echo "Provider: $PROVIDER"
echo "Method: $METHOD"
echo ""

START_TIME=$(date +%s)
SUCCESS=0
ERROR_MSG=""

case "$METHOD" in
    cli)
        case "$PROVIDER" in
            vercel)
                echo "Deploying with Vercel CLI..."
                if command -v vercel &>/dev/null; then
                    cd "$PROJECT_PATH"
                    if vercel deploy --prod; then
                        SUCCESS=1
                    else
                        ERROR_MSG="Vercel deployment failed"
                    fi
                else
                    ERROR_MSG="Vercel CLI not installed. Run: npm i -g vercel"
                fi
                ;;
            railway)
                echo "Deploying with Railway CLI..."
                if command -v railway &>/dev/null; then
                    cd "$PROJECT_PATH"
                    if railway up; then
                        SUCCESS=1
                    else
                        ERROR_MSG="Railway deployment failed"
                    fi
                else
                    ERROR_MSG="Railway CLI not installed. Run: npm i -g @railway/cli"
                fi
                ;;
            *)
                ERROR_MSG="Unknown provider: $PROVIDER"
                ;;
        esac
        ;;
    github-actions)
        echo "Triggering GitHub Actions workflow..."
        WORKFLOW_FILE=".github/workflows/${PROVIDER}-deploy.yml"
        if [ -f "$PROJECT_PATH/$WORKFLOW_FILE" ]; then
            echo "Push to main branch to trigger deployment."
            echo "Workflow: $WORKFLOW_FILE"
            SUCCESS=1
        else
            ERROR_MSG="Workflow not found: $WORKFLOW_FILE"
        fi
        ;;
    *)
        ERROR_MSG="Unknown method: $METHOD"
        ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Log to audit
if [ -f "$ORBIT_ROOT/state.db" ]; then
    sqlite3 "$ORBIT_ROOT/state.db" << SQL
INSERT INTO audit_log (project, command, environment, duration_ms, success, error_message)
VALUES ('$PROJECT_PATH', 'deploy:$PROVIDER', 'prod', $((DURATION * 1000)), $SUCCESS, $([ -n "$ERROR_MSG" ] && echo "'$ERROR_MSG'" || echo "NULL"));
SQL
fi

echo ""
if [ $SUCCESS -eq 1 ]; then
    echo "Deployment complete (${DURATION}s)"
else
    echo "Deployment FAILED: $ERROR_MSG"
    exit 1
fi
