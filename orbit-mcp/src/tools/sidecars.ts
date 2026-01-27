/**
 * orbit_sidecars tool - Manage sidecar services
 */

import { z } from 'zod';
import { startSidecar, stopSidecar, requireDocker, getRunningContainers } from '../dockerManager.js';
import { getProjectState, updateProjectState } from '../stateDb.js';

export const sidecarsSchema = z.object({
  action: z.enum(['list', 'start', 'stop']).describe('Action to perform'),
  sidecar: z.string().optional().describe('Sidecar name (for start/stop)'),
  project_path: z.string().optional().describe('Project path'),
});

export type SidecarsInput = z.infer<typeof sidecarsSchema>;

export const AVAILABLE_SIDECARS = [
  { name: 'postgres', description: 'PostgreSQL 15', port: 5432 },
  { name: 'redis', description: 'Redis 7', port: 6379 },
  { name: 'mysql', description: 'MySQL 8', port: 3306 },
  { name: 'mongodb', description: 'MongoDB 7', port: 27017 },
  { name: 'rabbitmq', description: 'RabbitMQ 3 (+ management UI on 15672)', port: 5672 },
  { name: 'aws', description: 'LocalStack (S3, SQS, SNS, DynamoDB, Lambda)', port: 4566 },
];

export interface SidecarsResult {
  action: string;
  available: typeof AVAILABLE_SIDECARS;
  running: string[];
  message: string;
}

export function manageSidecars(input: SidecarsInput): SidecarsResult {
  const projectPath = input.project_path || process.cwd();

  // Get currently running sidecars
  const containers = getRunningContainers();
  const runningSidecars = containers
    .filter(c => c.name.includes('sidecar'))
    .map(c => {
      const match = c.name.match(/sidecar-(\w+)/);
      return match ? match[1] : c.name;
    });

  switch (input.action) {
    case 'list':
      return {
        action: 'list',
        available: AVAILABLE_SIDECARS,
        running: runningSidecars,
        message: `${runningSidecars.length} sidecar(s) running`,
      };

    case 'start': {
      if (!input.sidecar) {
        throw new Error('Sidecar name required for start action');
      }
      const valid = AVAILABLE_SIDECARS.find(s => s.name === input.sidecar);
      if (!valid) {
        throw new Error(`Unknown sidecar: ${input.sidecar}. Available: ${AVAILABLE_SIDECARS.map(s => s.name).join(', ')}`);
      }
      requireDocker();
      startSidecar(input.sidecar);

      // Update state
      const state = getProjectState(projectPath);
      const currentSidecars = state?.sidecars_running ? JSON.parse(state.sidecars_running) : [];
      if (!currentSidecars.includes(input.sidecar)) {
        currentSidecars.push(input.sidecar);
      }
      updateProjectState(projectPath, state?.current_env || 'dev', currentSidecars);

      return {
        action: 'start',
        available: AVAILABLE_SIDECARS,
        running: [...runningSidecars, input.sidecar],
        message: `Started ${input.sidecar}`,
      };
    }

    case 'stop': {
      if (!input.sidecar) {
        throw new Error('Sidecar name required for stop action');
      }
      requireDocker();
      stopSidecar(input.sidecar);

      // Update state
      const state = getProjectState(projectPath);
      const currentSidecars = state?.sidecars_running ? JSON.parse(state.sidecars_running) : [];
      const updatedSidecars = currentSidecars.filter((s: string) => s !== input.sidecar);
      updateProjectState(projectPath, state?.current_env || 'dev', updatedSidecars);

      return {
        action: 'stop',
        available: AVAILABLE_SIDECARS,
        running: runningSidecars.filter(s => s !== input.sidecar),
        message: `Stopped ${input.sidecar}`,
      };
    }

    default:
      throw new Error(`Unknown action: ${input.action}`);
  }
}
