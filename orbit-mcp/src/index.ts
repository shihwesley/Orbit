#!/usr/bin/env node
/**
 * Orbit MCP Server
 * Ambient environment management for Claude Code
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { statusSchema, getStatus } from './tools/status.js';
import { switchEnvSchema, switchEnv } from './tools/switchEnv.js';
import { getStateSchema, getState } from './tools/getState.js';
import { sidecarsSchema, manageSidecars, AVAILABLE_SIDECARS } from './tools/sidecars.js';
import { stopAllSchema, stopAll } from './tools/stopAll.js';
import { sandboxSchema, manageSandbox } from './tools/sandbox.js';
import { closeDb } from './stateDb.js';

// Tool Registry Type
type ToolHandler = {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
};

// Registered tools
const TOOL_REGISTRY: ToolHandler[] = [
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
    handler: async (args) => getStatus(statusSchema.parse(args || {})),
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
    handler: async (args) => switchEnv(switchEnvSchema.parse(args)),
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
    handler: async (args) => getState(getStateSchema.parse(args)),
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
    handler: async (args) => manageSidecars(sidecarsSchema.parse(args)),
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
    handler: async (args) => stopAll(stopAllSchema.parse(args || {})),
  },
  {
    name: 'orbit_sandbox',
    description: 'Manage Docker Sandbox (microVM) isolation. Actions: status (check capabilities + list sandboxes), create (new sandbox for project), reset (destroy + recreate), remove (delete sandbox), health (verify sandbox runtime works).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'create', 'reset', 'remove', 'health'],
          description: 'Sandbox action',
        },
        project_path: {
          type: 'string',
          description: 'Project path (defaults to cwd)',
        },
      },
      required: ['action'],
    },
    handler: async (args) => manageSandbox(sandboxSchema.parse(args)),
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'orbit-mcp',
    version: '1.1.0', // Increased version for refactor
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_REGISTRY.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = TOOL_REGISTRY.find((t) => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
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
const cleanup = () => {
  closeDb();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

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
