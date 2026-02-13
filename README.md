# Orbit

[![npm version](https://img.shields.io/npm/v/@shihwesley/orbit)](https://www.npmjs.com/package/@shihwesley/orbit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

Auto-managed dev/test/staging environments for Claude Code. Orbit watches what you're doing and switches your environment to match — no manual Docker commands, no config juggling.

```
$ /orbit status

  Project:  my-api (node)
  Env:      test
  Backend:  Docker Sandbox (microVM)
  Network:  deny-all
  Sidecars: postgres (running), redis (running)

  Recent:
    14:02  Switched to test (task: "run unit tests")
    14:01  Started sidecar postgres
    14:01  Started sidecar redis
```

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Install](#install)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Sidecars](#sidecars)
- [Docker Sandbox Integration](#docker-sandbox-integration)
- [Sandbox Configuration](#sandbox-configuration)
- [Updating](#updating)
- [Contributing](#contributing)
- [License](#license)

## How It Works

Orbit has two halves:

- **MCP Server** — background daemon that monitors your Claude Code tasks, classifies them by environment (using Haiku), and spins up the right Docker containers automatically.
- **Skill** — `/orbit` slash commands for when you want direct control.

When you start writing tests, Orbit moves you to an isolated test container. When you're back to coding, it drops you into local dev. No prompts, no switching.

## Features

- **Ambient switching** — moves between local dev and Docker-based test/staging based on your current task
- **Lazy sidecars** — declares PostgreSQL, Redis, etc. in config; starts them only when the environment needs them
- **Clean-room testing** — runs tests in disposable Docker containers for real isolation
- **MicroVM sandboxes** — uses Docker Sandboxes (hypervisor-backed) when available, falls back to hardened containers
- **Network policies** — per-project allow/deny lists control what containers can reach
- **Multi-runtime** — supports Node.js, Python, Go, and Rust projects

## Install

### Claude Code Plugin (recommended)

```bash
/plugin marketplace add shihwesley/shihwesley-plugins
/plugin install orbit@shihwesley-plugins
```

Restart Claude Code to load the MCP server and hooks.

### npm

```bash
npm install -g @shihwesley/orbit
orbit setup
```

Creates `~/.orbit/`, initializes the database, and registers the MCP server.

### Requirements

- macOS (primary target)
- Node.js >= 20
- Docker Desktop (for test and staging environments)
- Claude Code CLI

## Quick Start

```bash
# Navigate to your project
cd ~/my-cool-project

# Initialize — auto-detects project type, creates .orbit/config.json
/orbit init

# That's it. Orbit is now watching your tasks.
# To manually switch environments:
/orbit switch test
```

Orbit detects your project type (Node, Python, Go, Rust) and writes a `.orbit/config.json` with sensible defaults.

## Commands

| Command | What it does |
|---------|-------------|
| `/orbit status` | Current environment, sidecars, sandbox backend, recent activity |
| `/orbit switch <env>` | Switch to `dev`, `test`, or `staging` |
| `/orbit sidecars list` | Show declared sidecars and their state |
| `/orbit sidecars start <name>` | Start a specific sidecar |
| `/orbit sidecars stop <name>` | Stop a specific sidecar |
| `orbit_sandbox status` | Check sandbox capabilities and running instances |
| `orbit_sandbox create` | Create a sandbox for the current project |
| `orbit_sandbox reset` | Destroy and recreate (fast reset) |
| `orbit_sandbox remove` | Tear down the sandbox |

## Sidecars

Declare dependencies in `.orbit/config.json`:

```json
{
  "type": "node",
  "sidecars": ["postgres", "redis"]
}
```

Orbit lazy-loads these containers when you enter `test` or `staging`. They stop when you switch back to `dev`.

## Docker Sandbox Integration

Orbit integrates with [Docker Sandboxes](https://www.docker.com/blog/docker-sandboxes-for-coding-agents/) — microVM-based isolation built for coding agents. Each sandbox gets its own kernel via a hypervisor, so agents can run arbitrary code without touching the host.

| Environment | Isolation | Why |
|-------------|-----------|-----|
| dev | Local folder | You're driving, no isolation needed |
| test | MicroVM (Docker Sandbox) | Agents run arbitrary code — hypervisor isolation |
| staging | Containers (docker-compose) | Must mirror production infrastructure |
| prod | Cloud (Vercel, Railway) | Real deployment |

When you switch to `test`, Orbit:

1. Detects if Docker Sandboxes are available
2. Creates a microVM with only your project workspace mounted
3. Applies network policies from `.orbit/config.json`
4. Falls back to hardened containers (cap_drop ALL, read-only rootfs, no-new-privileges) on Linux or older Docker Desktop

Agents can `docker build` and `docker run` inside the sandbox — they hit an isolated Docker daemon, never the host.

## Sandbox Configuration

Control network isolation per-project in `.orbit/config.json`:

```json
{
  "type": "node",
  "sidecars": ["postgres"],
  "sandbox": {
    "network": {
      "mode": "allow",
      "allow": ["registry.npmjs.org", "github.com"]
    }
  }
}
```

| Mode | Behavior |
|------|----------|
| `deny-all` (default) | No outbound network |
| `allow` | Only listed domains reachable |
| `open` | Full network, optional deny list |

> Docker Sandboxes require Docker Desktop with sandbox support (macOS/Windows). Linux uses hardened containers automatically.

## Updating

**Plugin:**

Updates arrive through the marketplace. Run `/plugin marketplace update` to check.

**npm:**

```bash
npm install -g @shihwesley/orbit@latest
orbit setup
```

Restart Claude Code after updating.

## Contributing

Bug reports and PRs welcome at [github.com/shihwesley/Orbit](https://github.com/shihwesley/Orbit).

For development:

```bash
git clone https://github.com/shihwesley/Orbit.git
cd Orbit/orbit-mcp
npm install
npm run dev
```

## License

[MIT](LICENSE)
