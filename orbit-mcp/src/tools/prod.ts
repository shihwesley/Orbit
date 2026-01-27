/**
 * orbit_prod tool - Deploy to production (Vercel/Railway)
 */

import { z } from 'zod';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logAudit } from '../stateDb.js';
import { readProjectConfig } from '../utils.js';

const exec = promisify(execCallback);

export const prodSchema = z.object({
    project_path: z.string().optional().describe('Project path (defaults to cwd)'),
    confirm: z.boolean().default(false).describe('Confirm production deployment'),
});

export type ProdInput = z.infer<typeof prodSchema>;

export interface ProdResult {
    success: boolean;
    provider: string | null;
    method: string | null;
    message: string;
    output?: string;
}

const SUPPORTED_PROVIDERS = ['vercel', 'railway'] as const;
type Provider = typeof SUPPORTED_PROVIDERS[number];

async function checkCliInstalled(command: string): Promise<boolean> {
    try {
        await exec(`which ${command}`);
        return true;
    } catch {
        return false;
    }
}

async function deployWithCli(provider: Provider, projectPath: string): Promise<{ success: boolean; output: string }> {
    const commands: Record<Provider, string> = {
        vercel: 'vercel deploy --prod',
        railway: 'railway up --detach',
    };

    try {
        const { stdout, stderr } = await exec(commands[provider], { cwd: projectPath });
        return { success: true, output: stdout || stderr };
    } catch (error) {
        return { success: false, output: error instanceof Error ? error.message : String(error) };
    }
}

async function checkWorkflowExists(provider: Provider, projectPath: string): Promise<boolean> {
    const workflowPath = join(projectPath, '.github', 'workflows', `${provider}-deploy.yml`);
    try {
        await fs.access(workflowPath);
        return true;
    } catch {
        return false;
    }
}

export async function deployProd(input: ProdInput): Promise<ProdResult> {
    const projectPath = input.project_path || process.cwd();

    // Check confirmation
    if (!input.confirm) {
        return {
            success: false,
            provider: null,
            method: null,
            message: 'Production deployment requires confirmation. Set confirm=true to proceed.',
        };
    }

    // Read project config
    const config = await readProjectConfig(projectPath);
    if (!config) {
        throw new Error(`Project not initialized at ${projectPath}. Run /orbit init first.`);
    }

    const prodConfig = config.prod as { provider?: string; method?: string; project?: string } | undefined;
    if (!prodConfig || !prodConfig.provider) {
        throw new Error(
            'No prod.provider configured in .orbit/config.json. Add:\n' +
            '  "prod": { "provider": "vercel", "method": "cli" }'
        );
    }

    const provider = prodConfig.provider as Provider;
    const method = prodConfig.method || 'cli';

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
        throw new Error(`Unsupported provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`);
    }

    const startTime = Date.now();
    let result: ProdResult;

    if (method === 'cli') {
        // Check if CLI is installed
        const cliCommand = provider === 'vercel' ? 'vercel' : 'railway';
        const isInstalled = await checkCliInstalled(cliCommand);

        if (!isInstalled) {
            const installCmd = provider === 'vercel' ? 'npm i -g vercel' : 'npm i -g @railway/cli';
            result = {
                success: false,
                provider,
                method,
                message: `${cliCommand} CLI not installed. Run: ${installCmd}`,
            };
        } else {
            const deployResult = await deployWithCli(provider, projectPath);
            result = {
                success: deployResult.success,
                provider,
                method,
                message: deployResult.success ? `Deployed to ${provider}` : `Deployment failed`,
                output: deployResult.output,
            };
        }
    } else if (method === 'github-actions') {
        const workflowExists = await checkWorkflowExists(provider, projectPath);

        if (!workflowExists) {
            result = {
                success: false,
                provider,
                method,
                message: `Workflow not found: .github/workflows/${provider}-deploy.yml. Copy from ~/.orbit/templates/`,
            };
        } else {
            result = {
                success: true,
                provider,
                method,
                message: `Push to main branch to trigger ${provider} deployment via GitHub Actions.`,
            };
        }
    } else {
        throw new Error(`Unknown method: ${method}. Supported: cli, github-actions`);
    }

    // Log to audit
    const duration = Date.now() - startTime;
    logAudit(projectPath, `deploy:${provider}`, 'prod', result.success, duration, undefined, result.success ? undefined : result.message);

    return result;
}
