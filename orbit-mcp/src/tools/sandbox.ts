/**
 * orbit_sandbox tool — Direct sandbox management
 */

import { z } from 'zod';
import { detectSandboxCapabilities, checkSandboxHealth } from '../sandboxDetector.js';
import { listSandboxes, createSandbox, removeSandbox, resetSandbox, sandboxName } from '../sandboxManager.js';
import { parseSandboxPolicy, policyToFlags, describeSandboxPolicy } from '../sandboxPolicy.js';
import { readProjectConfig } from '../utils.js';

export const sandboxSchema = z.object({
  action: z.enum(['status', 'create', 'reset', 'remove', 'health']).describe('Sandbox action'),
  project_path: z.string().optional().describe('Project path (defaults to cwd)'),
});

export type SandboxInput = z.infer<typeof sandboxSchema>;

export async function manageSandbox(input: SandboxInput) {
  const projectPath = input.project_path || process.cwd();
  const projectName = projectPath.split('/').pop() || 'unknown';

  switch (input.action) {
    case 'status': {
      const [caps, sandboxes] = await Promise.all([
        detectSandboxCapabilities(),
        listSandboxes(),
      ]);
      return { capabilities: caps, sandboxes };
    }

    case 'create': {
      const config = await readProjectConfig(projectPath);
      const policy = parseSandboxPolicy(config || {});
      // Direct sandbox creation: only network flags (hypervisor handles security)
      const flags = policyToFlags(policy, 'sandbox');
      const name = await createSandbox(projectName, projectPath, 'test', { extraFlags: flags });
      return {
        name,
        policy: describeSandboxPolicy(policy, 'sandbox'),
        message: `Sandbox ${name} created`,
      };
    }

    case 'reset': {
      const config = await readProjectConfig(projectPath);
      const policy = parseSandboxPolicy(config || {});
      const flags = policyToFlags(policy, 'sandbox');
      const name = await resetSandbox(projectName, projectPath, 'test', { extraFlags: flags });
      return { name, message: `Sandbox ${name} reset (destroyed + recreated)` };
    }

    case 'remove': {
      const name = sandboxName(projectName, 'test');
      await removeSandbox(name);
      return { name, message: `Sandbox ${name} removed` };
    }

    case 'health': {
      const [caps, health] = await Promise.all([
        detectSandboxCapabilities(),
        checkSandboxHealth(),
      ]);
      return { capabilities: caps, health };
    }
  }
}
