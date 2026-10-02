/**
 * Flutter (Dart) code generator — Phase 5.
 *
 * Deterministic, pure function. No AI. Same input → byte-identical output.
 * Follows Auto Layout → Flutter widget mapping (see docs/CODEGEN_MAPPING.md).
 *
 * PURE TYPESCRIPT — no host-specific imports.
 *
 * TODO (Phase 5): Full implementation.
 */

import type { Screen, DesignTokens } from '@tezmind/core';

export interface FlutterCodegenOptions {
  /** Use `gap` (Flutter 3.27+) or `SizedBox` separators for spacing. Default: 'gap'. */
  gapStyle?: 'gap' | 'sizedbox';
  /** Null-safe Dart (always true). */
  nullSafe?: true;
}

export interface CodegenFile {
  path: string;
  content: string;
}

export interface CodegenReport {
  approximated: string[];   // Features approximated (not 1:1)
  unsupported: string[];    // Features dropped with reason
}

export interface CodegenResult {
  files: CodegenFile[];
  report: CodegenReport;
}

/**
 * Generate Flutter Dart code from a project's screens.
 * Returns file contents + a report of any approximations.
 *
 * Phase 5 implementation placeholder.
 */
export function generate(
  _screens: Screen[],
  _tokens: DesignTokens | undefined,
  _options: FlutterCodegenOptions = {},
): CodegenResult {
  // TODO (Phase 5): Full implementation
  return {
    files: [
      {
        path: 'lib/main.dart',
        content: '// Flutter code generation coming in Phase 5\nvoid main() {}',
      },
    ],
    report: {
      approximated: [],
      unsupported: ['Full Flutter code generation not yet implemented (Phase 5)'],
    },
  };
}
