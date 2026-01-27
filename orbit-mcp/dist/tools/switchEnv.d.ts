/**
 * orbit_switch_env tool - Switch to a different environment
 */
import { z } from 'zod';
export declare const switchEnvSchema: z.ZodObject<{
    project_path: z.ZodOptional<z.ZodString>;
    environment: z.ZodEnum<["dev", "test", "staging"]>;
}, "strip", z.ZodTypeAny, {
    environment: "dev" | "test" | "staging";
    project_path?: string | undefined;
}, {
    environment: "dev" | "test" | "staging";
    project_path?: string | undefined;
}>;
export type SwitchEnvInput = z.infer<typeof switchEnvSchema>;
export interface SwitchEnvResult {
    success: boolean;
    previous_env: string | null;
    current_env: string;
    sidecars_started: string[];
    message: string;
}
export declare function switchEnv(input: SwitchEnvInput): SwitchEnvResult;
//# sourceMappingURL=switchEnv.d.ts.map