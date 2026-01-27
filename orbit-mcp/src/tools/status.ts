/**
 * orbit_status tool - Show current environment state
 */

import { z } from 'zod';
import { getProjectState, getRecentAuditLog, getAllProjectStates } from '../stateDb.js';
import { checkDocker, getRunningContainers } from '../dockerManager.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const statusSchema = z.object({
  project_path: z.string().optional().describe('Project path (defaults to cwd)'),
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
  recent_activity: Array<{
    timestamp: string;
    command: string;
    environment: string | null;
    success: boolean;
  }>;
}

export function getStatus(input: StatusInput): StatusResult {
  const projectPath = input.project_path || process.cwd();
  const projectName = projectPath.split('/').pop() || 'unknown';
  const orbitConfigPath = join(projectPath, '.orbit', 'config.json');

  // Check if project is initialized
  const initialized = existsSync(orbitConfigPath);
  let config: Record<string, unknown> | null = null;
  let projectType: string | null = null;

  if (initialized) {
    try {
      config = JSON.parse(readFileSync(orbitConfigPath, 'utf-8'));
      projectType = (config?.type as string) || null;
    } catch {
      // Ignore parse errors
    }
  }

  // Get state from database
  const state = getProjectState(projectPath);
  const auditLog = getRecentAuditLog(projectPath, 5);

  // Get Docker status
  const dockerStatus = checkDocker();
  const containers = dockerStatus.running ? getRunningContainers() : [];

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
    recent_activity: auditLog.map(entry => ({
      timestamp: entry.timestamp,
      command: entry.command,
      environment: entry.environment,
      success: entry.success === 1,
    })),
  };
}
