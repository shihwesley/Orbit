---
name: orbit
description: Manage dev/test/staging/prod environments for projects
---

# Orbit Environment Manager

Ambient environment management for `~/Source/` projects.

## MCP Tools

The Orbit MCP server provides these tools. **Prefer MCP tools when available**:

| Tool | Purpose |
|------|---------|
| `orbit_status` | Get current environment status |
| `orbit_switch_env` | Switch to dev/test/staging |
| `orbit_get_state` | Query projects, audit log, registry |
| `orbit_sidecars` | List/start/stop sidecars |
| `orbit_stop_all` | Stop all Orbit containers |
| `orbit_prod` | Deploy to production (Vercel/Railway) |

## Command Routing

Parse user input:

- `/orbit` or `/orbit status` → [Status](#orbit-status)
- `/orbit init` → [Init](#orbit-init)
- `/orbit test [--fresh]` → [Test](#orbit-test---fresh)
- `/orbit staging` → [Staging](#orbit-staging)
- `/orbit prod` → [Prod](#orbit-prod)
- `/orbit use <env>` → [Use](#orbit-use-env)
- `/orbit sidecars [action] [name]` → [Sidecars](#orbit-sidecars)
- `/orbit logs [limit]` → [Logs](#orbit-logs)
- `/orbit stop` → [Stop All](#orbit-stop)
- `/orbit check` → [Parity Check](#orbit-check)
- `/orbit templates` → [Templates](#orbit-templates)

---

## /orbit status

Show current environment state.

### With MCP (preferred)

```
Call orbit_status with project_path = <cwd>
```

### Without MCP

```bash
# Check initialization
if [ ! -f ".orbit/config.json" ]; then
  echo "Project not initialized. Run /orbit init"
  exit 1
fi

# Show config
cat .orbit/config.json

# Query state
sqlite3 ~/.orbit/state.db "SELECT current_env, last_activity FROM project_state WHERE project = '$(pwd)';"
sqlite3 ~/.orbit/state.db "SELECT timestamp, command, success FROM audit_log WHERE project = '$(pwd)' ORDER BY timestamp DESC LIMIT 5;"
```

### Output format

```
Project: <name>
Type: <node|python|go|rust>
Environment: <dev|test|staging>
Sidecars: <running sidecars or "none">

Recent activity:
  <timestamp> <command> <success/fail>
  ...
```

---

## /orbit init

Initialize Orbit for current project.

### Step 1: Detect type

```bash
~/.orbit/scripts/detect-project.sh .
```

Returns `type|supported` (e.g., `node|yes`).

### Step 2: Confirm with user

Use AskUserQuestion:

```
question: "Detected project type: <type>. Initialize Orbit?"
options:
  - "Yes, initialize as <type>"
  - "No, cancel"
```

If unsupported (`swift|no` or `xcode|no`):

```
Orbit currently supports: Node.js, Python, Go, Rust
Swift/Xcode support planned for future release.
```

Stop here.

### Step 3: Initialize

```bash
~/.orbit/scripts/orbit-init.sh . <type>
```

### Step 4: Confirm

```
Orbit initialized for <project>
Type: <type>
Config: .orbit/config.json

Edit .orbit/config.json to add sidecars if needed.
```

---

## /orbit test [--fresh]

Run tests in fresh Docker container.

### Prerequisites

- Docker installed and running
- Project initialized

### Execution

```bash
~/.orbit/scripts/orbit-test.sh [--fresh] .
```

### What happens

1. Checks Docker available
2. Starts declared sidecars
3. Builds Docker image (--fresh skips cache)
4. Runs tests in container
5. Logs result to audit
6. Reports pass/fail with duration

### If Docker unavailable

```
Docker required for /orbit test.
Install: brew install --cask docker (macOS)
         sudo apt-get install docker.io (Linux)
```

---

## /orbit staging

Switch to staging environment (Docker with staging env vars).

### With MCP (preferred)

```
Call orbit_switch_env with:
  environment: "staging"
  project_path: <cwd>
```

### Without MCP

```bash
# Check Docker
~/.orbit/scripts/check-docker.sh check || {
  echo "Docker required for staging environment"
  exit 1
}

# Start sidecars
SIDECARS=$(python3 -c "import json; print(' '.join(json.load(open('.orbit/config.json')).get('sidecars', [])))")
for sidecar in $SIDECARS; do
  docker compose -f ~/.orbit/docker/docker-compose.yml --profile sidecar-$sidecar up -d
done

# Update state
sqlite3 ~/.orbit/state.db "UPDATE project_state SET current_env = 'staging', last_activity = datetime('now') WHERE project = '$(pwd)';"
```

### Output

```
Switched to staging environment
Sidecars started: <list>
```

---

## /orbit prod

Deploy to production. **Requires confirmation.**

### With MCP (preferred)

```
Call orbit_prod with:
  confirm: true
  project_path: <cwd>
```

### Without MCP

#### Step 1: Check readiness

- Project must be initialized
- Should have passing tests (`/orbit test`)
- Check `.orbit/config.json` for prod configuration

### Step 2: Confirm with user

Use AskUserQuestion:

```
question: "Deploy to production?"
options:
  - "Yes, deploy now"
  - "No, cancel"
```

### Step 3: Deploy

Read prod config from `.orbit/config.json`:

```json
{
  "prod": {
    "provider": "vercel",
    "method": "cli"
  }
}
```

**If method = "cli":**

```bash
# Vercel
vercel deploy --prod

# Railway
railway up
```

**If method = "github-actions":**

```
Push to trigger deployment workflow.
Ensure .github/workflows/<provider>-deploy.yml exists.
```

### Step 4: Log result

```bash
sqlite3 ~/.orbit/state.db "INSERT INTO audit_log (project, command, environment, success) VALUES ('$(pwd)', 'deploy', 'prod', 1);"
```

---

## /orbit use <env>

Manually override environment (dev/test/staging).

### With MCP (preferred)

```
Call orbit_switch_env with:
  environment: <env>
  project_path: <cwd>
```

### Without MCP

**Switch to dev:**

```bash
# Stop containers (dev is local)
docker compose -f ~/.orbit/docker/docker-compose.yml down 2>/dev/null || true

# Update state
sqlite3 ~/.orbit/state.db "UPDATE project_state SET current_env = 'dev', sidecars_running = '[]', last_activity = datetime('now') WHERE project = '$(pwd)';"

echo "Switched to dev (local) environment"
```

**Switch to test/staging:**

```bash
# Requires Docker
~/.orbit/scripts/check-docker.sh check || exit 1

# Start sidecars
# ... (same as staging)

# Update state
sqlite3 ~/.orbit/state.db "UPDATE project_state SET current_env = '<env>', last_activity = datetime('now') WHERE project = '$(pwd)';"
```

---

## /orbit sidecars

Manage sidecar services.

### With MCP (preferred)

```
# List
Call orbit_sidecars with action: "list"

# Start
Call orbit_sidecars with action: "start", sidecar: "<name>"

# Stop
Call orbit_sidecars with action: "stop", sidecar: "<name>"
```

### Available sidecars

| Name | Service | Port |
|------|---------|------|
| postgres | PostgreSQL 15 | 5432 |
| redis | Redis 7 | 6379 |
| mysql | MySQL 8 | 3306 |
| mongodb | MongoDB 7 | 27017 |
| rabbitmq | RabbitMQ 3 | 5672, 15672 |
| aws | LocalStack | 4566 |

### Configure in project

Edit `.orbit/config.json`:

```json
{
  "sidecars": ["postgres", "redis"]
}
```

### Manual control

```bash
# Start
docker compose -f ~/.orbit/docker/docker-compose.yml --profile sidecar-<name> up -d

# Stop
docker compose -f ~/.orbit/docker/docker-compose.yml --profile sidecar-<name> down

# Status
docker compose -f ~/.orbit/docker/docker-compose.yml ps
```

---

## /orbit logs

Show recent audit log entries.

### With MCP (preferred)

```
Call orbit_get_state with:
  query_type: "audit"
  project_path: <cwd>
  limit: 20
```

### Without MCP

```bash
sqlite3 -header -column ~/.orbit/state.db \
  "SELECT timestamp, command, environment,
          CASE success WHEN 1 THEN 'ok' ELSE 'fail' END as result,
          duration_ms
   FROM audit_log
   WHERE project = '$(pwd)'
   ORDER BY timestamp DESC
   LIMIT 20;"
```

### Output format

```
Recent activity for <project>:

TIMESTAMP            COMMAND    ENV      RESULT  DURATION
2024-01-15 10:30:00  test       test     ok      12500ms
2024-01-15 10:25:00  init       dev      ok      -
...
```

---

## /orbit stop

Stop all Orbit containers.

### With MCP (preferred)

```
Call orbit_stop_all with confirm: true
```

### Without MCP

```bash
docker compose -f ~/.orbit/docker/docker-compose.yml down

# Clear sidecar state for all projects
sqlite3 ~/.orbit/state.db "UPDATE project_state SET sidecars_running = '[]';"

echo "Stopped all Orbit containers"
```

---

---

## /orbit check

Check version parity between local toolchain and project requirements.

### Execution

```bash
~/.orbit/scripts/check-parity.sh .
```

### Output

```json
{
  "status": "ok|warning",
  "project_type": "node",
  "tool": "node",
  "local_version": "20.10.0",
  "required_version": "20",
  "warnings": []
}
```

### If mismatch detected

```
⚠️ Version parity warning:
Project expects Node 20, you have Node 18
Consider updating or use /orbit test for consistent environment
```

---

## /orbit templates

Copy GitHub Actions workflow templates to project.

### Available templates

| Template | File | Purpose |
|----------|------|---------|
| ci | ci.yml | Basic CI (build + test) |
| vercel | vercel-deploy.yml | Deploy to Vercel |
| railway | railway-deploy.yml | Deploy to Railway |

### Usage

```bash
mkdir -p .github/workflows
cp ~/.orbit/templates/<template>.yml .github/workflows/
```

### Example

```
/orbit templates ci
→ Copies ci.yml to .github/workflows/ci.yml
   Edit to uncomment your project type (Node/Python/Go/Rust)
```

---

## Workspace Support

Orbit detects monorepos/workspaces automatically during `/orbit init`:

### Detected workspace types

| Type | Detection |
|------|-----------|
| npm | `package.json` with `workspaces` |
| pnpm | `pnpm-workspace.yaml` |
| cargo | `Cargo.toml` with `[workspace]` |
| go | `go.work` file |

### Workspace behavior

- Root project registered in registry
- Sub-projects tracked in `.orbit/config.json`
- Shared sidecars across sub-projects

### Check workspace

```bash
~/.orbit/scripts/detect-workspace.sh .
# Returns: type|subprojects (e.g., "npm|packages/a,packages/b")
```

---

## Quick Reference

| Command | Action |
|---------|--------|
| `/orbit` | Show status |
| `/orbit init` | Initialize project |
| `/orbit test` | Run tests in Docker |
| `/orbit test --fresh` | Run tests (no cache) |
| `/orbit staging` | Switch to staging |
| `/orbit prod` | Deploy to production |
| `/orbit use dev` | Switch to local dev |
| `/orbit use test` | Switch to test env |
| `/orbit sidecars` | List sidecars |
| `/orbit sidecars start postgres` | Start PostgreSQL |
| `/orbit sidecars stop redis` | Stop Redis |
| `/orbit logs` | Show audit history |
| `/orbit stop` | Stop all containers |
| `/orbit check` | Version parity check |
| `/orbit templates ci` | Copy CI template |
