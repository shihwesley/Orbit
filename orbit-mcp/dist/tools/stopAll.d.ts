/**
 * orbit_stop_all tool - Stop all Orbit containers
 */
import { z } from 'zod';
export declare const stopAllSchema: z.ZodObject<{
    confirm: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    confirm: boolean;
}, {
    confirm?: boolean | undefined;
}>;
export type StopAllInput = z.infer<typeof stopAllSchema>;
export interface StopAllResult {
    success: boolean;
    containers_stopped: number;
    message: string;
}
export declare function stopAll(input: StopAllInput): StopAllResult;
//# sourceMappingURL=stopAll.d.ts.map