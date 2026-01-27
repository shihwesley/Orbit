/**
 * Docker container management
 */
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
const ORBIT_ROOT = join(homedir(), '.orbit');
const COMPOSE_FILE = join(ORBIT_ROOT, 'docker', 'docker-compose.yml');
export function checkDocker() {
    try {
        const version = execSync('docker --version', { encoding: 'utf-8' }).trim();
        try {
            execSync('docker info', { stdio: 'ignore' });
            return { installed: true, running: true, version };
        }
        catch {
            return { installed: true, running: false, version };
        }
    }
    catch {
        return { installed: false, running: false, version: null };
    }
}
export function requireDocker() {
    const status = checkDocker();
    if (!status.installed) {
        throw new Error('Docker is not installed. Install Docker Desktop or docker.io');
    }
    if (!status.running) {
        throw new Error('Docker daemon is not running. Start Docker Desktop or run: sudo systemctl start docker');
    }
}
export function getRunningContainers() {
    try {
        const output = execSync('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"', { encoding: 'utf-8' });
        return output
            .trim()
            .split('\n')
            .filter(line => line.includes('orbit'))
            .map(line => {
            const [id, name, image, status, ports] = line.split('|');
            return { id, name, image, status, ports };
        });
    }
    catch {
        return [];
    }
}
export function startSidecar(sidecar) {
    requireDocker();
    execSync(`docker compose -f "${COMPOSE_FILE}" --profile sidecar-${sidecar} up -d`, { stdio: 'inherit' });
}
export function stopSidecar(sidecar) {
    requireDocker();
    execSync(`docker compose -f "${COMPOSE_FILE}" --profile sidecar-${sidecar} down`, { stdio: 'inherit' });
}
export function startSidecars(sidecars) {
    for (const sidecar of sidecars) {
        startSidecar(sidecar);
    }
}
export function stopAllOrbitContainers() {
    requireDocker();
    // Stop all compose services
    try {
        execSync(`docker compose -f "${COMPOSE_FILE}" down`, { stdio: 'inherit' });
    }
    catch {
        // Ignore if nothing to stop
    }
}
export async function runTests(projectPath, projectType, fresh = false) {
    requireDocker();
    const env = {
        ...process.env,
        PROJECT_PATH: projectPath,
        ORBIT_ROOT,
        PROJECT_TYPE: projectType,
    };
    const buildArgs = fresh ? '--no-cache' : '';
    const startTime = Date.now();
    let output = '';
    try {
        // Build
        execSync(`docker compose -f "${COMPOSE_FILE}" --profile ${projectType} build ${buildArgs}`, { env, stdio: 'pipe', encoding: 'utf-8' });
        // Run tests
        output = execSync(`docker compose -f "${COMPOSE_FILE}" --profile ${projectType} run --rm test-${projectType}`, { env, stdio: 'pipe', encoding: 'utf-8' });
        return {
            success: true,
            duration: Date.now() - startTime,
            output,
        };
    }
    catch (error) {
        return {
            success: false,
            duration: Date.now() - startTime,
            output: error instanceof Error ? error.message : String(error),
        };
    }
}
//# sourceMappingURL=dockerManager.js.map