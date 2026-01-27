/**
 * orbit_switch_env tool - Switch to a different environment
 */

import { z } from 'zod';
import { updateProjectState, logAudit, getProjectState, type Environment } from '../stateDb.js';
import { startSidecars, stopAllOrbitContainers, requireDocker } from '../dockerManager.js';
import { readProjectConfig } from '../utils.js';

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

  const sidecars: string[] = config.sidecars || [];

  // Get previous state
  let previousEnv: string | null = null;
  try {
    const state = getProjectState(projectPath);
    previousEnv = state?.current_env || null;
  } catch {
    // Ignore
  }

  // Handle environment switch asynchronously
  let sidecarsStarted: string[] = [];

  if (targetEnv === 'dev') {
    // Dev is local, stop any running containers
    try {
      await stopAllOrbitContainers();
    } catch {
      // Ignore if Docker not available
    }
  } else if (targetEnv === 'test' || targetEnv === 'staging') {
    // Test and staging need Docker
    await requireDocker();

    // Start sidecars if configured
    if (sidecars.length > 0) {
      await startSidecars(sidecars);
      sidecarsStarted = sidecars;
    }
  }

  // Update state
  updateProjectState(projectPath, targetEnv, sidecarsStarted);

  // Log to audit
  logAudit(projectPath, `switch_env:${targetEnv}`, targetEnv, true);

  return {
    success: true,
    previous_env: previousEnv,
    current_env: targetEnv,
    sidecars_started: sidecarsStarted,
    message: `Switched to ${targetEnv} environment`,
  };
}
