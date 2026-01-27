/**
 * SQLite state database operations
 */
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
const ORBIT_ROOT = join(homedir(), '.orbit');
const DB_PATH = join(ORBIT_ROOT, 'state.db');
let db = null;
export function getDb() {
    if (!db) {
        if (!existsSync(DB_PATH)) {
            throw new Error(`Orbit not installed: ${DB_PATH} not found. Run install.sh first.`);
        }
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
    }
    return db;
}
export function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
// Queries
export function getProjectState(projectPath) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM project_state WHERE project = ?');
    return stmt.get(projectPath);
}
export function getAllProjectStates() {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM project_state ORDER BY last_activity DESC');
    return stmt.all();
}
export function updateProjectState(projectPath, env, sidecars = []) {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO project_state (project, current_env, last_activity, sidecars_running)
    VALUES (?, ?, datetime('now'), ?)
  `);
    stmt.run(projectPath, env, JSON.stringify(sidecars));
}
export function getRecentAuditLog(projectPath, limit = 10) {
    const db = getDb();
    const stmt = db.prepare(`
    SELECT * FROM audit_log
    WHERE project = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
    return stmt.all(projectPath, limit);
}
export function logAudit(projectPath, command, env, success, durationMs, gitCommit, errorMessage) {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO audit_log (project, command, environment, duration_ms, git_commit, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(projectPath, command, env, durationMs ?? null, gitCommit ?? null, success ? 1 : 0, errorMessage ?? null);
}
//# sourceMappingURL=stateDb.js.map