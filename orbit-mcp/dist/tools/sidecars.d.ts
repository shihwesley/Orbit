/**
 * orbit_sidecars tool - Manage sidecar services
 */
import { z } from 'zod';
export declare const sidecarsSchema: z.ZodObject<{
    action: z.ZodEnum<["list", "start", "stop"]>;
    sidecar: z.ZodOptional<z.ZodString>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "list" | "start" | "stop";
    project_path?: string | undefined;
    sidecar?: string | undefined;
}, {
    action: "list" | "start" | "stop";
    project_path?: string | undefined;
    sidecar?: string | undefined;
}>;
export type SidecarsInput = z.infer<typeof sidecarsSchema>;
export declare const AVAILABLE_SIDECARS: {
    name: string;
    description: string;
    port: number;
}[];
export interface SidecarsResult {
    action: string;
    available: typeof AVAILABLE_SIDECARS;
    running: string[];
    message: string;
}
export declare function manageSidecars(input: SidecarsInput): SidecarsResult;
//# sourceMappingURL=sidecars.d.ts.map