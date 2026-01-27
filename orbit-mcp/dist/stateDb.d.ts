/**
 * SQLite state database operations
 */
import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
export declare function closeDb(): void;
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
    sidecars_running: string;
}
export declare function getProjectState(projectPath: string): ProjectState | null;
export declare function getAllProjectStates(): ProjectState[];
export declare function updateProjectState(projectPath: string, env: Environment, sidecars?: string[]): void;
export declare function getRecentAuditLog(projectPath: string, limit?: number): AuditLogEntry[];
export declare function logAudit(projectPath: string, command: string, env: Environment | null, success: boolean, durationMs?: number, gitCommit?: string, errorMessage?: string): void;
//# sourceMappingURL=stateDb.d.ts.map