# Orbit

**Orbit** is an ambient development environment management system designed for "vibe coders." It provides automatic, task-aware environment switching between Development, Testing, Staging, and Production, ensuring your workspace "just works" without manual intervention.

Orbit Uses a **hybrid architecture**:

- **MCP Server**: A background daemon that monitors your current tasks and auto-manages Docker containers and sidecars.
- **Claude Skill**: Provides explicit `/orbit` commands for human-in-the-loop control.

## 🚀 Key Features

- **Ambient Switching**: Automatically move between local dev and Docker-based test/staging environments based on your current goal.
- **Lazy Sidecars**: Declare dependencies like PostgreSQL or Redis in `.orbit/config.json`, and Orbit starts them only when needed.
- **Fresh-Room Testing**: Run unit tests in disposable, fresh Docker containers to avoid "works on my machine" syndrome.
- **Self-Enforcement**: Injects a protocol into `~/.claude/CLAUDE.md` so that AI agents automatically follow your environment rules.

## 🛠 Prerequisites

- **macOS** (Optimized for Mac systems)
- **Node.js**: >= 20.0.0
- **Docker**: Required for `test` and `staging` environments.
- **Claude Code**: The primary interface for Orbit.

## 📦 Installation

To install Orbit and its MCP server:

1. **Clone the repository** (if you haven't already):

   ```bash
   git clone https://github.com/shihwesley/Orbit.git ~/Source/Orbit
   cd ~/Source/Orbit
   ```

2. **Run the installation script**:

   ```bash
   bash scripts/install.sh
   ```

   *This script will create the `~/.orbit` directory, initialize the audit database, and inject the enforcement protocol into your Claude configuration.*

3. **Verify MCP Setup**:
   Ensure `orbit-mcp` is listed in your `~/.claude/.mcp.json`. It will start automatically when Claude is active.

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

Orbit is designed to be ambient, but you can explicitly control it via the following commands:

### Check Status

```bash
/orbit status
```

Displays current environment, running containers, and latest audit logs.

### Run Fresh Tests

```bash
/orbit test
```

Starts a fresh Docker container, installs dependencies, and runs your test suite. Use `--fresh` to skip the Docker cache.

### Manual Environment Overrides

If Orbit doesn't switch automatically, you can force it:

```bash
/orbit use staging  # Switch to staging (Docker-based)
/orbit use dev      # Switch back to local development
```

While you can trigger this manually:

```bash
/orbit prod
```

Orbit's ambient logic will **automatically** call this hook when it detects a deployment-related task in your `TASK.md`, `PLAN.md`, or current code activity. It will push to production (e.g., Vercel or Railway) after a mandatory confirmation prompt.

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

1. **Pull the latest changes**:

    ```bash
    cd ~/Orbit
    git pull
    ```

2. **Re-run the installation script** to apply updates:

    ```bash
    bash scripts/install.sh
    ```

3. **Restart your Claude session** to re-initialize the MCP server.

## 📂 Project Structure

- `orbit-mcp/`: TypeScript source for the MCP server.
- `scripts/`: Implementation logic for installation, detection, and environment management.
- `docker/`: Dockerfiles and compose templates for various runtimes.
- `config/`: Global configuration schemas and default settings.

---

*Focus on the vibe, let Orbit handle the infra.*
