/**
 * Docker Sandbox detection & capability checking
 *
 * Detects whether the host supports Docker Sandboxes (microVM isolation)
 * and reports capabilities for the orchestration layer.
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const exec = promisify(execCallback);

export type SandboxBackend = 'sandbox' | 'container' | 'none';

export interface SandboxCapabilities {
  /** docker sandbox CLI available */
  hasSandbox: boolean;
  /** Docker Desktop version string */
  dockerDesktopVersion: string | null;
  /** Host platform (darwin, win32, linux) */
  platform: string;
  /** Which backend to use for test env isolation */
  recommended: SandboxBackend;
  /** Human-readable reason for recommendation */
  reason: string;
}

/**
 * Check if `docker sandbox` subcommand is available
 */
async function hasSandboxCLI(): Promise<boolean> {
  try {
    await exec('docker sandbox --help');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Docker Desktop version (distinct from Docker Engine version)
 */
async function getDockerDesktopVersion(): Promise<string | null> {
  try {
    const { stdout } = await exec('docker version --format "{{.Server.Platform.Name}}"');
    const name = stdout.trim();
    // Docker Desktop reports "Docker Desktop X.Y.Z"
    if (name.toLowerCase().includes('desktop')) {
      return name;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect sandbox capabilities and recommend backend
 */
export async function detectSandboxCapabilities(): Promise<SandboxCapabilities> {
  const hostPlatform = platform();
  const [sandboxAvailable, desktopVersion] = await Promise.all([
    hasSandboxCLI(),
    getDockerDesktopVersion(),
  ]);

  // Determine recommendation
  let recommended: SandboxBackend;
  let reason: string;

  if (sandboxAvailable) {
    recommended = 'sandbox';
    reason = 'Docker Sandbox CLI detected — microVM isolation available';
  } else if (hostPlatform === 'linux') {
    recommended = 'container';
    reason = 'Linux host — Docker Sandboxes not supported, using enhanced containers';
  } else if (!desktopVersion) {
    recommended = 'container';
    reason = 'Docker Desktop not detected — sandboxes require Docker Desktop';
  } else {
    recommended = 'container';
    reason = 'Docker Desktop found but sandbox CLI unavailable — update Docker Desktop or enable experimental features';
  }

  return {
    hasSandbox: sandboxAvailable,
    dockerDesktopVersion: desktopVersion,
    platform: hostPlatform,
    recommended,
    reason,
  };
}

export interface SandboxHealthResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

const HEALTH_CHECK_TIMEOUT = 30_000; // 30s — microVM boot is slower than containers

/**
 * Verify sandbox runtime actually works by creating a throwaway sandbox,
 * running a command inside it, and tearing it down.
 *
 * Uses a unique name to avoid collisions if multiple checks run concurrently.
 * Cleanup runs in finally so broken sandboxes don't linger.
 */
export async function checkSandboxHealth(): Promise<SandboxHealthResult> {
  const name = `orbit-healthcheck-${Date.now()}`;
  const start = Date.now();

  try {
    await exec(`docker sandbox create ${name}`, { timeout: HEALTH_CHECK_TIMEOUT });
    const { stdout } = await exec(`docker sandbox exec ${name} echo ok`, { timeout: HEALTH_CHECK_TIMEOUT });

    if (stdout.trim() !== 'ok') {
      return { healthy: false, latencyMs: Date.now() - start, error: `Unexpected output: ${stdout.trim()}` };
    }

    return { healthy: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { healthy: false, latencyMs: Date.now() - start, error: message };
  } finally {
    // Always clean up — swallow errors since the sandbox may not have been created
    try { await exec(`docker sandbox rm ${name}`); } catch { /* noop */ }
  }
}
