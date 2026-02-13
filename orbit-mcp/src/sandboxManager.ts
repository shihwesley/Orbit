/**
 * Docker Sandbox lifecycle management
 *
 * Create, exec, stop, reset, and remove Docker Sandboxes.
 * Sandboxes are named per-project: orbit-<projectName>-<env>
 */

import { exec as execCallback } from 'child_process';
import { unlink } from 'fs/promises';
import { promisify } from 'util';
import { detectSandboxCapabilities, type SandboxBackend } from './sandboxDetector.js';
import { type SandboxPolicy, policyToFlags } from './sandboxPolicy.js';
import { writeSecurityOverride, DEFAULT_FALLBACK_SECURITY, type FallbackSecurityOptions } from './containerFallback.js';
import { COMPOSE_FILE } from './config.js';

const exec = promisify(execCallback);

const SANDBOX_TIMEOUT = 60_000; // 60s for create/exec operations

export interface SandboxInfo {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
}

export interface SandboxCreateOptions {
  /** Additional CLI flags (e.g. network policy flags from sandboxPolicy) */
  extraFlags?: string[];
}

/**
 * Generate a deterministic sandbox name for a project + environment
 */
export function sandboxName(projectName: string, env = 'test'): string {
  // Sanitize: lowercase, replace non-alphanumeric with dashes
  const safe = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  return `orbit-${safe}-${env}`;
}

/**
 * List all Orbit-managed sandboxes
 * UNVERIFIED: `docker sandbox ls` format assumed from `docker ps` Go template syntax.
 */
export async function listSandboxes(): Promise<SandboxInfo[]> {
  try {
    const { stdout } = await exec('docker sandbox ls --format "{{.Name}}|{{.Status}}"');
    if (!stdout.trim()) return [];
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.startsWith('orbit-'))
      .map((line): SandboxInfo => {
        const [name, rawStatus] = line.split('|');
        const status = rawStatus?.toLowerCase().includes('running') ? 'running' : 'stopped';
        return { name, status };
      });
  } catch {
    return [];
  }
}

/**
 * Create a new sandbox for a project.
 * Mounts only the project workspace (security: no home directory access).
 */
export async function createSandbox(
  projectName: string,
  projectPath: string,
  env = 'test',
  opts: SandboxCreateOptions = {},
): Promise<string> {
  const name = sandboxName(projectName, env);

  // Check if sandbox already exists
  const existing = await listSandboxes();
  if (existing.some(s => s.name === name)) {
    return name; // Already exists, reuse it
  }

  // Build flags
  // NOTE: Docker Sandboxes provide an isolated Docker daemon natively —
  // no explicit --enable-docker flag needed. The microVM's Docker daemon
  // is separate from the host by design.
  // UNVERIFIED: --mount syntax assumed from docker run; actual sandbox CLI
  // may use different syntax (e.g. --workspace). Verify with `docker sandbox --help`.
  const flags = [
    `--mount type=bind,source="${projectPath}",target=/workspace`,
  ];

  if (opts.extraFlags?.length) {
    flags.push(...opts.extraFlags);
  }

  await exec(
    `docker sandbox create ${flags.join(' ')} ${name}`,
    { timeout: SANDBOX_TIMEOUT },
  );

  return name;
}

/**
 * Execute a command inside a running sandbox.
 * UNVERIFIED: `-w` flag assumed from `docker exec`; sandbox exec may differ.
 */
export async function execInSandbox(
  name: string,
  command: string,
  opts: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  const timeout = opts.timeout ?? SANDBOX_TIMEOUT;
  const cwdFlag = opts.cwd ? `-w ${opts.cwd}` : '-w /workspace';
  const { stdout, stderr } = await exec(
    `docker sandbox exec ${cwdFlag} ${name} ${command}`,
    { timeout },
  );
  return { stdout, stderr };
}

/**
 * Stop a sandbox (preserves state).
 * UNVERIFIED: `docker sandbox stop` assumed from `docker stop`.
 * Article emphasizes "delete and spin up fresh" — stop/start lifecycle
 * may not be a primary pattern for sandboxes.
 */
export async function stopSandbox(name: string): Promise<void> {
  try {
    await exec(`docker sandbox stop ${name}`, { timeout: SANDBOX_TIMEOUT });
  } catch {
    // Already stopped or doesn't exist — not an error
  }
}

/**
 * Remove a sandbox completely.
 * UNVERIFIED: `-f` flag assumed from `docker rm -f`; may not exist for sandboxes.
 * Confirmed command from article: `docker sandbox rm`
 */
export async function removeSandbox(name: string): Promise<void> {
  try {
    await exec(`docker sandbox rm ${name}`, { timeout: SANDBOX_TIMEOUT });
  } catch {
    // Already removed — not an error
  }
}

/**
 * Reset a sandbox — destroy and recreate from scratch.
 * This is the "instant reset" capability: fast teardown + recreate.
 */
export async function resetSandbox(
  projectName: string,
  projectPath: string,
  env = 'test',
  opts: SandboxCreateOptions = {},
): Promise<string> {
  const name = sandboxName(projectName, env);
  await removeSandbox(name);
  return createSandbox(projectName, projectPath, env, opts);
}

/**
 * Verify that the isolated Docker daemon is running inside a sandbox.
 * Returns true if the agent can use docker build/run inside the sandbox.
 */
export async function verifyDinD(name: string): Promise<boolean> {
  try {
    const { stdout } = await execInSandbox(name, 'docker info --format "{{.ServerVersion}}"', {
      timeout: 15_000,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect the recommended backend without creating anything.
 * Useful for callers that need to know the backend before building flags.
 */
export async function detectBackend(): Promise<SandboxBackend> {
  const caps = await detectSandboxCapabilities();
  return caps.recommended;
}

/**
 * Get the recommended backend and create the appropriate isolation.
 *
 * For sandbox: creates a microVM with network policy flags only.
 * Docker daemon inside is already isolated by the hypervisor.
 *
 * For container: starts a hardened compose service with security overlay
 * (read-only rootfs, cap_drop, no-new-privileges, resource limits).
 */
export async function ensureIsolation(
  projectName: string,
  projectPath: string,
  projectType: string,
  env = 'test',
  policy?: SandboxPolicy,
): Promise<{ backend: SandboxBackend; name: string }> {
  const backend = await detectBackend();

  const flags = policy ? policyToFlags(policy, backend) : [];

  if (backend === 'sandbox') {
    // MicroVM: only network flags apply. Hypervisor handles security.
    const name = await createSandbox(projectName, projectPath, env, { extraFlags: flags });
    return { backend: 'sandbox', name };
  }

  // Container fallback: use a compose security override for real enforcement
  const name = sandboxName(projectName, env);
  const securityOpts: FallbackSecurityOptions = policy
    ? {
        readOnlyRoot: policy.containerHardening.readOnlyRoot,
        dropCaps: policy.containerHardening.dropCapabilities,
        noNewPrivileges: policy.containerHardening.noNewPrivileges,
        memoryLimitMb: DEFAULT_FALLBACK_SECURITY.memoryLimitMb,
        cpuLimit: DEFAULT_FALLBACK_SECURITY.cpuLimit,
        networkMode: policy.network.mode === 'deny-all' ? 'none' : undefined,
      }
    : DEFAULT_FALLBACK_SECURITY;

  const overridePath = await writeSecurityOverride(projectType, securityOpts);

  try {
    await exec(
      `docker compose -f "${COMPOSE_FILE}" -f "${overridePath}" --profile ${projectType} up -d`,
      {
        env: { ...process.env, PROJECT_PATH: projectPath, PROJECT_TYPE: projectType },
        timeout: SANDBOX_TIMEOUT,
      },
    );
  } catch {
    // Container may already be running
  } finally {
    try { await unlink(overridePath); } catch { /* cleanup best-effort */ }
  }

  return { backend: 'container', name };
}
