/**
 * @tezmind/core/designSystem — Public API
 */

// Schema + types
export {
  DesignSystemSchema,
  DesignSystemColorsSchema,
  DesignSystemTypographySchema,
  DesignSystemSpacingSchema,
  DesignSystemRadiusSchema,
  DesignSystemElevationSchema,
  DesignSystemIconsSchema,
  DesignSystemMotionSchema,
  ComponentRecordSchema,
  ComponentPropSchema,
  ScreenSummarySchema,
  ProjectContextSchema,
  CompositionSchema,
  CompositionSectionSchema,
  CompositionContainerSchema,
  IconPlanItemSchema,
  ParsedHintsSchema,
  ProjectSchema,
  FONT_ALLOWLIST,
  SPACING_SCALE,
  TYPE_SCALE_PX,
} from './schema';

export type {
  DesignSystem,
  DesignSystemColors,
  DesignSystemTypography,
  DesignSystemSpacing,
  DesignSystemRadius,
  DesignSystemElevation,
  DesignSystemIcons,
  DesignSystemMotion,
  FontFamily,
  SpacingValue,
  TypeScaleValue,
  ComponentRecord,
  ComponentProp,
  ScreenSummary,
  ProjectContext,
  ParsedHints,
  Project,
  Composition,
  CompositionSection,
  CompositionContainer,
  IconPlanItem,
  ChunkKind,
  CssChunk,
  LintContext,
} from './schema';

// Validator
export { validateDesignSystem, contrastRatio } from './validate';
export type { ValidationResult, ValidationSuccess, ValidationFailure } from './validate';

// Token compiler
export { compileTokens, hashString } from './compileTokens';

// Utility compiler
export { compileUtilities, scanClasses } from './compileUtilities';

// CSS chunks
export {
  buildBaseChunk,
  buildTokensChunk,
  buildUtilitiesChunk,
  buildComponentChunk,
  buildScreenChunk,
  buildChunks,
  chunksToStyleTag,
  hasRawLiterals,
  BASE_CHUNK_HASH,
} from './chunks';
export type { BuildChunksInput } from './chunks';
