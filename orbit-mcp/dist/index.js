#!/usr/bin/env node
/**
 * Orbit MCP Server
 * Ambient environment management for Claude Code
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { statusSchema, getStatus } from './tools/status.js';
import { switchEnvSchema, switchEnv } from './tools/switchEnv.js';
import { getStateSchema, getState } from './tools/getState.js';
import { sidecarsSchema, manageSidecars, AVAILABLE_SIDECARS } from './tools/sidecars.js';
import { stopAllSchema, stopAll } from './tools/stopAll.js';
import { closeDb } from './stateDb.js';
// Create MCP server
const server = new Server({
    name: 'orbit-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Tool definitions
const TOOLS = [
    {
        name: 'orbit_status',
        description: 'Get current environment status for a project. Shows project config, current environment, running sidecars, Docker status, and recent activity.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: {
                    type: 'string',
                    description: 'Project path (defaults to current working directory)',
                },
            },
        },
    },
    {
        name: 'orbit_switch_env',
        description: 'Switch to a different environment (dev/test/staging). Manages Docker containers and sidecars automatically.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: {
                    type: 'string',
                    description: 'Project path (defaults to cwd)',
                },
                environment: {
                    type: 'string',
                    enum: ['dev', 'test', 'staging'],
                    description: 'Target environment',
                },
            },
            required: ['environment'],
        },
    },
    {
        name: 'orbit_get_state',
        description: 'Query raw state from Orbit database. Can retrieve: all projects, audit log, registry, or global config.',
        inputSchema: {
            type: 'object',
            properties: {
                query_type: {
                    type: 'string',
                    enum: ['projects', 'audit', 'registry', 'config'],
                    description: 'What to query',
                },
                project_path: {
                    type: 'string',
                    description: 'Project path (for audit query)',
                },
                limit: {
                    type: 'number',
                    description: 'Limit for audit query (default 20)',
                },
            },
            required: ['query_type'],
        },
    },
    {
        name: 'orbit_sidecars',
        description: `Manage sidecar services (databases, caches, etc.). Available sidecars: ${AVAILABLE_SIDECARS.map(s => s.name).join(', ')}`,
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'start', 'stop'],
                    description: 'Action to perform',
                },
                sidecar: {
                    type: 'string',
                    description: 'Sidecar name (for start/stop)',
                },
                project_path: {
                    type: 'string',
                    description: 'Project path',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'orbit_stop_all',
        description: 'Stop all Orbit Docker containers and clear sidecar state.',
        inputSchema: {
            type: 'object',
            properties: {
                confirm: {
                    type: 'boolean',
                    description: 'Confirm stop all (default true)',
                },
            },
        },
    },
];
// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case 'orbit_status':
                result = getStatus(statusSchema.parse(args || {}));
                break;
            case 'orbit_switch_env':
                result = switchEnv(switchEnvSchema.parse(args));
                break;
            case 'orbit_get_state':
                result = getState(getStateSchema.parse(args));
                break;
            case 'orbit_sidecars':
                result = manageSidecars(sidecarsSchema.parse(args));
                break;
            case 'orbit_stop_all':
                result = stopAll(stopAllSchema.parse(args || {}));
                break;
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ error: message }),
                },
            ],
            isError: true,
        };
    }
});
// Cleanup on exit
process.on('SIGINT', () => {
    closeDb();
    process.exit(0);
});
process.on('SIGTERM', () => {
    closeDb();
    process.exit(0);
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Orbit MCP server started');
}
main().catch((error) => {
    console.error('Failed to start Orbit MCP server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map