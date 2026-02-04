/**
 * orbit_status tool - Show current environment state
 */

import { z } from 'zod';
import { getProjectState, getRecentAuditLog } from '../stateDb.js';
import { checkDocker, getRunningContainers } from '../dockerManager.js';
import { readProjectConfig } from '../utils.js';
import { detectSandboxCapabilities, type SandboxCapabilities } from '../sandboxDetector.js';

export const statusSchema = z.object({
  project_path: z.string().optional().describe('Project path (defaults to current working directory)'),
});

export type StatusInput = z.infer<typeof statusSchema>;

export interface StatusResult {
  project: {
    path: string;
    name: string;
    initialized: boolean;
    type: string | null;
    config: Record<string, unknown> | null;
  };
  environment: {
    current: string | null;
    sidecars_running: string[];
  };
  docker: {
    installed: boolean;
    running: boolean;
    version: string | null;
    containers: Array<{
      name: string;
      image: string;
      status: string;
    }>;
  };
  sandbox: SandboxCapabilities;
  recent_activity: Array<{
    timestamp: string;
    command: string;
    environment: string | null;
    success: boolean;
  }>;
}

export async function getStatus(input: StatusInput): Promise<StatusResult> {
  const projectPath = input.project_path || process.cwd();
  const projectName = projectPath.split('/').pop() || 'unknown';

  // Read project config asynchronously
  const config = await readProjectConfig(projectPath);
  const initialized = !!config;
  const projectType = (config?.type as string) || null;

  // Get state from database
  const state = getProjectState(projectPath);
  const auditLog = getRecentAuditLog(projectPath, 5);

  // Get Docker status and sandbox capabilities in parallel
  const [dockerStatus, sandboxCaps] = await Promise.all([
    checkDocker(),
    detectSandboxCapabilities(),
  ]);
  const containers = dockerStatus.running ? await getRunningContainers() : [];

  // Parse sidecars
  let sidecarsRunning: string[] = [];
  if (state?.sidecars_running) {
    try {
      sidecarsRunning = JSON.parse(state.sidecars_running);
    } catch {
      // Ignore
    }
  }

  return {
    project: {
      path: projectPath,
      name: projectName,
      initialized,
      type: projectType,
      config,
    },
    environment: {
      current: state?.current_env || null,
      sidecars_running: sidecarsRunning,
    },
    docker: {
      installed: dockerStatus.installed,
      running: dockerStatus.running,
      version: dockerStatus.version,
      containers: containers.map(c => ({
        name: c.name,
        image: c.image,
        status: c.status,
      })),
    },
    sandbox: sandboxCaps,
    recent_activity: auditLog.map(entry => ({
      timestamp: entry.timestamp,
      command: entry.command,
      environment: entry.environment,
      success: entry.success === 1,
    })),
  };
}
