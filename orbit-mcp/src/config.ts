import { homedir } from 'os';
import { join } from 'path';

/**
 * Global configuration and paths
 */

export const ORBIT_ROOT = join(homedir(), '.orbit');
export const DB_PATH = join(ORBIT_ROOT, 'state.db');
export const CONFIG_PATH = join(ORBIT_ROOT, 'config.json');
export const REGISTRY_PATH = join(ORBIT_ROOT, 'registry.json');
export const DOCKER_DIR = join(ORBIT_ROOT, 'docker');
export const COMPOSE_FILE = join(DOCKER_DIR, 'docker-compose.yml');

export const DEFAULT_LIMIT = 20;
