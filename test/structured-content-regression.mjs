#!/usr/bin/env node

/**
 * Regression tests for alphafold-mcp-server structuredContent responses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    failedTests++;
  }
}

function assertNotContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (!haystack.includes(needle)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    console.log(`  Should not contain: ${needle}`);
    failedTests++;
  }
}

function assertFileExists(relPath, testName) {
  totalTests++;
  const fullPath = path.join(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    failedTests++;
    return '';
  }
}

// Verify core server files exist
const index = assertFileExists('src/index.ts', 'index.ts exists');
const doFile = assertFileExists('src/do.ts', 'do.ts exists');
const catalog = assertFileExists('src/spec/catalog.ts', 'catalog.ts exists');
const adapter = assertFileExists('src/lib/api-adapter.ts', 'api-adapter.ts exists');
const http = assertFileExists('src/lib/http.ts', 'http.ts exists');
const codeMode = assertFileExists('src/tools/code-mode.ts', 'code-mode.ts exists');
const queryData = assertFileExists('src/tools/query-data.ts', 'query-data.ts exists');
const getSchema = assertFileExists('src/tools/get-schema.ts', 'get-schema.ts exists');

// Verify key patterns in source
if (index) {
  assertContains('src/index.ts', index, 'AlphafoldDataDO', 'index exports AlphafoldDataDO');
  assertContains('src/index.ts', index, 'MyMCP', 'index exports MyMCP');
  assertContains('src/index.ts', index, '/health', 'index has health endpoint');
  assertContains('src/index.ts', index, '/mcp', 'index has mcp endpoint');
  assertContains('src/index.ts', index, '"alphafolddb"', 'index uses alphafolddb server name');
}

if (doFile) {
  assertContains('src/do.ts', doFile, 'RestStagingDO', 'DO extends RestStagingDO');
  assertContains('src/do.ts', doFile, 'Array.isArray(data)', 'DO checks for top-level arrays');
  assertContains('src/do.ts', doFile, '"sequence"', 'DO excludes sequence field');
  assertContains('src/do.ts', doFile, '"uniprotSequence"', 'DO excludes uniprotSequence field');
  assertContains('src/do.ts', doFile, '"allVersions"', 'DO excludes allVersions field');
}

if (catalog) {
  assertContains('src/spec/catalog.ts', catalog, 'ApiCatalog', 'catalog exports ApiCatalog');
  assertContains('src/spec/catalog.ts', catalog, 'pLDDT', 'catalog mentions pLDDT confidence');
  assertContains('src/spec/catalog.ts', catalog, 'UniProt', 'catalog mentions UniProt accession');
  assertContains('src/spec/catalog.ts', catalog, 'paeDocUrl', 'catalog references PAE download URL');
  assertContains('src/spec/catalog.ts', catalog, '/prediction/{qualifier}', 'catalog has prediction endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/uniprot/summary/{qualifier}', 'catalog has uniprot summary endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/complex/{qualifier}', 'catalog has complex endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/annotations/{qualifier}', 'catalog has annotations endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/search', 'catalog has search endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/sequence/summary', 'catalog has sequence summary endpoint');
  assertContains('src/spec/catalog.ts', catalog, 'endpointCount: 8', 'catalog has correct endpoint count');
  assertNotContains('src/spec/catalog.ts', catalog, '/stats', 'catalog does not have dead /stats endpoint');
  assertNotContains('src/spec/catalog.ts', catalog, '?key=pdb', 'catalog does not have bogus ?key=pdb');
}

if (adapter) {
  assertContains('src/lib/api-adapter.ts', adapter, 'json', 'adapter handles JSON content type');
  assertContains('src/lib/api-adapter.ts', adapter, 'text', 'adapter handles text content (PDB/mmCIF)');
}

if (codeMode) {
  assertContains('src/tools/code-mode.ts', codeMode, '"alphafolddb"', 'code-mode uses alphafolddb prefix');
}

if (queryData) {
  assertContains('src/tools/query-data.ts', queryData, 'alphafolddb_query_data', 'registers alphafolddb_query_data');
}

if (getSchema) {
  assertContains('src/tools/get-schema.ts', getSchema, 'alphafolddb_get_schema', 'registers alphafolddb_get_schema');
}

// Summary
console.log(`\n${passedTests}/${totalTests} tests passed`);
if (failedTests > 0) {
  console.log(`${RED}${failedTests} tests FAILED${RESET}`);
  process.exit(1);
}
