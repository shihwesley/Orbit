# Gemini Code Audit Log - Orbit

## Identified Issues (Pre-Refactor)

### 1. `install.sh` - Bloated & Hybrid Complexity

- **Issue**: Uses a mix of Bash and Python to edit JSON files.
- **Problem**: Creates a dependency on Python for a Node.js project installation. It's bloated because it requires 20+ lines of Python heredoc to perform a simple JSON insertion.
- **Slop**: Over-reliance on `2>/dev/null || true` masks potential failures in core installation steps.

### 2. `orbit-mcp/src/index.ts` - Bloated Switch Statement

- **Issue**: The `CallToolRequestSchema` handler contains a large, manual `switch` statement over tool names.
- **Problem**: Adding new tools requires updating multiple places. This is a classic "bloat" pattern that lacks scalability.
- **Slop**: Tool registration (in `TOOLS` array) is disconnected from the implementation, leading to potential drift.

### 3. `orbit-mcp/src/dockerManager.ts` - Blocking "Slop"

- **Issue**: Extensive use of `execSync` for Docker commands.
- **Problem**: `execSync` blocks the entire Node.js event loop. Since Docker commands (especially `build` and `up`) can take several minutes, the MCP server becomes unresponsive to other requests (like `orbit_status` or environment classification).
- **Slop**: Hardcoded paths to `~/.orbit` inside the manager logic instead of using a centralized configuration or dependency injection.

### 4. `orbit-mcp/src/tools/*.ts` - Redundant "Slop"

- **Issue**: Every tool manually resolves `project_path`, checks for `.orbit` existence, and reads `config.json`.
- **Problem**: Significant code duplication across `status.ts`, `switchEnv.ts`, `sidecars.ts`, etc.
- **Slop**: Use of synchronous `fs` methods (`readFileSync`, `existsSync`) in what should be an asynchronous MCP server.

### 5. `orbit-mcp/src/stateDb.ts` - Basic Logic

- **Issue**: `getDb()` is called repeatedly, and the WAL mode is set on every call if `db` is null.
- **Slop**: Minimal abstraction over raw SQL queries.
