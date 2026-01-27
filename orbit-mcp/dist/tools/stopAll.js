/**
 * orbit_stop_all tool - Stop all Orbit containers
 */
import { z } from 'zod';
import { stopAllOrbitContainers, checkDocker, getRunningContainers } from '../dockerManager.js';
import { getAllProjectStates, updateProjectState } from '../stateDb.js';
export const stopAllSchema = z.object({
    confirm: z.boolean().default(true).describe('Confirm stop all'),
});
export function stopAll(input) {
    if (!input.confirm) {
        return {
            success: false,
            containers_stopped: 0,
            message: 'Operation cancelled - confirm=false',
        };
    }
    const dockerStatus = checkDocker();
    if (!dockerStatus.running) {
        return {
            success: true,
            containers_stopped: 0,
            message: 'Docker not running - nothing to stop',
        };
    }
    // Count containers before stopping
    const containersBefore = getRunningContainers().length;
    // Stop all
    stopAllOrbitContainers();
    // Clear sidecars from all project states
    const projects = getAllProjectStates();
    for (const project of projects) {
        updateProjectState(project.project, project.current_env, []);
    }
    return {
        success: true,
        containers_stopped: containersBefore,
        message: `Stopped ${containersBefore} container(s)`,
    };
}
//# sourceMappingURL=stopAll.js.map