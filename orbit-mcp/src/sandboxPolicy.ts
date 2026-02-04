/**
 * Network isolation & security policies for Docker Sandboxes
 *
 * Reads per-project sandbox config from .orbit/config.json and
 * generates creation flags appropriate to the isolation backend.
 *
 * KEY DESIGN: Sandbox (microVM) and container backends have fundamentally
 * different security models:
 * - Sandbox: hypervisor IS the boundary. Only network policy applies.
 *   Docker daemon inside is already isolated. No cap_drop/read-only needed.
 * - Container: shared kernel. Needs layered hardening (cap_drop, read-only,
 *   no-new-privileges, seccomp) to approximate sandbox-level isolation.
 */

import { z } from 'zod';
import type { SandboxBackend } from './sandboxDetector.js';

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
 *     "containerHardening": {
 *       "readOnlyRoot": true,
 *       "dropCapabilities": true,
 *       "noNewPrivileges": true
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
  /** Container-only hardening — ignored when running in a microVM sandbox */
  containerHardening: z.object({
    readOnlyRoot: z.boolean().default(true),
    dropCapabilities: z.boolean().default(true),
    noNewPrivileges: z.boolean().default(true),
  }).default({
    readOnlyRoot: true,
    dropCapabilities: true,
    noNewPrivileges: true,
  }),
});

export type SandboxPolicy = z.infer<typeof sandboxPolicySchema>;

/** Security-first defaults — deny-all network, max container hardening */
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
 * Generate network-related flags (shared between sandbox and container modes).
 *
 * NOTE: Flag names are based on Docker Sandbox documentation (experimental).
 * Actual CLI may differ — these should be verified against `docker sandbox --help`
 * once the feature is available on the target Docker Desktop version.
 */
function networkFlags(policy: SandboxPolicy): string[] {
  const flags: string[] = [];

  switch (policy.network.mode) {
    case 'deny-all':
      // UNVERIFIED: actual flag may differ for sandbox vs container
      flags.push('--network=none');
      break;
    case 'allow':
      // UNVERIFIED: Docker Sandbox docs mention allow/deny lists but
      // exact flag syntax not confirmed without `docker sandbox --help`
      for (const domain of policy.network.allow) {
        flags.push(`--network-allow=${domain}`);
      }
      break;
    case 'open':
      for (const domain of policy.network.deny) {
        flags.push(`--network-deny=${domain}`);
      }
      break;
  }

  return flags;
}

/**
 * Convert a SandboxPolicy into CLI flags for `docker sandbox create`.
 *
 * For microVM sandboxes: only network flags. The hypervisor provides
 * isolation — no cap_drop, read-only, or Docker daemon flags needed.
 *
 * For containers: network flags + all hardening flags. Shared kernel
 * means we need defense-in-depth.
 */
export function policyToFlags(policy: SandboxPolicy, backend: SandboxBackend): string[] {
  const flags = networkFlags(policy);

  // Container-only hardening — microVM sandboxes don't need these
  if (backend === 'container') {
    const h = policy.containerHardening;
    if (h.readOnlyRoot) flags.push('--read-only');
    if (h.dropCapabilities) flags.push('--cap-drop=ALL');
    if (h.noNewPrivileges) flags.push('--security-opt=no-new-privileges:true');
  }

  return flags;
}

/**
 * Describe the policy in human-readable form for status output
 */
export function describeSandboxPolicy(policy: SandboxPolicy, backend: SandboxBackend): string {
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

  if (backend === 'sandbox') {
    parts.push('Isolation: microVM (hypervisor)');
  } else {
    const h = policy.containerHardening;
    const hardening = [
      h.readOnlyRoot && 'read-only root',
      h.dropCapabilities && 'caps dropped',
      h.noNewPrivileges && 'no-new-privileges',
    ].filter(Boolean);
    if (hardening.length) {
      parts.push(`Security: ${hardening.join(', ')}`);
    }
  }

  return parts.join(' | ');
}
