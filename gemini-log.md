# Gemini Code Audit Log - Orbit

## Identified Issues (Updated Analysis)

### 1. Logic Fragmentation (Scripts vs. MCP)

- **Issue**: Both `orbit-test.sh` (Bash) and `dockerManager.ts` (TS) implement the same Docker Compose logic.
- **Problem**: Inconsistent logging. `orbit-test.sh` writes to the SQLite DB via CLI, while MCP uses its own logic. This creates two sources of truth for how environments are managed.
- **Slop**: Redundant "Docker Check" boilerplate in almost every shell script.

### 2. Dependency Sprawl (Python for JSON)

- **Issue**: Shell scripts use `python3 -c "import json; ..."` to parse project configs.
- **Problem**: Unnecessary dependency on Python. Since this is a Node.js project, we should either use `jq` (already used in some scripts) or a small Node helper to keep the toolchain lean.

### 3. Simplistic Project Detection

- **Issue**: `detect-project.sh` only checks for the presence of a few files.
- **Problem**: Misses nuanced detection (e.g., distinguishing between a generic Node project and a specific framework that might need special Docker logic).

### 4. Brittle Container Tracking

- **Issue**: `dockerManager.ts` filters containers using `.includes('orbit')`.
- **Problem**: This will pull in any container with "orbit" in the name, even if it's not part of the Orbit management system. Should use labels or stricter filtering.

### 5. Config Path Sloppiness

- **Issue**: `install.sh` handles `.mcp.json` vs `settings.json` vs `CLAUDE.md`.
- **Slop**: The logic for updating these files is spread out and uses multiple different methods (cat, node -e, grep).

### 6. Missing Validation in Hooks

- **Issue**: `orbit-session-start.sh` and `orbit-stop.sh` assume specific directory structures and database locations.
- **Problem**: Lack of "Orbit not installed" checks can lead to silent failures or messy error output in Claude's context.

## Changes Made (Refactor Phase)

### 1. Centralized Utility Layer

- **New File**: `scripts/orbit-utils.sh`.
- **Logic**: Consolidates Docker checks, path resolution, and JSON parsing.
- **Benefit**: Zero logic duplication across scripts. All scripts now source these utils.

### 2. Standardized JSON Tooling

- **Change**: Replaced all Python-based JSON parsing heredocs with `jq` (as primary) or a lightweight `node` fallback.
- **Benefit**: Removed the dependency on Python and improved script performance.

### 3. Robust Container Tracking

- **Change**: Added `com.orbit.managed=true` and `com.orbit.type` labels to `docker-compose.yml`.
- **Change**: Updated `dockerManager.ts` to filter containers by labels rather than brittle name-based matching.
- **Benefit**: Prevents Orbit from interfering with other containers and vice-versa.

### 4. Advanced Project Detection

- **Change**: Enhanced `detect-project.sh` to support specific frameworks (Next.js, Remix, Django, FastAPI).
- **Benefit**: Allows for more tailored environment management in future updates.

### 5. Hook Robustness

- **Change**: Refactored `SessionStart` and `Stop` hooks to use the centralized utility layer and improved error handling for unitialized projects.
- **Benefit**: Smoother user experience in Claude Code CLI.

## Phase 3: Strategic Pivot (Staging vs Prod)

- **Finding**: Production deployment is complex and out of scope for a general-purpose environment manager. Users prefer Orbit to focus on environment fidelity.
- **Action**: Removed `orbit_prod` and `orbit-deploy.sh`.
- **Enhancement**: Refocused `Staging` as a high-fidelity production-mimic (using `NODE_ENV=production` and build-time recreates).
- **Enhancement**: Refocused `Test` as an isolated sandbox environment.
