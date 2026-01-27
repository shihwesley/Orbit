# Orbit: Implementation Plan

**Architecture**: Hybrid (MCP Server + Claude Skill)

**For**: Vibe coders who want ambient environment management

---

## User Review Required

> [!IMPORTANT]
> **Self-Enforcement**: Installation injects protocol into `~/.claude/CLAUDE.md` so agents automatically use Orbit.

> [!WARNING]
> **Docker Dependency**: Test, staging envs require Docker. Dev env is local-only.

> [!NOTE]
> **MCP Server**: Background process monitors tasks, auto-manages environments.

---

## Proposed Changes

### Phase 0: Installation & Enforcement

#### [NEW] `~/.orbit/`
Global Orbit root directory with config, registry, state.db.

#### [MODIFY] `~/.claude/CLAUDE.md`
Inject enforcement protocol requiring agents to use Orbit.

#### [NEW] `~/.claude/.mcp.json` (or update existing)
Add orbit-mcp server configuration.

---

### Phase 1: Foundation

#### [NEW] `~/.orbit/config.json`
Environment definitions (dev/test/staging/prod), toolchain defaults, classification settings.

#### [NEW] `~/.orbit/registry.json`
Central catalog of all Orbit-managed projects.

#### [NEW] `~/.orbit/state.db`
SQLite database for audit log and project state tracking.

---

### Phase 2: Project Detection & Init

#### [NEW] `/orbit init` command (in skill)
- Auto-detect project type from files
- User confirmation via AskUserQuestion
- Create per-project `.orbit/config.json`
- Register in global registry

#### [NEW] `<project>/.orbit/config.json`
Per-project config: type, sidecars, test/build commands.

---

### Phase 3: Docker Infrastructure

#### [NEW] `~/.orbit/docker/`
- `node.dockerfile`
- `python.dockerfile`
- `go.dockerfile`
- `rust.dockerfile`
- `docker-compose.yml` (profiles for each language + sidecars)

---

### Phase 4: MCP Server

#### [NEW] `orbit-mcp/` (TypeScript MCP server)
- `taskWatcher.ts` - monitors Claude's TaskList
- `classifier.ts` - LLM-based task→env classification
- `dockerManager.ts` - container lifecycle
- `stateDb.ts` - SQLite operations
- Tools: `orbit_status`, `orbit_switch_env`, `orbit_get_state`, `orbit_start_sidecars`, `orbit_stop_all`

---

### Phase 5: /orbit Skill

#### [NEW] `~/.claude/commands/orbit.md`
Claude skill with commands:
- `/orbit status` - current state
- `/orbit init` - project setup
- `/orbit test [--fresh]` - run Docker tests
- `/orbit staging` - switch to staging
- `/orbit prod` - deploy with confirmation
- `/orbit use <env>` - manual override
- `/orbit sidecars` - sidecar management
- `/orbit logs` - audit history

---

### Phase 6: Workspace & Polish

#### [ENHANCE] Monorepo detection
Workspace-aware project registration.

#### [ENHANCE] Version parity
Warn when local toolchain doesn't match project requirements.

#### [NEW] `~/.orbit/templates/` (optional)
GitHub Actions workflow templates.

---

## Verification Plan

### Automated Tests
- [ ] `install.sh` creates directory structure
- [ ] Enforcement protocol injected into CLAUDE.md
- [ ] `/orbit init` detects project type correctly
- [ ] Registry updated on init
- [ ] MCP server starts and exposes tools
- [ ] Task classification returns valid env
- [ ] Docker containers start/stop correctly
- [ ] Sidecars lazy-load when declared
- [ ] Audit log records all actions

### Manual Verification
- [ ] Agent acknowledges enforcement protocol
- [ ] `/orbit status` shows meaningful output
- [ ] Environment auto-switches based on task
- [ ] `/orbit use <env>` overrides correctly
- [ ] Prod deployment requires confirmation

---

## Component Summary

| Component | Location | Type |
|-----------|----------|------|
| Global config | `~/.orbit/` | Directory |
| MCP Server | `orbit-mcp/` | TypeScript package |
| Skill | `~/.claude/commands/orbit.md` | Markdown |
| Per-project | `<project>/.orbit/` | Directory |
| Docker | `~/.orbit/docker/` | Dockerfiles + compose |
