# Code Simplification Log

## Session: 2026-02-13

### Summary
- Files analyzed: 8 (all TypeScript sources in orbit-mcp/src/)
- Files modified: 5
- Lines saved: ~25

### Changes Made

#### 1. orbit-mcp/src/index.ts - Arrow function and response formatting
**Lines changed:** 186-205 -> 185-189, 209-212 -> 193-196
**Savings:** ~10 lines

**Before:**
```ts
const cleanup = () => {
  closeDb();
  process.exit(0);
};
// ...
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(result, null, 2),
    },
  ],
};
```

**After:**
```ts
function cleanup() {
  closeDb();
  process.exit(0);
}
// ...
return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
```

#### 2. orbit-mcp/src/tools/switchEnv.ts - Removed unnecessary try/catch
**Lines changed:** 43-58 -> 43-45
**Savings:** ~8 lines

**Before:**
```ts
const sidecars: string[] = config.sidecars || [];
let previousEnv: string | null = null;
try {
  const state = getProjectState(projectPath);
  previousEnv = state?.current_env || null;
} catch {
  // Ignore
}
let sidecarsStarted: string[] = [];
let isolation: SwitchEnvResult['isolation'];
const projectName = projectPath.split('/').pop() || 'unknown';
```

**After:**
```ts
const sidecars: string[] = (config.sidecars as string[]) || [];
const previousEnv = getProjectState(projectPath)?.current_env || null;
const projectName = projectPath.split('/').pop() || 'unknown';
let sidecarsStarted: string[] = [];
let isolation: SwitchEnvResult['isolation'];
```

The try/catch was guarding `getProjectState` which returns `null` on missing state. If the DB itself is broken, `updateProjectState` (called later in the same function) would throw anyway, so the catch was misleading.

#### 3. orbit-mcp/src/tools/status.ts - Extracted sidecar parser, removed noise comments
**Lines changed:** 57-76 -> 48-71
**Savings:** ~5 lines

**Before:**
```ts
// Read project config asynchronously
const config = await readProjectConfig(projectPath);
// ...
// Parse sidecars
let sidecarsRunning: string[] = [];
if (state?.sidecars_running) {
  try {
    sidecarsRunning = JSON.parse(state.sidecars_running);
  } catch {
    // Ignore
  }
}
```

**After:**
```ts
function parseSidecars(raw: string | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
// ...
const config = await readProjectConfig(projectPath);
// ...
const sidecarsRunning: string[] = parseSidecars(state?.sidecars_running);
```

Extracted into a named function for clarity. Removed comments that restated obvious code (`"Read project config asynchronously"`, `"Get state from database"`).

#### 4. orbit-mcp/src/sandboxManager.ts - Consolidated policy flags, cleaned listSandboxes
**Lines changed:** 49-53, 201-238 -> 49-53, 201-226
**Savings:** ~5 lines

**Before:**
```ts
// in listSandboxes:
status: (status?.toLowerCase().includes('running') ? 'running' : 'stopped') as SandboxInfo['status'],

// in ensureIsolation:
if (backend === 'sandbox') {
  const networkOnlyFlags = policy ? policyToFlags(policy, 'sandbox') : [];
  // ...
}
// Container fallback
const hardeningFlags = policy ? policyToFlags(policy, 'container') : [];
const envVars = { ...process.env, PROJECT_PATH: projectPath, PROJECT_TYPE: projectType };
const securityArgs = hardeningFlags.length
  ? hardeningFlags.map(f => ...).join(' ')
  : '';
```

**After:**
```ts
// in listSandboxes:
.map((line): SandboxInfo => {
  const [name, rawStatus] = line.split('|');
  const status = rawStatus?.toLowerCase().includes('running') ? 'running' : 'stopped';
  return { name, status };
});

// in ensureIsolation:
const flags = policy ? policyToFlags(policy, backend) : [];  // single call, backend-aware
if (backend === 'sandbox') {
  const name = await createSandbox(..., { extraFlags: flags });
  // ...
}
const securityArgs = flags.map(f => ...).join(' ');
```

Moved `policyToFlags` call above the branch since the function already handles backend differences. Inlined env vars. Used proper return type annotation on `.map()` instead of a cast.

#### 5. orbit-mcp/src/containerFallback.ts - Consolidated YAML generation, modernized imports
**Lines changed:** 10-12, 43-83 -> 10-12, 42-78
**Savings:** ~5 lines

**Before:**
```ts
import { promises as fs } from 'fs';
import { join } from 'path';
// ...
const securityOpts: string[] = [];
if (opts.noNewPrivileges) securityOpts.push('      - no-new-privileges:true');
const lines = [...];
// ... later:
if (securityOpts.length) {
  lines.push('    security_opt:');
  lines.push(...securityOpts);
}
```

**After:**
```ts
import { unlink, writeFile } from 'fs/promises';
// (removed unused `join` import)
// ...
if (opts.noNewPrivileges) {
  lines.push('    security_opt:', '      - no-new-privileges:true');
}
```

Removed pre-built `securityOpts` array that split related logic. Used multi-arg `lines.push()` for grouped YAML sections. Switched to named imports from `fs/promises` and removed unused `join` import.

### Not Changed
- **sandboxDetector.ts**: Clean structure, no simplification opportunities found
- **sandboxPolicy.ts**: Well-organized with clear separation of schema, parsing, and flag generation
- **sandbox.ts (tool)**: Already concise at 67 lines with a clean switch statement

### Notes
- The `ensureIsolation` container fallback maps hardening flags to Docker labels rather than applying them directly. This is likely a bug (labels are metadata, not enforcement), but fixing it would change behavior and is out of scope for simplification.
- TypeScript compilation verified clean after all changes (`tsc --noEmit` passed).
