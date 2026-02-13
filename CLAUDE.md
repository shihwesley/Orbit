# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Orbit** is an ambient dev environment management system for `~/Source/`. Uses a hybrid architecture (MCP Server + Claude Skill) to auto-manage dev/test/staging/prod environments for vibe coders.

## Architecture

```
/orbit skill (explicit commands) ←→ Orbit MCP Server (background daemon)
                                          │
                                    Task Watcher → LLM Classifier (task → env)
                                          │
                                    state.db + Docker Engine
```

- **MCP Server**: Background process that monitors TaskList, uses LLM to classify tasks → environment, auto-manages Docker containers
- **Skill (`/orbit`)**: User-facing commands for explicit control
- **Docker containers**: Sandboxes for test/staging (clean-room testing)

## Environments

| Env | Location | Purpose |
|-----|----------|---------|
| dev | Local folder | Active development, parity checks |
| test | Docker container | Fresh install + unit tests (sandbox) |
| staging | Docker container | Prod-like config, UAT |
| prod | Vercel/Railway | Deployed via CLI or GH Actions |

## Key Files

- `PLAN.md` - Master plan with all 7 phases and state machine
- `IMPLEMENTATION_PLAN.md` - Concise build checklist
- `findings.md` - Design decisions from brainstorming sessions
- `TASK.md` - Implementation task list (outdated - use PLAN.md phases)

## Implementation Phases

0. Installation & Enforcement (inject protocol into `~/Source/CLAUDE.md`)
1. Foundation (config.json, registry.json, state.db)
2. Project Detection & Init (`/orbit init`)
3. Docker Infrastructure (Dockerfiles, compose, sidecars)
4. MCP Server (task watcher, LLM classifier, auto-management)
5. /orbit Skill (status/test/staging/prod/use commands)
6. Workspace & Polish (monorepo, parity checks)
7. Cloud Deploy (Vercel/Railway)

## Design Decisions

- **LLM classification** (Haiku) to infer task → environment
- **Ask on ambiguity** - prompt user when env unclear
- **Lazy sidecars** - declared in `.orbit/config.json`, started on demand
- **Docker = sandbox** - containers are disposable clean rooms
- **Vercel + Railway first** - vibe-coder friendly cloud providers

## Codebase Overview

Claude Code plugin with hybrid MCP Server (TypeScript) + Claude Skill + Bash scripts managing Docker-based dev/test/staging environments. 6 MCP tools, 11 shell scripts, 4 Dockerfiles, 6 sidecar services. Plugin-first distribution via shihwesley-plugins marketplace.

**Stack**: TypeScript, Node.js, Bash, Docker/Compose, SQLite, Zod, Commander.js
**Merkle root**: `1232a18d2a73`

For detailed architecture, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## When Resuming

Read `PLAN.md` first - it has the complete context, state machine diagram, and detailed specs for each phase.
