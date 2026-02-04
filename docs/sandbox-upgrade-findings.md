# Sandbox Upgrade: Findings & Decisions

## Goal
Upgrade Orbit's Docker infrastructure to integrate Docker Sandboxes (microVM isolation) for full agent autonomy, security hardening, network isolation, and instant reset — making Orbit the orchestration layer on top of Docker's sandbox backend.

## Priority
All of the Above — comprehensive overhaul covering autonomy, security, DX, and reset speed.

## Approach
**Integrate with Docker Sandboxes** — use `docker sandbox` CLI/API as the backend when available. Orbit becomes the smart orchestration layer that manages sandboxes per-project. Fall back to enhanced containers when Docker Sandboxes aren't available.

## Requirements (User-Validated)
1. **MicroVM isolation** — Replace standard containers with hypervisor-backed microVMs via Docker Sandboxes
2. **Network isolation controls** — Allow/deny lists for agent network access, per-project config
3. **Docker-in-Docker for agents** — Agents can build/run containers inside sandbox, no host daemon access
4. **Instant reset & multi-agent** — Fast teardown/recreate, support multiple agents per sandbox
5. **Security hardening** — AI security concerns: prevent data exfiltration, credential leakage, supply chain attacks from agent actions

## Current State Analysis

### What Orbit Has Today
- Standard Docker containers via `docker-compose.yml`
- 4 language-specific Dockerfiles (node, python, go, rust)
- Sidecar services (postgres, redis, mysql, mongodb, rabbitmq, localstack)
- Profile-based service selection
- Volume mounts for project workspace + dependency caches
- Labels for Orbit management (`com.orbit.managed`, `com.orbit.type`)

### Gaps vs Docker Sandboxes
| Feature | Orbit Current | Docker Sandbox | Gap |
|---------|--------------|----------------|-----|
| Isolation level | Container (shared kernel) | MicroVM (hypervisor) | Critical |
| Network control | None | Allow/deny lists | Critical |
| Docker-in-Docker | Not supported | Isolated Docker daemon | Major |
| Reset speed | Rebuild container (~30s+) | Delete+recreate (~seconds) | Moderate |
| Agent autonomy | Needs permission config | Full by design | Major |
| Security boundary | Container namespace | Hypervisor + namespace | Critical |
| Multi-agent | One container per service | Multiple agents per sandbox | Moderate |

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Integrate Docker Sandboxes, not build our own | Less reinvention, leverage Docker's security investment |
| Keep fallback to enhanced containers | Docker Sandboxes are macOS/Windows only (no Linux yet) |
| Per-project sandbox config in `.orbit/config.json` | Consistent with existing Orbit config approach |
| Network allow/deny in config | Project-specific network policies |
| Security-first defaults | Deny-all network, workspace-only mounts, no host Docker |
| **MicroVM for test only, containers for staging** | Test env = agent autonomy (untrusted execution → microVM isolation). Staging env = production parity (must match deploy target → containers). MicroVM in staging masks container-specific bugs and adds a boundary that doesn't exist in prod. |

## Environment → Isolation Strategy
| Environment | Isolation | Why |
|-------------|-----------|-----|
| **dev** | Local folder | Active development, no isolation needed |
| **test** | MicroVM (Docker Sandbox) | Agent runs arbitrary code, installs packages, needs full autonomy. Threat model: untrusted execution. |
| **staging** | Containers (docker-compose) | Must mirror production infrastructure (ECS, Cloud Run, K8s). Threat model: config/parity bugs, not agent escape. |
| **prod** | Cloud platform | Vercel/Railway/AWS — real deployment |

## Security Considerations (AI Agent Specific)
- **Credential isolation**: Agents must not access host SSH keys, cloud credentials, or tokens unless explicitly configured
- **Network egress control**: Prevent agents from exfiltrating data to arbitrary endpoints
- **Supply chain**: Sandboxed package installs can't poison host caches
- **Docker daemon isolation**: Agent's Docker commands affect sandbox only
- **File system boundary**: Only project workspace mounted, not home directory
- **Audit logging**: Track what agents do inside sandbox for review

## Research Findings
- Docker Sandboxes use `docker sandbox` CLI (experimental, macOS/Windows)
- MicroVM isolation via Docker Desktop's built-in hypervisor (Apple Virtualization.framework on macOS)
- No Linux support yet — need fallback strategy
- `docker sandbox create`, `docker sandbox exec`, `docker sandbox rm` are the key commands
- Network policies configurable at sandbox level
