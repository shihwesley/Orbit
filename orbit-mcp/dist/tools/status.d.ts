/**
 * orbit_status tool - Show current environment state
 */
import { z } from 'zod';
export declare const statusSchema: z.ZodObject<{
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    project_path?: string | undefined;
}, {
    project_path?: string | undefined;
}>;
export type StatusInput = z.infer<typeof statusSchema>;
export interface StatusResult {
    project: {
        path: string;
        name: string;
        initialized: boolean;
        type: string | null;
        config: Record<string, unknown> | null;
    };
    environment: {
        current: string | null;
        sidecars_running: string[];
    };
    docker: {
        installed: boolean;
        running: boolean;
        version: string | null;
        containers: Array<{
            name: string;
            image: string;
            status: string;
        }>;
    };
    recent_activity: Array<{
        timestamp: string;
        command: string;
        environment: string | null;
        success: boolean;
    }>;
}
export declare function getStatus(input: StatusInput): StatusResult;
//# sourceMappingURL=status.d.ts.map