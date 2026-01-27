/**
 * orbit_get_state tool - Query raw state from database
 */

import { z } from 'zod';
import { getAllProjectStates, getRecentAuditLog } from '../stateDb.js';
import { promises as fs } from 'fs';
import { REGISTRY_PATH, CONFIG_PATH, DEFAULT_LIMIT } from '../config.js';

export const getStateSchema = z.object({
  query_type: z.enum(['projects', 'audit', 'registry', 'config']).describe('What to query'),
  project_path: z.string().optional().describe('Project path for audit query'),
  limit: z.number().optional().default(DEFAULT_LIMIT).describe('Limit for audit query'),
});

export type GetStateInput = z.infer<typeof getStateSchema>;

export interface GetStateResult {
  query_type: string;
  data: unknown;
}

export async function getState(input: GetStateInput): Promise<GetStateResult> {
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
      try {
        const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
        return { query_type: 'registry', data: JSON.parse(content) };
      } catch {
        return { query_type: 'registry', data: { projects: {} } };
      }
    }

    case 'config': {
      // Get global config
      try {
        const content = await fs.readFile(CONFIG_PATH, 'utf-8');
        return { query_type: 'config', data: JSON.parse(content) };
      } catch {
        return { query_type: 'config', data: null };
      }
    }

    default:
      throw new Error(`Unknown query type: ${input.query_type}`);
  }
}
