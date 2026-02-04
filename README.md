# Orbit

**Orbit** is an ambient development environment management system designed for "vibe coders." It provides automatic, task-aware environment switching between Development, Testing, Staging, and Production, ensuring your workspace "just works" without manual intervention.

Orbit Uses a **hybrid architecture**:

- **MCP Server**: A background daemon that monitors your current tasks and auto-manages Docker containers and sidecars.
- **Claude Skill**: Provides explicit `/orbit` commands for human-in-the-loop control.

## 🚀 Key Features

- **Ambient Switching**: Automatically move between local dev and Docker-based test/staging environments based on your current goal.
- **Lazy Sidecars**: Declare dependencies like PostgreSQL or Redis in `.orbit/config.json`, and Orbit starts them only when needed.
- **Fresh-Room Testing**: Run test suites in disposable, fresh Docker containers to ensure isolated verification.
- **High-Fidelity Staging**: Local production-mimic containers for final verification before manual deployment.

## 🛠 Prerequisites

- **macOS** (Optimized for Mac systems)
- **Node.js**: >= 20.0.0
- **Docker**: Required for `test` and `staging` environments.
- **Claude Code CLI**: The primary interface for Orbit.

## 📦 Installation

To install Orbit and its MCP server:

1. **Install globally via NPM**:

   ```bash
   npm install -g @shihwesley/orbit
   ```

2. **Run the setup command**:

   ```bash
   orbit setup
   ```

   This will create `~/.orbit/`, initialize the database, install the MCP server, and register it in `~/.claude.json`.

3. **Restart Claude Code** to load the MCP server, then run `orbit status` to verify.

## 🏁 Getting Started

Once installed, onboard any project in `~/`:

1. **Navigate to your project**:

    ```bash
    cd ~/my-cool-project
    ```

2. **Initialize Orbit**:

    ```bash
    /orbit init
    ```

    *Orbit will auto-detect your project type (Node, Python, Go, Rust) and create a `.orbit/config.json` file.*

## 🕹 Usage Examples

Orbit is designed to be ambient, but you can explicitly control it via these **integrated slash commands**:

### Check Status

`/orbit status`

### Switch Environments

`/orbit switch <env>`

- `dev`: Local development.
- `test`: Isolated test suite.
- `staging`: Production-mimic container.

### Manage Sidecars

`/orbit sidecars [list|start|stop <name>]`

## ⚓️ Sidecar Management

Declare sidecars in your project's `.orbit/config.json`:

```json
{
  "sidecars": ["postgres", "redis"]
}
```

Orbit will lazy-load these containers whenever you are in the `test` or `staging` environment.

## 🔄 Updating Orbit

To update the system and the MCP server:

1. **Update the global package**:

    ```bash
    npm install -g @shihwesley/orbit@latest
    ```

2. **Re-run setup** to apply configuration updates:

    ```bash
    orbit setup
    ```

3. **Restart your Claude session** to re-initialize the MCP server.

## 🔒 Docker Sandbox Integration (MicroVM Isolation)

Orbit now integrates with [Docker Sandboxes](https://www.docker.com/blog/docker-sandboxes-for-coding-agents/) — Docker's microVM-based isolation layer purpose-built for coding agents. This follows Docker's official recommendation for running AI agents like Claude Code, Codex CLI, and Gemini CLI safely, without constant permission prompts.

### Why MicroVMs?

Standard containers share the host kernel. When an agent installs packages, modifies system configs, or runs Docker commands inside a container, the isolation boundary is thinner than you'd want for untrusted execution. Docker Sandboxes solve this with **hypervisor-backed microVMs** — each agent gets a dedicated VM with its own kernel, so the host machine is protected at the hardware level.

### How Orbit Uses Sandboxes

| Environment | Isolation | Rationale |
|-------------|-----------|-----------|
| **dev** | Local folder | No isolation needed — you're driving |
| **test** | MicroVM (Docker Sandbox) | Agents run arbitrary code. Hypervisor isolation for untrusted execution |
| **staging** | Containers (docker-compose) | Must mirror production infrastructure. MicroVM would mask container-specific bugs |
| **prod** | Cloud platform | Real deployment (Vercel, Railway, AWS) |

When you switch to `test`, Orbit automatically:

1. **Detects** if Docker Sandboxes are available (`docker sandbox` CLI)
2. **Creates** a microVM with only your project workspace mounted
3. **Applies** per-project network policies (allow/deny lists from `.orbit/config.json`)
4. **Falls back** to hardened containers (cap_drop, read-only rootfs, no-new-privileges) on Linux or older Docker Desktop

### Sandbox Configuration

Add a `sandbox` key to your `.orbit/config.json` to control network isolation:

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

Network modes:
- **`deny-all`** (default) — No outbound network. Maximum security.
- **`allow`** — Only listed domains are reachable.
- **`open`** — Full network with optional deny list.

### Key Capabilities

- **Safe Docker access**: Agents can `docker build` and `docker run` inside the sandbox — they hit an isolated Docker daemon, never the host.
- **Instant reset**: If an agent goes off the rails, destroy and recreate the sandbox in seconds.
- **One sandbox, many agents**: Works with Claude Code, Copilot CLI, Codex CLI, Gemini CLI, and Kiro.
- **Automatic detection**: Orbit checks for sandbox support at runtime and falls back gracefully.

### Direct Sandbox Management

Use the `orbit_sandbox` MCP tool for direct control:

- `orbit_sandbox status` — Check sandbox capabilities and list running sandboxes
- `orbit_sandbox create` — Create a sandbox for the current project
- `orbit_sandbox reset` — Destroy and recreate (fast reset)
- `orbit_sandbox remove` — Tear down the sandbox
- `orbit_sandbox health` — Verify the sandbox runtime works

> **Note**: Docker Sandboxes require Docker Desktop with sandbox support (macOS/Windows). Linux environments automatically use hardened containers as a fallback.

## 📂 Project Structure

- `orbit-mcp/`: TypeScript source for the MCP server.
  - `src/sandboxDetector.ts`: Sandbox capability detection and health checks.
  - `src/sandboxManager.ts`: Sandbox lifecycle (create, exec, stop, reset, remove).
  - `src/sandboxPolicy.ts`: Network isolation and security policy engine.
  - `src/containerFallback.ts`: Hardened container fallback for non-sandbox environments.
  - `src/tools/sandbox.ts`: MCP tool for direct sandbox management.
- `scripts/`: Implementation logic for installation, detection, and environment management.
- `docker/`: Dockerfiles and compose templates for various runtimes.
- `config/`: Global configuration schemas and default settings.

---

*Focus on the vibe, let Orbit handle the infra.*
