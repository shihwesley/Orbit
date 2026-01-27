/**
 * orbit_status tool - Show current environment state
 */
import { z } from 'zod';
import { getProjectState, getRecentAuditLog } from '../stateDb.js';
import { checkDocker, getRunningContainers } from '../dockerManager.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export const statusSchema = z.object({
    project_path: z.string().optional().describe('Project path (defaults to cwd)'),
});
export function getStatus(input) {
    const projectPath = input.project_path || process.cwd();
    const projectName = projectPath.split('/').pop() || 'unknown';
    const orbitConfigPath = join(projectPath, '.orbit', 'config.json');
    // Check if project is initialized
    const initialized = existsSync(orbitConfigPath);
    let config = null;
    let projectType = null;
    if (initialized) {
        try {
            config = JSON.parse(readFileSync(orbitConfigPath, 'utf-8'));
            projectType = config?.type || null;
        }
        catch {
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
    let sidecarsRunning = [];
    if (state?.sidecars_running) {
        try {
            sidecarsRunning = JSON.parse(state.sidecars_running);
        }
        catch {
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
//# sourceMappingURL=status.js.map