/**
 * orbit_switch_env tool - Switch to a different environment
 */

import { z } from 'zod';
import { updateProjectState, logAudit, getProjectState, type Environment } from '../stateDb.js';
import { startSidecars, stopAllOrbitContainers, requireDocker } from '../dockerManager.js';
import { readProjectConfig } from '../utils.js';
import { ensureIsolation, removeSandbox, sandboxName } from '../sandboxManager.js';
import { parseSandboxPolicy, describeSandboxPolicy } from '../sandboxPolicy.js';
import type { SandboxBackend } from '../sandboxDetector.js';

export const switchEnvSchema = z.object({
  project_path: z.string().optional().describe('Project path (defaults to cwd)'),
  environment: z.enum(['dev', 'test', 'staging']).describe('Target environment'),
});

export type SwitchEnvInput = z.infer<typeof switchEnvSchema>;

export interface SwitchEnvResult {
  success: boolean;
  previous_env: string | null;
  current_env: string;
  sidecars_started: string[];
  isolation?: {
    backend: SandboxBackend;
    name: string;
    policy: string;
  };
  message: string;
}

export async function switchEnv(input: SwitchEnvInput): Promise<SwitchEnvResult> {
  const projectPath = input.project_path || process.cwd();
  const targetEnv = input.environment as Environment;

  // Read project config asynchronously
  const config = await readProjectConfig(projectPath);
  if (!config) {
    throw new Error(`Project not initialized at ${projectPath}. Run /orbit init first.`);
  }

  const sidecars: string[] = (config.sidecars as string[]) || [];
  const previousEnv = getProjectState(projectPath)?.current_env || null;
  const projectName = projectPath.split('/').pop() || 'unknown';

  // Handle environment switch
  let sidecarsStarted: string[] = [];
  let isolation: SwitchEnvResult['isolation'];

  if (targetEnv === 'dev') {
    // Dev is local — tear down any sandbox or container
    try {
      await removeSandbox(sandboxName(projectName, 'test'));
      await stopAllOrbitContainers();
    } catch {
      // Ignore if Docker not available
    }
  } else if (targetEnv === 'test') {
    // Test env: use sandbox (microVM) when available, hardened containers as fallback
    await requireDocker();

    const policy = parseSandboxPolicy(config);
    const projectType = (config.type as string) || 'node';

    // ensureIsolation picks the backend and applies appropriate flags:
    // - sandbox: network policy only (hypervisor handles security + Docker isolation)
    // - container: network policy + cap_drop, read-only, no-new-privileges
    const result = await ensureIsolation(projectName, projectPath, projectType, 'test', policy);
    isolation = {
      backend: result.backend,
      name: result.name,
      policy: describeSandboxPolicy(policy, result.backend),
    };

    // Start sidecars if configured
    if (sidecars.length > 0) {
      await startSidecars(sidecars);
      sidecarsStarted = sidecars;
    }
  } else if (targetEnv === 'staging') {
    // Staging: always containers (must mirror prod — no microVM)
    await requireDocker();

    if (sidecars.length > 0) {
      await startSidecars(sidecars);
      sidecarsStarted = sidecars;
    }
  }

  // Update state
  updateProjectState(projectPath, targetEnv, sidecarsStarted);

  // Log to audit
  logAudit(projectPath, `switch_env:${targetEnv}`, targetEnv, true);

  const message = isolation
    ? `Switched to ${targetEnv} (${isolation.backend}: ${isolation.name})`
    : `Switched to ${targetEnv} environment`;

  return {
    success: true,
    previous_env: previousEnv,
    current_env: targetEnv,
    sidecars_started: sidecarsStarted,
    isolation,
    message,
  };
}
