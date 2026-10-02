/**
 * Figma → TezDSL converter — Phase 5.
 *
 * Step 1 (deterministic): Maps Figma nodes to TezDSL without AI.
 * Step 2 (optional, Phase 5): AI cleanup for layer naming, component inference.
 *
 * PURE TYPESCRIPT — all HTTP via HttpBridge.
 *
 * TODO (Phase 5): Full implementation.
 */

import type { HttpBridge } from '@tezmind/core';
import type { Screen } from '@tezmind/core';

export interface FigmaImportOptions {
  fileKey: string;
  nodeIds?: string[];   // specific frames to import; if empty, imports top-level frames
  figmaToken: string;   // Figma personal access token
}

export interface FigmaImportResult {
  screens: Screen[];
  unsupportedFeatures: string[];
  warnings: string[];
}

/**
 * Import Figma frames as TezDSL screens.
 * Phase 5 implementation placeholder.
 */
export async function importFromFigma(
  _options: FigmaImportOptions,
  _http: HttpBridge,
  _signal?: AbortSignal,
): Promise<FigmaImportResult> {
  // TODO (Phase 5): Full implementation
  return {
    screens: [],
    unsupportedFeatures: [],
    warnings: ['Figma import not yet implemented (Phase 5)'],
  };
}
