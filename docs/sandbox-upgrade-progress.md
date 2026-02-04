# Sandbox Upgrade: Progress Log

## Session: 2026-02-04

### Phase 1: Docker Sandbox Detection & Capability Check
- **Status:** complete
- **Branch:** `sandbox/p1-detection`
- **Files:** `orbit-mcp/src/sandboxDetector.ts`, `orbit-mcp/src/tools/status.ts`
- Detects `docker sandbox` CLI, Docker Desktop version, host platform
- Health check: throwaway sandbox smoke test with auto-cleanup
- Integrated into `orbit_status` tool output

### Phase 2: Sandbox Lifecycle Management
- **Status:** complete
- **Branch:** `sandbox/p2-lifecycle`
- **Files:** `orbit-mcp/src/sandboxManager.ts`
- create/exec/stop/reset/remove lifecycle
- Deterministic naming: `orbit-<project>-<env>`
- Workspace-only mounts (security default)
- `ensureIsolation()` auto-selects sandbox vs container backend

### Phase 3: Network Isolation & Security Policies
- **Status:** complete
- **Branch:** `sandbox/p3-network`
- **Files:** `orbit-mcp/src/sandboxPolicy.ts`
- Zod schema for `.orbit/config.json` sandbox key
- Security-first defaults: deny-all network, read-only root, no host Docker, caps dropped
- Policy-to-CLI-flags converter
- Human-readable policy descriptions

### Phase 4: Docker-in-Docker for Agents
- **Status:** complete
- **Branch:** `sandbox/p4-dind`
- **Files:** `orbit-mcp/src/sandboxManager.ts` (extended)
- `SandboxCreateOptions` with `enableDocker` flag + `extraFlags`
- `verifyDinD()` confirms isolated Docker daemon is running
- Options forwarded through reset and ensureIsolation

### Phase 5: Enhanced Fallback for Non-Sandbox
- **Status:** complete
- **Branch:** `sandbox/p5-fallback`
- **Files:** `orbit-mcp/src/containerFallback.ts`
- Compose security override: read-only rootfs, cap_drop ALL, no-new-privileges
- Memory/CPU limits, tmpfs for writable areas
- Uses docker compose `-f` layering (no base file modification)

### Phase 6: Skill & MCP Integration
- **Status:** complete
- **Branch:** `sandbox/p6-integration`
- **Files:** `orbit-mcp/src/tools/switchEnv.ts`, `orbit-mcp/src/tools/sandbox.ts`, `orbit-mcp/src/index.ts`
- switchEnv: test uses sandbox+DinD+policy, staging always containers
- New `orbit_sandbox` MCP tool (status/create/reset/remove/health)
- Registered in MCP server tool registry

## Dependency Graph
```
Phase 1 (Detection) ✅
  ├── Phase 2 (Lifecycle) ✅ ──── Phase 4 (DinD) ✅
  │      └──────────────────────── Phase 6 (Skill/MCP) ✅
  ├── Phase 3 (Network/Security) ✅ ── Phase 6 ✅
  └── Phase 5 (Fallback) ✅
```

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | All 6 phases implemented across worktrees |
| Where am I going? | Merge branches, integration testing, skill doc update |
| What's the goal? | Integrate Docker Sandboxes for agent autonomy + security |
| What have I learned? | Docker sandbox CLI flags for DinD, network, security; compose override layering for fallback |
| What have I done? | Built 5 new modules + updated 3 existing files across 6 worktree branches |
