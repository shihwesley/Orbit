/**
 * Network isolation & security policies for Docker Sandboxes
 *
 * Reads per-project sandbox config from .orbit/config.json and
 * generates sandbox creation flags for network/security enforcement.
 */

import { z } from 'zod';

/**
 * Sandbox policy schema — extends .orbit/config.json with a "sandbox" key
 *
 * Example in .orbit/config.json:
 * {
 *   "type": "node",
 *   "sandbox": {
 *     "network": {
 *       "mode": "allow",
 *       "allow": ["registry.npmjs.org", "github.com"],
 *       "deny": []
 *     },
 *     "security": {
 *       "readOnlyRoot": true,
 *       "noHostDocker": true,
 *       "dropCapabilities": true
 *     }
 *   }
 * }
 */
export const sandboxPolicySchema = z.object({
  network: z.object({
    /** "deny-all" blocks everything, "allow" uses allowlist, "open" permits all */
    mode: z.enum(['deny-all', 'allow', 'open']).default('deny-all'),
    /** Domains/IPs explicitly allowed when mode is "allow" */
    allow: z.array(z.string()).default([]),
    /** Domains/IPs explicitly blocked (applies in "open" mode) */
    deny: z.array(z.string()).default([]),
  }).default({
    mode: 'deny-all',
    allow: [],
    deny: [],
  }),
  security: z.object({
    /** Mount root filesystem as read-only (workspace still writable) */
    readOnlyRoot: z.boolean().default(true),
    /** Prevent access to host Docker daemon */
    noHostDocker: z.boolean().default(true),
    /** Drop all Linux capabilities except minimal set */
    dropCapabilities: z.boolean().default(true),
  }).default({
    readOnlyRoot: true,
    noHostDocker: true,
    dropCapabilities: true,
  }),
});

export type SandboxPolicy = z.infer<typeof sandboxPolicySchema>;

/** Security-first defaults — deny-all network, max hardening */
export const DEFAULT_POLICY: SandboxPolicy = sandboxPolicySchema.parse({});

/**
 * Parse sandbox policy from a project's .orbit/config.json
 * Falls back to secure defaults if no sandbox key exists.
 */
export function parseSandboxPolicy(projectConfig: Record<string, unknown>): SandboxPolicy {
  const raw = projectConfig.sandbox;
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_POLICY;
  }
  return sandboxPolicySchema.parse(raw);
}

/**
 * Convert a SandboxPolicy into CLI flags for `docker sandbox create`
 */
export function policyToFlags(policy: SandboxPolicy): string[] {
  const flags: string[] = [];

  // Network isolation
  switch (policy.network.mode) {
    case 'deny-all':
      flags.push('--network=none');
      break;
    case 'allow':
      // Docker sandboxes support --network-allow for allowlisted domains
      for (const domain of policy.network.allow) {
        flags.push(`--network-allow=${domain}`);
      }
      break;
    case 'open':
      // Open network, but apply deny list
      for (const domain of policy.network.deny) {
        flags.push(`--network-deny=${domain}`);
      }
      break;
  }

  // Security hardening
  if (policy.security.readOnlyRoot) {
    flags.push('--read-only');
  }
  if (policy.security.noHostDocker) {
    flags.push('--no-docker');
  }
  if (policy.security.dropCapabilities) {
    flags.push('--cap-drop=ALL');
  }

  return flags;
}

/**
 * Describe the policy in human-readable form for status output
 */
export function describeSandboxPolicy(policy: SandboxPolicy): string {
  const parts: string[] = [];

  switch (policy.network.mode) {
    case 'deny-all':
      parts.push('Network: deny-all (no outbound)');
      break;
    case 'allow':
      parts.push(`Network: allowlist (${policy.network.allow.length} domains)`);
      break;
    case 'open':
      parts.push(`Network: open${policy.network.deny.length ? ` (${policy.network.deny.length} blocked)` : ''}`);
      break;
  }

  const sec = policy.security;
  const hardening = [
    sec.readOnlyRoot && 'read-only root',
    sec.noHostDocker && 'no host Docker',
    sec.dropCapabilities && 'caps dropped',
  ].filter(Boolean);

  if (hardening.length) {
    parts.push(`Security: ${hardening.join(', ')}`);
  }

  return parts.join(' | ');
}
