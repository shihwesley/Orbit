/**
 * orbit_get_state tool - Query raw state from database
 */
import { z } from 'zod';
export declare const getStateSchema: z.ZodObject<{
    query_type: z.ZodEnum<["projects", "audit", "registry", "config"]>;
    project_path: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    query_type: "projects" | "audit" | "registry" | "config";
    limit: number;
    project_path?: string | undefined;
}, {
    query_type: "projects" | "audit" | "registry" | "config";
    project_path?: string | undefined;
    limit?: number | undefined;
}>;
export type GetStateInput = z.infer<typeof getStateSchema>;
export interface GetStateResult {
    query_type: string;
    data: unknown;
}
export declare function getState(input: GetStateInput): GetStateResult;
//# sourceMappingURL=getState.d.ts.map