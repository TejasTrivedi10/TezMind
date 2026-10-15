/**
 * DesignSystem — core data contracts for the dynamic design pipeline.
 *
 * All schemas are Zod-based and derive TypeScript types.
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { z } from 'zod';

// ── Font allowlist (Google Fonts subset + system) ─────────────────────────────

export const FONT_ALLOWLIST = [
  // Sans-serif
  'Inter', 'Manrope', 'DM Sans', 'Outfit', 'Nunito', 'Quicksand',
  'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Raleway', 'Rubik',
  'Work Sans', 'Noto Sans', 'IBM Plex Sans', 'Space Grotesk',
  'Plus Jakarta Sans', 'Figtree', 'Geist',
  // Serif
  'Playfair Display', 'Fraunces', 'Lora', 'Merriweather',
  'Source Serif 4', 'DM Serif Display',
  // Monospace
  'IBM Plex Mono', 'DM Mono', 'Fira Code', 'Geist Mono',
  // System fallbacks (always allowed)
  'system-ui', 'sans-serif', 'serif', 'monospace',
] as const;

export type FontFamily = (typeof FONT_ALLOWLIST)[number];

export const SPACING_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;
export type SpacingValue = (typeof SPACING_SCALE)[number];

export const TYPE_SCALE_PX = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64] as const;
export type TypeScaleValue = (typeof TYPE_SCALE_PX)[number];

// ── Color ─────────────────────────────────────────────────────────────────────

/** Hex color string #RRGGBB */
const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color (#RRGGBB)');

export const DesignSystemColorsSchema = z.object({
  primary: HexColor,
  onPrimary: HexColor,
  secondary: HexColor,
  onSecondary: HexColor,
  accent: HexColor,
  background: HexColor,
  surface: HexColor,
  surfaceAlt: HexColor,
  border: HexColor,
  divider: HexColor,
  text: HexColor,
  textMuted: HexColor,
  textInverse: HexColor,
  success: HexColor,
  warning: HexColor,
  danger: HexColor,
  info: HexColor,
});

export type DesignSystemColors = z.infer<typeof DesignSystemColorsSchema>;

// ── Typography ────────────────────────────────────────────────────────────────

const FontFamilySchema = z.string().min(1).max(80);

export const DesignSystemTypographySchema = z.object({
  fontFamily: z.object({
    heading: FontFamilySchema,
    body: FontFamilySchema,
    mono: FontFamilySchema.optional(),
  }),
  scale: z.object({
    xs: z.number().int().min(8).max(24),
    sm: z.number().int().min(10).max(28),
    base: z.number().int().min(12).max(32),
    lg: z.number().int().min(14).max(40),
    xl: z.number().int().min(16).max(48),
    '2xl': z.number().int().min(18).max(64),
    '3xl': z.number().int().min(20).max(80),
    '4xl': z.number().int().min(24).max(96),
  }),
  weights: z.object({
    regular: z.literal('400'),
    medium: z.literal('500'),
    semibold: z.literal('600'),
    bold: z.literal('700'),
  }),
  lineHeights: z.object({
    tight: z.number().min(1).max(1.5),
    normal: z.number().min(1.2).max(1.8),
    relaxed: z.number().min(1.4).max(2.2),
  }),
});

export type DesignSystemTypography = z.infer<typeof DesignSystemTypographySchema>;

// ── Spacing ───────────────────────────────────────────────────────────────────

export const DesignSystemSpacingSchema = z.object({
  base: z.literal(4),
  scale: z.tuple([
    z.literal(4), z.literal(8), z.literal(12), z.literal(16), z.literal(20),
    z.literal(24), z.literal(32), z.literal(40), z.literal(48), z.literal(64),
  ]),
});

export type DesignSystemSpacing = z.infer<typeof DesignSystemSpacingSchema>;

// ── Radius ────────────────────────────────────────────────────────────────────

export const DesignSystemRadiusSchema = z.object({
  none: z.literal(0),
  sm: z.number().int().min(0).max(8),
  md: z.number().int().min(0).max(16),
  lg: z.number().int().min(0).max(24),
  xl: z.number().int().min(0).max(40),
  full: z.number().int().min(0).max(9999),
  // Semantic role aliases
  card: z.number().int().min(0).max(40),
  button: z.number().int().min(0).max(9999),
  input: z.number().int().min(0).max(24),
  sheet: z.number().int().min(0).max(40),
  chip: z.number().int().min(0).max(9999),
  avatar: z.number().int().min(0).max(9999),
});

export type DesignSystemRadius = z.infer<typeof DesignSystemRadiusSchema>;

// ── Elevation ─────────────────────────────────────────────────────────────────

export const DesignSystemElevationSchema = z.object({
  none: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
});

export type DesignSystemElevation = z.infer<typeof DesignSystemElevationSchema>;

// ── Icons ─────────────────────────────────────────────────────────────────────

export const DesignSystemIconsSchema = z.object({
  library: z.enum(['fontawesome', 'material-symbols', 'lucide']),
  style: z.enum(['solid', 'outline', 'duotone']),
  tintCircle: z.boolean(),
  strokeWidth: z.number().min(0.5).max(3).optional(),
  size: z.object({
    sm: z.number().int().min(12).max(32),
    md: z.number().int().min(16).max(48),
    lg: z.number().int().min(20).max(64),
  }),
});

export type DesignSystemIcons = z.infer<typeof DesignSystemIconsSchema>;

// ── Motion ────────────────────────────────────────────────────────────────────

export const DesignSystemMotionSchema = z.object({
  durationFast: z.string().regex(/^\d+ms$/),
  durationBase: z.string().regex(/^\d+ms$/),
  durationSlow: z.string().regex(/^\d+ms$/),
  easing: z.string().min(1),
});

export type DesignSystemMotion = z.infer<typeof DesignSystemMotionSchema>;

// ── DesignSystem (root) ───────────────────────────────────────────────────────

export const DesignSystemSchema = z.object({
  version: z.number().int().min(1),
  mode: z.enum(['light', 'dark']),
  name: z.string().min(1).max(80),
  vibe: z.string().min(1).max(200),
  paletteName: z.string().min(1).max(80).optional(),
  paletteSource: z.enum(['grounded', 'serp', 'knowledge', 'hint']).optional(),
  colors: DesignSystemColorsSchema,
  typography: DesignSystemTypographySchema,
  spacing: DesignSystemSpacingSchema,
  radius: DesignSystemRadiusSchema,
  elevation: DesignSystemElevationSchema,
  borders: z.object({
    width: z.number().int().min(0).max(4),
    style: z.literal('solid'),
  }),
  icons: DesignSystemIconsSchema,
  motion: DesignSystemMotionSchema,
  density: z.enum(['compact', 'comfortable', 'spacious']),
  rules: z.array(z.string().min(1).max(200)).max(12),
});

export type DesignSystem = z.infer<typeof DesignSystemSchema>;

// ── Composition (§13.2) ───────────────────────────────────────────────────────

export const CompositionContainerSchema: z.ZodType<CompositionContainer> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    role: z.string().min(1).max(80),
    icon: z.string().optional(),
    contentSlots: z.array(z.string()),
    children: z.array(CompositionContainerSchema).max(10).optional(),
  }),
);

export interface CompositionContainer {
  id: string;
  role: string;
  icon?: string;
  contentSlots: string[];
  children?: CompositionContainer[];
}

export const CompositionSectionSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(['header', 'hero', 'summary', 'list', 'grid', 'form', 'actions', 'filters', 'footer', 'nav', 'empty-state']),
  layout: z.enum(['row', 'col', 'grid-2', 'grid-3', 'wrap', 'stack']),
  containers: z.array(CompositionContainerSchema).max(20),
  minItems: z.number().int().min(1).optional(),
});

export type CompositionSection = z.infer<typeof CompositionSectionSchema>;

export const IconPlanItemSchema = z.object({
  name: z.string().min(1),
  where: z.string().min(1),
  purpose: z.enum(['nav', 'action', 'status', 'leading', 'trailing', 'decor']),
});

export type IconPlanItem = z.infer<typeof IconPlanItemSchema>;

export const CompositionSchema = z.object({
  sections: z.array(CompositionSectionSchema).min(1).max(12),
  iconPlan: z.array(IconPlanItemSchema).max(30),
});

export type Composition = z.infer<typeof CompositionSchema>;

// ── ComponentRecord (§3.2) ────────────────────────────────────────────────────

export const ComponentPropSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean(),
  default: z.unknown().optional(),
});

export const ComponentRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().min(1).default(1),
  kind: z.literal('GENERIC'),
  description: z.string().min(1).max(200),
  props: z.array(ComponentPropSchema),
  slots: z.array(z.string()).default([]),
  variants: z.array(z.string()),
  html: z.string(),
  cssChunkId: z.string(),
  designSystemVersion: z.number().int().min(1),
  contentHash: z.string(),
  createdByScreenId: z.string(),
  usedByScreens: z.array(z.string()),
  status: z.enum(['building', 'ready', 'failed']),
});

export type ComponentRecord = z.infer<typeof ComponentRecordSchema>;
export type ComponentProp = z.infer<typeof ComponentPropSchema>;

// ── ScreenSummary + ProjectContext (§3.3) ─────────────────────────────────────

export const ScreenSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  purpose: z.string().min(1).max(300),
  usedComponentIds: z.array(z.string()),
  navigationLinks: z.array(z.string()),
});

export type ScreenSummary = z.infer<typeof ScreenSummarySchema>;

export const ProjectContextSchema = z.object({
  projectId: z.string().min(1),
  designSystem: DesignSystemSchema,
  tokensCssHash: z.string(),
  registry: z.array(ComponentRecordSchema),
  screens: z.array(ScreenSummarySchema),
  iconUsage: z.record(z.string(), z.string()).optional(),
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

// ── Project & Hints (§3.4) ───────────────────────────────────────────────────

export const ParsedHintsSchema = z.object({
  colors: z.array(z.string()).optional(),
  vibe: z.string().optional(),
  typography: z.string().optional(),
  radius: z.string().optional(),
  mode: z.enum(['light', 'dark']).optional(),
  raw: z.string().optional(),
});

export type ParsedHints = z.infer<typeof ParsedHintsSchema>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  designMode: z.enum(['auto', 'custom', 'seed']).default('auto'),
  seedKitId: z.string().optional(),
  userHints: z.string().optional(),
  parsedHints: ParsedHintsSchema.optional(),
  designSystem: DesignSystemSchema.optional(),
  designSystemLocked: z.boolean().default(false),
});

export type Project = z.infer<typeof ProjectSchema>;
export const DesignSystemProjectSchema = ProjectSchema;
export type DesignSystemProject = Project;

// ── CSS Chunk types ───────────────────────────────────────────────────────────

export type ChunkKind = 'base' | 'tokens' | 'utilities' | 'component' | 'screen';

export interface CssChunk {
  id: string;
  kind: ChunkKind;
  hash: string;
  css: string;
}

// ── LintContext (passed to htmlLint rules that need design system) ─────────────

export interface LintContext {
  designSystem?: DesignSystem;
  composition?: Composition;
  /** Icon usage map: concept → icon name, for consistency checks */
  iconUsage?: Record<string, string>;
}
