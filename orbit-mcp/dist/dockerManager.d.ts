/**
 * Docker container management
 */
export interface DockerStatus {
    installed: boolean;
    running: boolean;
    version: string | null;
}
export declare function checkDocker(): DockerStatus;
export declare function requireDocker(): void;
export interface RunningContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
}
export declare function getRunningContainers(): RunningContainer[];
export declare function startSidecar(sidecar: string): void;
export declare function stopSidecar(sidecar: string): void;
export declare function startSidecars(sidecars: string[]): void;
export declare function stopAllOrbitContainers(): void;
export interface TestResult {
    success: boolean;
    duration: number;
    output: string;
}
export declare function runTests(projectPath: string, projectType: string, fresh?: boolean): Promise<TestResult>;
//# sourceMappingURL=dockerManager.d.ts.map