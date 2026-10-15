import { FONT_ALLOWLIST } from '@tezmind/core';
import type { ParsedHints } from '@tezmind/core';

export function buildDesignSystemSystemPrompt(): string {
  const allowedFonts = FONT_ALLOWLIST.join(', ');

  return `You are an expert design systems engineer and art director.
Your job is to generate a comprehensive, accessible, production-grade DesignSystem JSON object for a mobile app project.

CRITICAL RULES:
1. OUTPUT JSON ONLY. No markdown fences, no conversational prose, no preamble or postamble.
2. WCAG AA ACCESSIBILITY IS MANDATORY:
   - text on background MUST have contrast ratio >= 4.5:1
   - text on surface MUST have contrast ratio >= 4.5:1
   - onPrimary on primary MUST have contrast ratio >= 4.5:1
   - onSecondary on secondary MUST have contrast ratio >= 4.5:1
   - textMuted on background MUST have contrast ratio >= 3.0:1
   - In light mode, background must have higher luminance than text.
   - In dark mode, background must have lower luminance than text.
3. FONT ALLOWLIST:
   - Only fonts from this exact allowlist are valid:
   ${allowedFonts}
4. SPACING SCALE IS FIXED:
   - base: 4
   - scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
5. TYPE SCALE:
   - xs, sm, base, lg, xl, 2xl, 3xl, 4xl strictly ascending in px (e.g. 11, 13, 15, 18, 22, 26, 32, 40).
6. RADIUS ROLES:
   - card, button, input, sheet, chip, avatar (0 to 9999).
7. ICONS:
   - library: "material-symbols" (preferred), "lucide", or "fontawesome"
   - style: "outline", "solid", or "duotone"
   - tintCircle: boolean (whether to use tinted circular background wrappers for prominent icons)
   - size: { sm: 16, md: 24, lg: 32 }
8. MOTION:
   - durationFast < durationBase < durationSlow in ms (e.g. "150ms", "250ms", "400ms").
9. RULES:
   - 3 to 6 practical rules describing how to apply this design system consistently.
10. COLOR DIRECTION:
   - Choose a palette that fits the app's domain and user. Do not default to black and white unless explicitly requested.
   - When a selected palette is supplied, preserve its listed color values exactly; only derive missing roles and accessible foreground colors.`;
}

export function buildDesignSystemUserPrompt(params: {
  idea: string;
  name?: string;
  parsedHints?: ParsedHints;
  seedKitName?: string;
  seedKitDescription?: string;
  seedPalette?: Record<string, string>;
  chosenPalette?: { name: string; mode: 'light' | 'dark'; source: string; colors: Record<string, string> };
  domainProfile?: { domain: string; audience: string; mood: string[] };
}): string {
  const parts: string[] = [];

  parts.push(`PROJECT IDEA: ${params.idea}`);
  if (params.name) parts.push(`PROJECT NAME: ${params.name}`);
  if (params.domainProfile) parts.push(`APP CONTEXT: domain=${params.domainProfile.domain}; audience=${params.domainProfile.audience}; mood=${params.domainProfile.mood.join(', ')}`);
  if (params.chosenPalette) {
    parts.push(`LOCKED USER-CHOSEN PALETTE (HARD CONSTRAINT): ${JSON.stringify(params.chosenPalette.colors)}`);
    parts.push(`- Palette direction: ${params.chosenPalette.name}; mode: ${params.chosenPalette.mode}; source: ${params.chosenPalette.source}`);
    parts.push('- Keep these palette color values unchanged. Build the remaining design tokens around them and preserve accessible contrast.');
  }

  if (params.parsedHints) {
    parts.push(`USER STYLING HINTS:`);
    if (params.parsedHints.mode) parts.push(`- Preferred mode: ${params.parsedHints.mode}`);
    if (params.parsedHints.colors) parts.push(`- Color direction: ${params.parsedHints.colors.join(', ')}`);
    if (params.parsedHints.vibe) parts.push(`- Vibe keywords: ${params.parsedHints.vibe}`);
    if (params.parsedHints.radius) parts.push(`- Corner style: ${params.parsedHints.radius}`);
    if (params.parsedHints.raw) parts.push(`- Raw notes: "${params.parsedHints.raw}"`);
  }

  if (params.seedKitName) {
    parts.push(`INSPIRATION SEED KIT:`);
    parts.push(`- Kit Name: ${params.seedKitName}`);
    if (params.seedKitDescription) parts.push(`- Kit Description: ${params.seedKitDescription}`);
    if (params.seedPalette) {
      parts.push(`- Reference colors: ${JSON.stringify(params.seedPalette)}`);
    }
    parts.push(`(Use this kit as inspiration, but tailor the design system specifically to the app idea and ensure WCAG AA contrast)`);
  }

  parts.push(`Generate the complete DesignSystem JSON object now.`);
  return parts.join('\n');
}
