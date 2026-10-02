/**
 * TezDSL — Auto Layout Design Tree
 *
 * This is the canonical design representation used by:
 * - The AI (generates JSON matching this schema)
 * - The renderer (maps nodes to React Native views)
 * - The code generators (Flutter, React Native code output)
 * - The editor (layers, inspector, drag-and-drop)
 *
 * Key principle: Auto Layout first. No raw x/y positioning except inside
 * an explicit `overlay` node. Sizing uses modes (fixed/hug/fill/percent)
 * rather than raw pixel numbers for width/height.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { z } from 'zod';

// ─── COLOR ───────────────────────────────────────────────────────────────────

/** Hex color (#RGB, #RRGGBB, #RRGGBBAA) or token reference ($tokenName). */
export const ColorSchema = z.string().regex(/^(#[0-9a-fA-F]{3,8}|\$[a-zA-Z][a-zA-Z0-9_-]*)$/, {
  message: 'Color must be a hex value (#RGB, #RRGGBB) or a token reference ($tokenName)',
});
export type Color = z.infer<typeof ColorSchema>;

// ─── SIZING MODES ────────────────────────────────────────────────────────────

export const SizeModeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), value: z.number().positive() }),
  z.object({ mode: z.literal('hug') }),
  z.object({ mode: z.literal('fill'), flex: z.number().positive().optional() }),
  z.object({ mode: z.literal('percent'), value: z.number().min(0).max(100) }),
]);
export type SizeMode = z.infer<typeof SizeModeSchema>;

// ─── CONSTRAINTS ─────────────────────────────────────────────────────────────

export const ConstraintsSchema = z.object({
  minWidth: z.number().nonnegative().optional(),
  maxWidth: z.number().nonnegative().optional(),
  minHeight: z.number().nonnegative().optional(),
  maxHeight: z.number().nonnegative().optional(),
  aspectRatio: z.number().positive().optional(),
});
export type Constraints = z.infer<typeof ConstraintsSchema>;

// ─── SIZING ──────────────────────────────────────────────────────────────────

export const SizingSchema = z.object({
  width: SizeModeSchema,
  height: SizeModeSchema,
});
export type Sizing = z.infer<typeof SizingSchema>;

// ─── LAYOUT ──────────────────────────────────────────────────────────────────

export const MainAxisSchema = z.enum([
  'start',
  'center',
  'end',
  'spaceBetween',
  'spaceAround',
  'spaceEvenly',
]);
export type MainAxis = z.infer<typeof MainAxisSchema>;

export const CrossAxisSchema = z.enum(['start', 'center', 'end', 'stretch', 'baseline']);
export type CrossAxis = z.infer<typeof CrossAxisSchema>;

export const PaddingSchema = z.object({
  top: z.number().nonnegative(),
  right: z.number().nonnegative(),
  bottom: z.number().nonnegative(),
  left: z.number().nonnegative(),
});
export type Padding = z.infer<typeof PaddingSchema>;

export const LayoutSchema = z.object({
  direction: z.enum(['row', 'column']),
  gap: z.number().nonnegative(),
  padding: PaddingSchema,
  mainAxis: MainAxisSchema,
  crossAxis: CrossAxisSchema,
  wrap: z.boolean().optional(),
  scroll: z.enum(['none', 'vertical', 'horizontal']).optional(),
});
export type Layout = z.infer<typeof LayoutSchema>;

// ─── OVERLAY ANCHOR ──────────────────────────────────────────────────────────

/** Anchoring for children of an `overlay` node. No raw x/y — edge-based only. */
export const AnchorSchema = z.object({
  top: z.number().optional(),
  right: z.number().optional(),
  bottom: z.number().optional(),
  left: z.number().optional(),
  alignment: z
    .enum(['topLeft', 'topCenter', 'topRight', 'centerLeft', 'center', 'centerRight', 'bottomLeft', 'bottomCenter', 'bottomRight'])
    .optional(),
});
export type Anchor = z.infer<typeof AnchorSchema>;

// ─── BREAKPOINTS ─────────────────────────────────────────────────────────────

/** Responsive layout overrides keyed by breakpoint. */
export const BreakpointSchema = z.enum(['compact', 'medium', 'expanded']);
export type Breakpoint = z.infer<typeof BreakpointSchema>;

export const BreakpointOverrideSchema = z.object({
  layout: LayoutSchema.partial().optional(),
  sizing: SizingSchema.partial().optional(),
});
export type BreakpointOverride = z.infer<typeof BreakpointOverrideSchema>;

// ─── SHADOW ──────────────────────────────────────────────────────────────────

export const ShadowSchema = z.object({
  color: ColorSchema,
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number().nonnegative(),
  opacity: z.number().min(0).max(1),
});
export type Shadow = z.infer<typeof ShadowSchema>;

// ─── STYLE SPEC ──────────────────────────────────────────────────────────────

/**
 * StyleSpec — visual properties only.
 * Layout/sizing is handled by the `sizing`, `layout`, and `constraints` fields
 * on DesignNode. Do not duplicate those here.
 */
export const StyleSpecSchema = z.object({
  // Visual
  backgroundColor: ColorSchema.optional(),
  borderRadius: z.number().nonnegative().optional(),
  borderWidth: z.number().nonnegative().optional(),
  borderColor: ColorSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  shadow: ShadowSchema.optional(),

  // Text
  color: ColorSchema.optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.enum(['400', '500', '600', '700', '800', '900']), z.string(), z.number()]).optional(),
  fontFamily: z.string().optional(),
  lineHeight: z.number().positive().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  letterSpacing: z.number().optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),

  // Overflow / clip
  overflow: z.enum(['visible', 'hidden', 'scroll', 'auto', 'ellipsis']).optional(),
});
export type StyleSpec = z.infer<typeof StyleSpecSchema>;

// ─── NODE TYPES ──────────────────────────────────────────────────────────────

export const NodeTypeSchema = z.enum([
  'frame',
  'stack',
  'overlay',
  'text',
  'button',
  'input',
  'image',
  'icon',
  'divider',
  'card',
  'list',
  'header',
  'footer',
  'switch',
  'checkbox',
  'avatar',
  'badge',
  'chip',
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── NAVIGATION ACTIONS ──────────────────────────────────────────────────────

export const PressActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('navigateTo'), screenId: z.string() }),
  z.object({ type: z.literal('openUrl'), url: z.string().url() }),
  z.object({ type: z.literal('none') }),
]);
export type PressAction = z.infer<typeof PressActionSchema>;

// ─── NODE PROPS (per type) ────────────────────────────────────────────────────

/** Base props common to multiple types. */
const BasePropFields = {
  onPress: PressActionSchema.optional(),
  testId: z.string().optional(),
};

export const TextPropsSchema = z.object({
  ...BasePropFields,
  content: z.string(),
  numberOfLines: z.number().int().positive().optional(),
  ellipsizeMode: z.enum(['head', 'middle', 'tail', 'clip']).optional(),
});

export const ButtonPropsSchema = z.object({
  ...BasePropFields,
  label: z.string(),
  variant: z.enum(['filled', 'outlined', 'ghost', 'text']).optional(),
  iconName: z.string().optional(),
  iconPosition: z.enum(['left', 'right']).optional(),
  disabled: z.boolean().optional(),
  loading: z.boolean().optional(),
});

export const InputPropsSchema = z.object({
  ...BasePropFields,
  placeholder: z.string().optional(),
  value: z.string().optional(),
  label: z.string().optional(),
  helperText: z.string().optional(),
  errorText: z.string().optional(),
  inputType: z.enum(['text', 'email', 'password', 'number', 'tel', 'url', 'search']).optional(),
  multiline: z.boolean().optional(),
  iconName: z.string().optional(),
  iconPosition: z.enum(['left', 'right']).optional(),
});

export const ImagePropsSchema = z.object({
  ...BasePropFields,
  src: z.string(), // data URI, local file URI, or https URL
  alt: z.string().optional(),
  resizeMode: z.enum(['cover', 'contain', 'stretch', 'center']).optional(),
  isPlaceholder: z.boolean().optional(),
  placeholderLabel: z.string().optional(),
});

export const IconPropsSchema = z.object({
  ...BasePropFields,
  name: z.string(), // must be in ICON_NAMES allowlist at runtime
  size: z.number().positive().optional(),
  color: ColorSchema.optional(),
});

export const DividerPropsSchema = z.object({
  ...BasePropFields,
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  thickness: z.number().positive().optional(),
  color: ColorSchema.optional(),
});

export const ListPropsSchema = z.object({
  ...BasePropFields,
  itemCount: z.number().int().positive().optional(),
  direction: z.enum(['vertical', 'horizontal']).optional(),
  // children[0] is the item template; rendered N times
});

export const SwitchPropsSchema = z.object({
  ...BasePropFields,
  checked: z.boolean().optional(),
  label: z.string().optional(),
  labelPosition: z.enum(['left', 'right']).optional(),
});

export const CheckboxPropsSchema = z.object({
  ...BasePropFields,
  checked: z.boolean().optional(),
  indeterminate: z.boolean().optional(),
  label: z.string().optional(),
});

export const AvatarPropsSchema = z.object({
  ...BasePropFields,
  src: z.string().optional(),
  initials: z.string().max(3).optional(),
  size: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
});

export const BadgePropsSchema = z.object({
  ...BasePropFields,
  content: z.union([z.string(), z.number()]).optional(),
  variant: z.enum(['filled', 'outlined', 'dot']).optional(),
  color: ColorSchema.optional(),
});

export const ChipPropsSchema = z.object({
  ...BasePropFields,
  label: z.string(),
  selected: z.boolean().optional(),
  iconName: z.string().optional(),
  variant: z.enum(['filled', 'outlined', 'ghost']).optional(),
});

export const FramePropsSchema = z.object({
  ...BasePropFields,
  componentId: z.string().optional(), // if this is a component instance
  maxWidth: z.number().positive().optional(), // desktop max-width container
});

// ─── DESIGN NODE ─────────────────────────────────────────────────────────────

const DesignNodeBaseSchema = z.object({
  id: z.string().min(1),
  type: NodeTypeSchema,
  name: z.string().optional(),
  props: z.record(z.unknown()),
  style: StyleSpecSchema,
  sizing: SizingSchema,
  layout: LayoutSchema.optional(), // required for container types
  constraints: ConstraintsSchema.optional(),
  anchor: AnchorSchema.optional(), // only for children of overlay nodes
  breakpoints: z.record(BreakpointSchema, BreakpointOverrideSchema).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export type DesignNodeBase = z.infer<typeof DesignNodeBaseSchema>;

// Lazy recursive type for children
export type DesignNode = DesignNodeBase & {
  children?: DesignNode[];
};

export const DesignNodeSchema: z.ZodType<DesignNode> = DesignNodeBaseSchema.extend({
  children: z.lazy(() => DesignNodeSchema.array()).optional(),
});

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

export const DesignTokensSchema = z.object({
  colors: z.record(z.string(), ColorSchema),
  fonts: z.record(
    z.string(),
    z.object({
      family: z.string(),
      weights: z.array(z.enum(['400', '500', '600', '700', '800', '900'])),
    }),
  ),
  radii: z.record(z.string(), z.number().nonnegative()),
  spacing: z.record(z.string(), z.number().nonnegative()),
  shadows: z.record(z.string(), ShadowSchema).optional(),
});
export type DesignTokens = z.infer<typeof DesignTokensSchema>;

// ─── SCREEN ──────────────────────────────────────────────────────────────────

export const ScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  root: DesignNodeSchema,
  tokens: DesignTokensSchema.optional(),
  schemaVersion: z.number().int().positive(),
});
export type Screen = z.infer<typeof ScreenSchema>;

// ─── PROJECT ─────────────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  idea: z.string().optional(),
  device: z.enum(['mobile-ios', 'mobile-android', 'tablet', 'desktop', 'custom']),
  customWidth: z.number().positive().optional(),
  customHeight: z.number().positive().optional(),
  styleKeywords: z.array(z.string()).optional(),
  brandColor: ColorSchema.optional(),
  defaultProvider: z.string().optional(),
  defaultModelId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.number().int().positive(),
  tokens: DesignTokensSchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ─── SCHEMA VERSION ──────────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 1;

// ─── LIMITS ──────────────────────────────────────────────────────────────────

export const DSL_LIMITS = {
  maxDepth: 12,
  maxNodes: 400,
  maxScreensPerRequest: 6,
} as const;
