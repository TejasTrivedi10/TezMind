#!/usr/bin/env node
/**
 * TezMind CLI — tezmind export
 *
 * Usage:
 *   tezmind export --project ./my-app.tezmind --target flutter --out ./lib
 *   tezmind export --project ./my-app.tezmind --target rn --out ./src
 *
 * Phase 5 implementation placeholder.
 * The CLI proves that packages/core and codegen-* are host-agnostic.
 *
 * PURE TYPESCRIPT — no React, RN, Expo, or DOM imports.
 */

import { generate as generateFlutter } from '@tezmind/codegen-flutter';
import { generate as generateRN } from '@tezmind/codegen-rn';

const args = process.argv.slice(2);

function printHelp() {
  console.warn(`
TezMind CLI v0.1.0

Commands:
  export --project <path> --target <flutter|rn> --out <dir>
  
Options:
  --project   Path to .tezmind project directory or JSON file
  --target    Output target: 'flutter' or 'rn'
  --out       Output directory
  --help      Show this help

Example:
  tezmind export --project ./my-app.tezmind --target flutter --out ./lib
`);
}

async function main() {
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  if (command === 'export') {
    const projectIdx = args.indexOf('--project');
    const targetIdx = args.indexOf('--target');
    const outIdx = args.indexOf('--out');

    if (projectIdx === -1 || targetIdx === -1 || outIdx === -1) {
      console.error('Error: --project, --target, and --out are required for export.');
      printHelp();
      process.exit(1);
    }

    const projectPath = args[projectIdx + 1];
    const target = args[targetIdx + 1];
    const outDir = args[outIdx + 1];

    console.warn(`[TezMind CLI] Exporting ${projectPath} to ${target}...`);
    console.warn(`[TezMind CLI] Output: ${outDir}`);
    console.warn('[TezMind CLI] Full implementation coming in Phase 5.');

    // Stub: demonstrate codegen packages are accessible
    if (target === 'flutter') {
      const result = generateFlutter([], undefined);
      console.warn('[TezMind CLI] Flutter codegen report:', result.report);
    } else if (target === 'rn') {
      const result = generateRN([], undefined);
      console.warn('[TezMind CLI] RN codegen report:', result.report);
    } else {
      console.error(`Unknown target: ${target}. Use 'flutter' or 'rn'.`);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[TezMind CLI] Fatal error:', err.message);
  process.exit(1);
});
