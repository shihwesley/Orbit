/**
 * orbit_stop_all tool - Stop all Orbit containers
 */

import { z } from 'zod';
import { stopAllOrbitContainers, checkDocker, getRunningContainers } from '../dockerManager.js';
import { getAllProjectStates, updateProjectState } from '../stateDb.js';

export const stopAllSchema = z.object({
  confirm: z.boolean().default(true).describe('Confirm stop all'),
});

export type StopAllInput = z.infer<typeof stopAllSchema>;

export interface StopAllResult {
  success: boolean;
  containers_stopped: number;
  message: string;
}

export async function stopAll(input: StopAllInput): Promise<StopAllResult> {
  if (!input.confirm) {
    return {
      success: false,
      containers_stopped: 0,
      message: 'Operation cancelled - confirm=false',
    };
  }

  const dockerStatus = await checkDocker();
  if (!dockerStatus.running) {
    return {
      success: true,
      containers_stopped: 0,
      message: 'Docker not running - nothing to stop',
    };
  }

  // Count containers before stopping
  const containersBefore = (await getRunningContainers()).length;

  // Stop all
  await stopAllOrbitContainers();

  // Clear sidecars from all project states
  const projects = getAllProjectStates();
  for (const project of projects) {
    updateProjectState(project.project, project.current_env as 'dev' | 'test' | 'staging' | 'prod', []);
  }

  return {
    success: true,
    containers_stopped: containersBefore,
    message: `Stopped ${containersBefore} container(s)`,
  };
}
