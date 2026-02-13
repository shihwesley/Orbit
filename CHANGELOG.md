# Changelog

## [1.2.0] - 2026-01-28

### Added
- Docker Sandbox (microVM) integration for safe agent isolation
- Sandbox policy system (deny-all, allow, open)
- Container fallback when Docker Sandbox is unavailable
- Sandbox detector for runtime capability detection

### Changed
- Security model clarified: sandboxes for agent isolation, containers for environment management
- MCP server wired with sandbox modules

## [1.1.0] - 2026-01-27

### Added
- MCP server with 6 tools (status, switch_env, get_state, sidecars, stop_all)
- SessionStart and Stop hooks for ambient environment awareness
- Sidecar management (PostgreSQL, Redis, MySQL, MongoDB, RabbitMQ, LocalStack)
- Version parity checking
- Workspace/monorepo detection (npm, pnpm, cargo, go)
- CI/CD templates (GitHub Actions, Vercel, Railway)

## [1.0.0] - 2026-01-27

### Added
- Initial release
- Project detection and initialization (Node.js, Python, Go, Rust)
- Docker-based test and staging environments
- SQLite state database with audit logging
- CLI entry point (`orbit`)
- 11 shell scripts for environment operations
- 4 Dockerfiles (node, python, go, rust) + docker-compose
