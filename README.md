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
   npm install -g @orbit/core
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

## 📂 Project Structure

- `orbit-mcp/`: TypeScript source for the MCP server.
- `scripts/`: Implementation logic for installation, detection, and environment management.
- `docker/`: Dockerfiles and compose templates for various runtimes.
- `config/`: Global configuration schemas and default settings.

---

*Focus on the vibe, let Orbit handle the infra.*
