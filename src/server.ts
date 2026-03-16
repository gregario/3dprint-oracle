#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getDatabase } from './data/db.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { registerSearchFilaments } from './tools/search-filaments.js';
import { registerGetFilament } from './tools/get-filament.js';
import { registerListManufacturers } from './tools/list-manufacturers.js';
import { registerListMaterials } from './tools/list-materials.js';
import { registerGetMaterialProfile } from './tools/get-material-profile.js';
import { registerCompareMaterials } from './tools/compare-materials.js';
import { registerRecommendMaterial } from './tools/recommend-material.js';
import { registerDiagnosePrintIssue } from './tools/diagnose-print-issue.js';

export interface ServerOptions {
  dbPath?: string;
  db?: import('better-sqlite3').Database;
}

export function createServer(options?: ServerOptions): McpServer {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  let version = '0.0.0';
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
    );
    version = pkg.version;
  } catch {
    // Fallback version if package.json not found (e.g., in tests)
  }

  const server = new McpServer({
    name: '3dprint-oracle',
    version,
  });

  const db = options?.db ?? getDatabase(options?.dbPath);

  registerSearchFilaments(server, db);
  registerGetFilament(server, db);
  registerListManufacturers(server, db);
  registerListMaterials(server, db);
  registerGetMaterialProfile(server, db);
  registerCompareMaterials(server, db);
  registerRecommendMaterial(server, db);
  registerDiagnosePrintIssue(server, db);

  return server;
}

// Only start stdio when run directly
const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  console.error('3dprint-oracle MCP server starting...');
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
