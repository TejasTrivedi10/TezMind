/**
 * RefinedBrief — structured design brief produced by the Prompt Refiner.
 *
 * This is the intermediate artifact between a rough user prompt and
 * the HTML generator. The refiner (cheap model, non-streaming) fills
 * this schema; the generator consumes it.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { z } from 'zod';

// ── Schema ────────────────────────────────────────────────────────────────────

export const RefinedBriefSchema = z.object({
  title: z.string().trim().min(1).max(80).describe('Short human-readable title, e.g. "MagicSMS — Home"'),
  purpose: z.string().trim().min(8).max(280).describe('One sentence: what this screen lets the user DO'),

  style: z.object({
    keywords: z.array(z.string().trim().min(1).max(48)).min(1).max(8).describe('e.g. ["dark", "minimal", "neon-green accent"]'),
    density: z.enum(['compact', 'comfortable']),
    radius: z.enum(['sm', 'md', 'lg']),
  }),

  outline: z.array(z.object({
    region: z.enum(['header', 'body', 'footer', 'overlay']),
    component: z.string().trim().min(1).max(100).describe('e.g. "app bar", "hero card", "conversation list", "bottom nav"'),
    notes: z.string().trim().min(1).max(280).describe('Brief layout or content notes'),
  })).min(1).max(8).describe('Top-to-bottom order of major UI regions'),

  sampleContent: z.record(z.string().trim().min(1).max(64), z.array(z.string().trim().min(1).max(200)).max(8))
    .describe('Realistic copy per component key, 3–6 items for lists. NO lorem ipsum.'),

  icons: z.array(z.string().trim().min(1).max(48)).max(12)
    .describe('4–12 icon names from the Lucide allowlist'),

  imageSlots: z.array(z.object({
    slug: z.string().describe('kebab-case image identifier, e.g. "hero-banner"'),
    alt: z.string().describe('descriptive alt text'),
    ratio: z.enum(['1:1', '4:3', '16:9', '3:4', '21:9']),
    tone: z.string().trim().min(1).max(80).describe('color/mood hint e.g. "dark teal gradient"'),
  })).max(3).describe('Only if screen genuinely needs photos/illustrations. Avatars are NOT image slots.'),

  motion: z.object({
    level: z.enum(['none', 'subtle', 'rich']),
    entrance: z.string().max(120).describe('e.g. "list items fade-up with stagger"'),
    interactions: z.array(z.string().trim().min(1).max(120)).max(6).describe('e.g. ["buttons press-scale", "AI button pulse"]'),
  }),

  refinedPrompt: z.string().trim()
    .min(80)
    .max(1500)
    .describe('Final natural-language prompt for the generator (80–200 words). Mention auto-layout and 4px grid.'),
});

export type RefinedBrief = z.infer<typeof RefinedBriefSchema>;

/**
 * The expander is allowed to omit fields; every field it does provide must
 * still satisfy the same constraints as a complete refined brief.
 */
export const RefinerOutputSchema = RefinedBriefSchema.partial();
export type RefinerOutput = z.infer<typeof RefinerOutputSchema>;

import type { Role } from './html/roles';
import type { UiKitStyleContext } from './host';

export interface ExpandInput {
  prompt: string;
  project: { name: string; idea?: string; brand: string; keywords: string[]; materialDesign3?: boolean; uiKit?: UiKitStyleContext };
  device: { w: number; h: number; kind: 'mobile' | 'tablet' | 'web' };
  motionLevel: 'none' | 'subtle' | 'rich';
}

export interface ExpandedBrief extends RefinedBrief {
  archetypeId: string | null;
  requiredRoles: Role[];
  generatorPrompt: string; // what is actually sent to the generator
}

// ── Validation helper ─────────────────────────────────────────────────────────

export function parseRefinedBrief(json: unknown): { ok: true; brief: RefinedBrief } | { ok: false; error: string } {
  try {
    const result = RefinedBriefSchema.safeParse(json);
    if (result.success) return { ok: true, brief: result.data };
    return { ok: false, error: result.error.issues.map((i) => i.message).join('; ') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Parse error' };
  }
}
