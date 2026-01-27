import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Shared utility functions
 */

/**
 * Check if a project is initialized with Orbit
 */
export async function isProjectInitialized(projectPath: string): Promise<boolean> {
    const orbitConfigPath = join(projectPath, '.orbit', 'config.json');
    try {
        await fs.access(orbitConfigPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read project configuration
 */
export async function readProjectConfig(projectPath: string): Promise<Record<string, any> | null> {
    const orbitConfigPath = join(projectPath, '.orbit', 'config.json');
    try {
        const content = await fs.readFile(orbitConfigPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * Async delay
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
