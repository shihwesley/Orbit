/**
 * SQLite state database operations
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const ORBIT_ROOT = join(homedir(), '.orbit');
const DB_PATH = join(ORBIT_ROOT, 'state.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    if (!existsSync(DB_PATH)) {
      throw new Error(`Orbit not installed: ${DB_PATH} not found. Run install.sh first.`);
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Types
export type Environment = 'dev' | 'test' | 'staging' | 'prod';

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  project: string;
  command: string;
  environment: Environment | null;
  duration_ms: number | null;
  git_commit: string | null;
  success: number;
  error_message: string | null;
}

export interface ProjectState {
  project: string;
  current_env: Environment;
  last_activity: string;
  sidecars_running: string; // JSON array
}

// Queries
export function getProjectState(projectPath: string): ProjectState | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM project_state WHERE project = ?');
  return stmt.get(projectPath) as ProjectState | null;
}

export function getAllProjectStates(): ProjectState[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM project_state ORDER BY last_activity DESC');
  return stmt.all() as ProjectState[];
}

export function updateProjectState(
  projectPath: string,
  env: Environment,
  sidecars: string[] = []
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO project_state (project, current_env, last_activity, sidecars_running)
    VALUES (?, ?, datetime('now'), ?)
  `);
  stmt.run(projectPath, env, JSON.stringify(sidecars));
}

export function getRecentAuditLog(projectPath: string, limit = 10): AuditLogEntry[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM audit_log
    WHERE project = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(projectPath, limit) as AuditLogEntry[];
}

export function logAudit(
  projectPath: string,
  command: string,
  env: Environment | null,
  success: boolean,
  durationMs?: number,
  gitCommit?: string,
  errorMessage?: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_log (project, command, environment, duration_ms, git_commit, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    projectPath,
    command,
    env,
    durationMs ?? null,
    gitCommit ?? null,
    success ? 1 : 0,
    errorMessage ?? null
  );
}
