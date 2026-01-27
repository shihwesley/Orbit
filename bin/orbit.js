#!/usr/bin/env node
/**
 * Orbit CLI - Unified Orchestrator
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { execa } from 'execa';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');

const program = new Command();

program
    .name('orbit')
    .description('Orbit - Ambient development environment management\n\nNote: For daily usage, prefer using "/orbit" slash commands inside Claude Code.')
    .version('1.1.0');

// Helper to run existing shell scripts
async function runScript(scriptName, args = []) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    if (!fs.existsSync(scriptPath)) {
        console.error(chalk.red(`Error: Script not found at ${scriptPath}`));
        process.exit(1);
    }

    try {
        const { stdout } = await execa('bash', [scriptPath, ...args], {
            stdio: 'inherit',
            env: {
                ...process.env,
                ORBIT_PACKAGE_ROOT: ROOT_DIR
            }
        });
    } catch (error) {
        // execa with stdio: inherit will already have printed the error
        process.exit(error.exitCode || 1);
    }
}

// orbit setup
program
    .command('setup')
    .description('Initialize Orbit infrastructure on this system')
    .action(() => runScript('install.sh'));

// orbit init
program
    .command('init')
    .description('Initialize Orbit in the current project')
    .action(() => runScript('orbit-init.sh'));

// orbit status
program
    .command('status')
    .description('Show current environment status')
    .action(() => runScript('orbit-status.sh'));

// orbit switch <env>
program
    .command('switch')
    .description('Switch to target environment (dev|test|staging)')
    .argument('<env>', 'Target environment')
    .action((env) => {
        if (env === 'test') runScript('orbit-test.sh');
        else if (env === 'staging') runScript('orbit-staging.sh');
        else if (env === 'dev') runScript('orbit-init.sh', ['dev']);
        else {
            console.error(chalk.red(`Error: Unknown environment ${env}. Supported: dev, test, staging`));
            process.exit(1);
        }
    });

// orbit sidecars
program
    .command('sidecars')
    .description('Manage sidecar services')
    .argument('<action>', 'list|start|stop')
    .argument('[name]', 'Sidecar name')
    .action((action, name) => {
        const args = [action];
        if (name) args.push(name);
        runScript('orbit-sidecars.sh', args);
    });

program.parse();
