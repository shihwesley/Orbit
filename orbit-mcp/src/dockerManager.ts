/**
 * Docker container management (Asynchronous)
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { COMPOSE_FILE, ORBIT_ROOT } from './config.js';

const exec = promisify(execCallback);

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
}

export async function checkDocker(): Promise<DockerStatus> {
  try {
    const { stdout } = await exec('docker --version');
    const version = stdout.trim();
    try {
      await exec('docker info');
      return { installed: true, running: true, version };
    } catch {
      return { installed: true, running: false, version };
    }
  } catch {
    return { installed: false, running: false, version: null };
  }
}

export async function requireDocker(): Promise<void> {
  const status = await checkDocker();
  if (!status.installed) {
    throw new Error('Docker is not installed. Install Docker Desktop or docker.io');
  }
  if (!status.running) {
    throw new Error('Docker daemon is not running. Start Docker Desktop or run: sudo systemctl start docker');
  }
}

export interface RunningContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  labels: Record<string, string>;
}

export async function getRunningContainers(): Promise<RunningContainer[]> {
  try {
    const { stdout } = await exec(
      'docker ps --filter "label=com.orbit.managed=true" --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.Labels}}"'
    );
    if (!stdout.trim()) return [];
    return stdout
      .trim()
      .split('\n')
      .map(line => {
        const [id, name, image, status, ports, labelStr] = line.split('|');
        const labels: Record<string, string> = {};
        labelStr.split(',').forEach(l => {
          const [k, v] = l.split('=');
          if (k) labels[k] = v;
        });
        return { id, name, image, status, ports, labels };
      });
  } catch {
    return [];
  }
}

export async function startSidecar(sidecar: string): Promise<void> {
  await requireDocker();
  await exec(`docker compose -f "${COMPOSE_FILE}" --profile sidecar-${sidecar} up -d`);
}

export async function stopSidecar(sidecar: string): Promise<void> {
  await requireDocker();
  await exec(`docker compose -f "${COMPOSE_FILE}" --profile sidecar-${sidecar} down`);
}

export async function startSidecars(sidecars: string[]): Promise<void> {
  // Start in parallel for better performance
  await Promise.all(sidecars.map(sidecar => startSidecar(sidecar)));
}

export async function stopAllOrbitContainers(): Promise<void> {
  await requireDocker();
  try {
    await exec(`docker compose -f "${COMPOSE_FILE}" down`);
  } catch {
    // Ignore if nothing to stop
  }
}

export interface TestResult {
  success: boolean;
  duration: number;
  output: string;
}

export async function runTests(
  projectPath: string,
  projectType: string,
  fresh = false
): Promise<TestResult> {
  await requireDocker();

  const envVars = {
    ...process.env,
    PROJECT_PATH: projectPath,
    ORBIT_ROOT,
    PROJECT_TYPE: projectType,
  };

  const buildArgs = fresh ? '--no-cache' : '';
  const startTime = Date.now();

  try {
    // Build
    await exec(
      `docker compose -f "${COMPOSE_FILE}" --profile ${projectType} build ${buildArgs}`,
      { env: envVars }
    );

    // Run tests
    const { stdout } = await exec(
      `docker compose -f "${COMPOSE_FILE}" --profile ${projectType} run --rm test-${projectType}`,
      { env: envVars }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      output: stdout,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}
