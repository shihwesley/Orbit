/**
 * Docker Sandbox lifecycle management
 *
 * Create, exec, stop, reset, and remove Docker Sandboxes.
 * Sandboxes are named per-project: orbit-<projectName>-<env>
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { detectSandboxCapabilities, type SandboxBackend } from './sandboxDetector.js';

const exec = promisify(execCallback);

const SANDBOX_TIMEOUT = 60_000; // 60s for create/exec operations

export interface SandboxInfo {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
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
 */
export async function listSandboxes(): Promise<SandboxInfo[]> {
  try {
    const { stdout } = await exec('docker sandbox ls --format "{{.Name}}|{{.Status}}"');
    if (!stdout.trim()) return [];
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.startsWith('orbit-'))
      .map(line => {
        const [name, status] = line.split('|');
        return {
          name,
          status: (status?.toLowerCase().includes('running') ? 'running' : 'stopped') as SandboxInfo['status'],
        };
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
): Promise<string> {
  const name = sandboxName(projectName, env);

  // Check if sandbox already exists
  const existing = await listSandboxes();
  if (existing.some(s => s.name === name)) {
    return name; // Already exists, reuse it
  }

  // Create with workspace mount only — security-first default
  await exec(
    `docker sandbox create --mount type=bind,source="${projectPath}",target=/workspace ${name}`,
    { timeout: SANDBOX_TIMEOUT },
  );

  return name;
}

/**
 * Execute a command inside a running sandbox
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
 * Stop a sandbox (preserves state)
 */
export async function stopSandbox(name: string): Promise<void> {
  try {
    await exec(`docker sandbox stop ${name}`, { timeout: SANDBOX_TIMEOUT });
  } catch {
    // Already stopped or doesn't exist — not an error
  }
}

/**
 * Remove a sandbox completely
 */
export async function removeSandbox(name: string): Promise<void> {
  try {
    await exec(`docker sandbox rm -f ${name}`, { timeout: SANDBOX_TIMEOUT });
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
): Promise<string> {
  const name = sandboxName(projectName, env);
  await removeSandbox(name);
  return createSandbox(projectName, projectPath, env);
}

/**
 * Get the recommended backend and create the appropriate isolation.
 * Returns the sandbox/container name for subsequent operations.
 */
export async function ensureIsolation(
  projectName: string,
  projectPath: string,
  env = 'test',
): Promise<{ backend: SandboxBackend; name: string }> {
  const caps = await detectSandboxCapabilities();

  if (caps.recommended === 'sandbox') {
    const name = await createSandbox(projectName, projectPath, env);
    return { backend: 'sandbox', name };
  }

  // Fallback: container — delegated to existing dockerManager (Phase 5 enhances this)
  return { backend: 'container', name: `orbit-${projectName}-${env}` };
}
