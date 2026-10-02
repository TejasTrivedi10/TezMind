/**
 * React Native (TypeScript) code generator — Phase 5.
 *
 * Deterministic, pure function. No AI. Same input → byte-identical output.
 * Follows Auto Layout → React Native mapping (see docs/CODEGEN_MAPPING.md).
 *
 * PURE TYPESCRIPT — no host-specific imports.
 *
 * TODO (Phase 5): Full implementation.
 */

import type { Screen, DesignTokens } from '@tezmind/core';

export interface RNCodegenOptions {
  /** TypeScript strict mode (default: true). */
  strict?: boolean;
}

export interface CodegenFile {
  path: string;
  content: string;
}

export interface CodegenReport {
  approximated: string[];
  unsupported: string[];
}

export interface CodegenResult {
  files: CodegenFile[];
  report: CodegenReport;
}

/**
 * Generate React Native TypeScript code from a project's screens.
 * Returns file contents + a report of any approximations.
 *
 * Phase 5 implementation placeholder.
 */
export function generate(
  _screens: Screen[],
  _tokens: DesignTokens | undefined,
  _options: RNCodegenOptions = {},
): CodegenResult {
  // TODO (Phase 5): Full implementation
  return {
    files: [
      {
        path: 'src/screens/Screen.tsx',
        content: '// React Native code generation coming in Phase 5\nexport default function Screen() { return null; }',
      },
    ],
    report: {
      approximated: [],
      unsupported: ['Full React Native code generation not yet implemented (Phase 5)'],
    },
  };
}
