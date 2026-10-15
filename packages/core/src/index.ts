/**
 * @tezmind/core — Public API
 *
 * Everything exported from this file is available to consumers of the core package.
 * Keep this list intentional — do not re-export internal implementation details.
 */

// Host bridge contracts
export type {
  HostBridge,
  HttpBridge,
  HttpRequest,
  HttpResponse,
  SecretsBridge,
  ProjectStore,
  ProjectMeta,
  PaletteOption,
  UiKitStyleContext,
  DevicePreset,
  ScreenMeta,
  ScreenRecord,
  ComponentRecord,
  AssetRecord,
  HistoryEntry,
  ScreenActionRecord,
  FilesBridge,
  ImageData,
  UIBridge,
  ClockBridge,
} from './host';

// DSL types and schemas
export {
  // Schemas
  ColorSchema,
  SizeModeSchema,
  ConstraintsSchema,
  SizingSchema,
  MainAxisSchema,
  CrossAxisSchema,
  PaddingSchema,
  LayoutSchema,
  AnchorSchema,
  BreakpointSchema,
  BreakpointOverrideSchema,
  ShadowSchema,
  StyleSpecSchema,
  NodeTypeSchema,
  PressActionSchema,
  TextPropsSchema,
  ButtonPropsSchema,
  InputPropsSchema,
  ImagePropsSchema,
  IconPropsSchema,
  DividerPropsSchema,
  ListPropsSchema,
  SwitchPropsSchema,
  CheckboxPropsSchema,
  AvatarPropsSchema,
  BadgePropsSchema,
  ChipPropsSchema,
  FramePropsSchema,
  DesignNodeSchema,
  DesignTokensSchema,
  ScreenSchema,
  ProjectSchema,
  // Constants
  CURRENT_SCHEMA_VERSION,
  DSL_LIMITS,
} from './dsl';

export type {
  Color,
  SizeMode,
  Constraints,
  Sizing,
  MainAxis,
  CrossAxis,
  Padding,
  Layout,
  Anchor,
  Breakpoint,
  BreakpointOverride,
  Shadow,
  StyleSpec,
  NodeType,
  PressAction,
  DesignNode,
  DesignNodeBase,
  DesignTokens,
  Screen,
  Project,
} from './dsl';

// Tree utilities
export {
  findNode,
  findParent,
  getNodePath,
  countNodes,
  getMaxDepth,
  collectIds,
  normalizeIds,
  replaceNode,
  updateNode,
  deleteNode,
  insertNode,
  moveNode,
  isDescendant,
} from './tree';

// Patch applier
export { applyPatch } from './patch';
export type { Patch, PatchOp, PatchResult, PatchSuccess, PatchFailure } from './patch';

// Layout linter (DSL tree)
export { lintTree, hasErrors } from './lint';
export type { LintIssue, LintSeverity } from './lint';

// Migrations
export { migrateUp, migrations } from './migrations';
export type { Migration, Migratable } from './migrations';

// ID generation
export { nanoid } from './id';

// HTML Subset & Converter
export { ALLOWED_TAGS, ALLOWED_ATTRIBUTES, ALLOWED_STYLE_PROPERTIES, getDslNodeType } from './html/subset';
export { RESET_STYLESHEET, AUTO_LAYOUT_STYLESHEET, generateTokenCssVariables } from './html/resetCss';
export { htmlToDsl, dslToHtml, parseInlineStyle } from './html/converter';
export type { HtmlToDslResult } from './html/converter';

// HTML Hydrator (browser-only; safe to import anywhere, no-ops in non-browser)
export { hydrate, initials, avatarColors, placeholderGradient, placeholderGlyph, DEFAULT_PALETTE } from './html/hydrate';
export type { Palette, HydrateOptions } from './html/hydrate';

// HTML Deterministic Autofix
export { autofix } from './html/autofix';
export type { FixCtx } from './html/autofix';

// HTML Roles & Archetypes
export { ROLES, ROLE_REGION, ROLE_DESC } from './html/roles';
export type { Role, Region } from './html/roles';
export { ARCHETYPES, EXPLICIT, analyze } from './html/archetypes';
export type { OutlineItem, Archetype, Analysis } from './html/archetypes';

// HTML Templates & DOM tools
export { COMPOSER_HTML, SEARCH_HTML, BOTTOM_NAV_HTML } from './html/templates';
export { openTagDepth, stripFences, joinContinuation } from './html/completeness';
export { parseScreen } from './html/parse';

// HTML Linter v2
export { lint, lintBounds } from './html/lint';
export type { Violation } from './html/lint';
export { lintHtml, buildRepairPrompt } from './html/htmlLint';
export type { HtmlLintViolation, LintSeverity as HtmlLintSeverity } from './html/htmlLint';

// RefinedBrief & ExpandedBrief (prompt expander output)
export { RefinedBriefSchema, RefinerOutputSchema, parseRefinedBrief } from './brief';
export type { RefinedBrief, RefinerOutput, ExpandInput, ExpandedBrief } from './brief';

// Icon System
export { ICON_NAMES, ICON_NAMES_SET, resolveIconName, iconSvg } from './icons';
export type { IconName } from './icons';

// Design System (dynamic design pipeline)
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
  ProjectSchema as DesignSystemProjectSchema,
  FONT_ALLOWLIST,
  SPACING_SCALE,
  TYPE_SCALE_PX,
  validateDesignSystem,
  contrastRatio,
  compileTokens,
  hashString,
  compileUtilities,
  scanClasses,
  buildBaseChunk,
  buildTokensChunk,
  buildUtilitiesChunk,
  buildComponentChunk,
  buildScreenChunk,
  buildChunks,
  chunksToStyleTag,
  hasRawLiterals,
  BASE_CHUNK_HASH,
} from './designSystem';

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
  ComponentRecord as DesignComponentRecord,
  ComponentProp,
  ScreenSummary,
  ProjectContext,
  ParsedHints,
  Project as DesignSystemProject,
  Composition,
  CompositionSection,
  CompositionContainer,
  IconPlanItem,
  ChunkKind,
  CssChunk,
  LintContext,
  ValidationResult as DesignSystemValidationResult,
  ValidationSuccess as DesignSystemValidationSuccess,
  ValidationFailure as DesignSystemValidationFailure,
  BuildChunksInput,
} from './designSystem';

