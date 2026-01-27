# Orbit: Findings & Decisions

## Goal
Ambient dev environment management for ~/Source/ - auto-detects context, manages Docker envs, tracks state

## Design Decisions

### Core Behavior
| Decision | Rationale |
|----------|-----------|
| **Hybrid: MCP Server + Skill** | MCP for background automation, Skill for explicit control |
| Auto-trigger via hooks | User shouldn't need to remember commands |
| Task-based env inference | Read TaskList, use LLM to classify intent → env |
| Ask on ambiguity | Don't guess wrong, prompt user when unclear |
| Full audit log in state.db | Track every /orbit action for debugging/history |

### Project Detection & Config
| Decision | Rationale |
|----------|-----------|
| Auto-detect + confirm type | package.json=Node, requirements.txt=Python, etc., then confirm |
| `.orbit/` folder per project | Clear separation, easy to gitignore if needed |
| File-based detection | Simple, no magic, works offline |

### Docker / Test Environment
| Decision | Rationale |
|----------|-----------|
| Build + unit tests | Test env runs build and test suite |
| Flag-controlled caching | `--fresh` for clean, cached by default for speed |
| Lazy sidecar startup | Spin up Postgres/Redis on first need, not project entry |
| Skip unsupported platforms | visionOS/iOS apps marked incompatible, future extensibility |

### Staging / Production
| Decision | Rationale |
|----------|-----------|
| Pragmatic staging mimics | Simplest local approximation of prod (docker-compose profiles) |
| .env files for secrets | Simple, no external deps, per-environment files |
| Simple y/n for prod deploy | Don't over-engineer confirmation flow |
| **Docker = sandbox** | Container is the isolated clean-room for testing |
| **Vercel + Railway first** | Most vibe-coder friendly cloud providers |
| **CLI or GH Actions** | User chooses per project: direct deploy or CI/CD |

### Enforcement
| Decision | Rationale |
|----------|-----------|
| Auto-trigger hooks | Inject into CLAUDE.md, auto-run on context |
| LLM task classification | Smarter than keywords, understands intent |

## Resolved Questions

| Question | Decision |
|----------|----------|
| Sidecar detection | Explicit declaration in `.orbit/config.json` |
| Mimic fidelity | Same docker-compose services, env vars swapped |
| State.db schema | Standard: timestamp, project, command, env, duration, git_commit, success |
| Multi-project | Workspace awareness (monorepo/multi-project support) |

## Remaining Open Questions

1. **MCP polling**: Default 5s in config, can tune later
2. **MCP ↔ Claude Code integration**: How does MCP server actually access TaskList? (needs investigation during Phase 4)

## Architecture: Hybrid (MCP Server + Skill)

**Why hybrid?**
- MCP Server = background daemon (watches tasks, auto-manages envs)
- Skill = explicit CLI (user control, confirmations)
- Vibe coders get automation, power users get override

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code Session                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   /orbit skill ◄──────────────────► Orbit MCP Server        │
│   (explicit cmds)                   (background daemon)     │
│        │                                   │                │
│        │                                   ▼                │
│        │                          ┌───────────────┐         │
│        │                          │ Task Watcher  │         │
│        │                          │ (polls tasks) │         │
│        │                          └───────┬───────┘         │
│        │                                  │                 │
│        │                                  ▼                 │
│        │                          ┌───────────────┐         │
│        │                          │ LLM Classify  │         │
│        │                          │ task → env    │         │
│        │                          └───────┬───────┘         │
│        │                                  │                 │
│        ▼                                  ▼                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    state.db                          │   │
│   │  (audit log, project registry, current env state)    │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  Docker Engine                       │   │
│   │  ┌────────┐ ┌────────┐ ┌─────────┐ ┌─────────────┐  │   │
│   │  │  dev   │ │  test  │ │ staging │ │  sidecars   │  │   │
│   │  │(local) │ │(docker)│ │ (mimic) │ │ (lazy load) │  │   │
│   │  └────────┘ └────────┘ └─────────┘ └─────────────┘  │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### MCP Server Responsibilities
- Watch TaskList for changes (poll or hook)
- Classify tasks → infer environment via LLM
- Auto-start/stop Docker envs based on inferred need
- Manage sidecar lifecycle (lazy startup per .orbit/config)
- Maintain state.db audit log
- Expose tools: `orbit_status`, `orbit_switch_env`, `orbit_get_state`

### Skill Responsibilities
- `/orbit init` - interactive project setup with confirmations
- `/orbit status` - human-readable state summary
- `/orbit test [--fresh]` - explicit test trigger
- `/orbit staging` / `/orbit prod` - deployment with y/n confirmation
- `/orbit use <env>` - manual override of auto-inferred env

## Environment Flow

```
working on code → LLM reads tasks → infers env
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
               [dev tasks]          [test tasks]        [deploy tasks]
                    │                    │                    │
                    ▼                    ▼                    ▼
            ensure dev env       spin up test env      staging/prod flow
            (parity check)       + sidecars if needed   (confirmation)
```
