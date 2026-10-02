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
  DevicePreset,
  ScreenMeta,
  ScreenRecord,
  ComponentRecord,
  AssetRecord,
  HistoryEntry,
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

// Layout linter
export { lintTree, hasErrors } from './lint';
export type { LintIssue, LintSeverity } from './lint';

// Migrations
export { migrateUp, migrations } from './migrations';
export type { Migration, Migratable } from './migrations';

// ID generation
export { nanoid } from './id';

// HTML Subset & Converter
export { ALLOWED_TAGS, ALLOWED_ATTRIBUTES, ALLOWED_STYLE_PROPERTIES, getDslNodeType } from './html/subset';
export { RESET_STYLESHEET, generateTokenCssVariables } from './html/resetCss';
export { htmlToDsl, dslToHtml, parseInlineStyle } from './html/converter';
export type { HtmlToDslResult } from './html/converter';

