---
name: orbit
description: Manage dev/test/staging/prod environments for projects
---

# Orbit Environment Manager

Ambient environment management for `~/Source/` projects.

## Commands

Parse user input to determine command:
- `/orbit` or `/orbit status` → Status
- `/orbit init` → Init
- `/orbit test [--fresh]` → Test (Phase 3+)
- `/orbit staging` → Staging (Phase 3+)
- `/orbit prod` → Prod (Phase 7)
- `/orbit use <env>` → Manual override (Phase 5)
- `/orbit logs` → Audit history (Phase 5)

---

## /orbit status

Show current environment state for the project in the working directory.

```bash
# Check if project is initialized
if [ -f ".orbit/config.json" ]; then
  cat .orbit/config.json
else
  echo "Project not initialized. Run /orbit init"
fi
```

Query global state if `~/.orbit/state.db` exists:
```sql
SELECT * FROM project_state WHERE project = '<cwd>';
SELECT * FROM audit_log WHERE project = '<cwd>' ORDER BY timestamp DESC LIMIT 5;
```

---

## /orbit init

Initialize Orbit for current project.

### Step 1: Detect Project Type

Run detection script:
```bash
~/.orbit/scripts/detect-project.sh .
```

Returns `type|supported` (e.g., `node|yes` or `swift|no`).

Detection priority:
| File | Type | Supported |
|------|------|-----------|
| `package.json` | node | yes |
| `requirements.txt` | python | yes |
| `pyproject.toml` | python | yes |
| `go.mod` | go | yes |
| `Cargo.toml` | rust | yes |
| `Package.swift` | swift | no |
| `*.xcodeproj` | xcode | no |

### Step 2: Confirm with User

Use AskUserQuestion to confirm detected type:

```
Detected project type: [type]
Is this correct?
- Yes, initialize as [type]
- No, let me specify
```

If unsupported (swift/xcode):
```
Detected: [type] (not yet supported)
Orbit currently supports: Node.js, Python, Go, Rust
Swift/Xcode support is planned for a future release.
```
Then stop.

### Step 3: Run Init Script

After user confirms, run:
```bash
~/.orbit/scripts/orbit-init.sh . <type>
```

This script:
- Creates `.orbit/config.json` with type-specific defaults
- Registers project in `~/.orbit/registry.json`
- Logs to `~/.orbit/state.db`

### Step 4: Confirm Success

Output:
```
Orbit initialized for <project_name>
Type: <type>
Config: .orbit/config.json

Next: Edit .orbit/config.json to add sidecars if needed
```

---

---

## /orbit test [--fresh]

Run tests in a fresh Docker container (clean-room testing).

### Prerequisites
- Docker must be installed and running
- Project must be initialized (`/orbit init`)

### Execution

```bash
~/.orbit/scripts/orbit-test.sh [--fresh] .
```

**Flags:**
- `--fresh`: Skip Docker cache, rebuild from scratch

### What it does
1. Checks Docker is available
2. Reads project type from `.orbit/config.json`
3. Starts declared sidecars (postgres, redis, etc.)
4. Builds Docker image using language-specific Dockerfile
5. Runs tests in container
6. Logs result to audit database
7. Reports pass/fail with duration

### If Docker not available
Tell user:
```
Docker is required for /orbit test.
Run: brew install --cask docker (macOS)
Or: sudo apt-get install docker.io (Linux)
```

---

## /orbit sidecars

Manage sidecar services (databases, caches, etc.)

### List available sidecars
- postgres (PostgreSQL 15)
- redis (Redis 7)
- mysql (MySQL 8)
- mongodb (MongoDB 7)
- rabbitmq (RabbitMQ 3)
- aws (LocalStack for S3, SQS, DynamoDB, etc.)

### Configure sidecars
Edit `.orbit/config.json`:
```json
{
  "sidecars": ["postgres", "redis"]
}
```

### Start/stop sidecars manually
```bash
# Start
docker compose -f ~/.orbit/docker/docker-compose.yml --profile sidecar-postgres up -d

# Stop
docker compose -f ~/.orbit/docker/docker-compose.yml --profile sidecar-postgres down
```

---

## Not Yet Implemented

These commands require later phases:

- `/orbit staging` - Phase 3+ (staging env with staging vars)
- `/orbit prod` - Phase 7 (Cloud deploy)
- `/orbit use <env>` - Phase 5 (MCP server)
- `/orbit logs` - Phase 5 (full implementation)

For now, inform user these are coming soon.
