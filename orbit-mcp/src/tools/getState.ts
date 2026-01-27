/**
 * orbit_get_state tool - Query raw state from database
 */

import { z } from 'zod';
import { getDb, getAllProjectStates, getRecentAuditLog } from '../stateDb.js';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const getStateSchema = z.object({
  query_type: z.enum(['projects', 'audit', 'registry', 'config']).describe('What to query'),
  project_path: z.string().optional().describe('Project path for audit query'),
  limit: z.number().optional().default(20).describe('Limit for audit query'),
});

export type GetStateInput = z.infer<typeof getStateSchema>;

export interface GetStateResult {
  query_type: string;
  data: unknown;
}

export function getState(input: GetStateInput): GetStateResult {
  const ORBIT_ROOT = join(homedir(), '.orbit');

  switch (input.query_type) {
    case 'projects': {
      // Get all registered projects
      const states = getAllProjectStates();
      return {
        query_type: 'projects',
        data: states.map(s => ({
          project: s.project,
          current_env: s.current_env,
          last_activity: s.last_activity,
          sidecars_running: JSON.parse(s.sidecars_running || '[]'),
        })),
      };
    }

    case 'audit': {
      // Get audit log for a project
      const projectPath = input.project_path || process.cwd();
      const log = getRecentAuditLog(projectPath, input.limit);
      return {
        query_type: 'audit',
        data: log.map(entry => ({
          timestamp: entry.timestamp,
          command: entry.command,
          environment: entry.environment,
          duration_ms: entry.duration_ms,
          success: entry.success === 1,
          error_message: entry.error_message,
        })),
      };
    }

    case 'registry': {
      // Get global registry
      const registryPath = join(ORBIT_ROOT, 'registry.json');
      if (!existsSync(registryPath)) {
        return { query_type: 'registry', data: { projects: {} } };
      }
      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      return { query_type: 'registry', data: registry };
    }

    case 'config': {
      // Get global config
      const configPath = join(ORBIT_ROOT, 'config.json');
      if (!existsSync(configPath)) {
        return { query_type: 'config', data: null };
      }
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return { query_type: 'config', data: config };
    }

    default:
      throw new Error(`Unknown query type: ${input.query_type}`);
  }
}
