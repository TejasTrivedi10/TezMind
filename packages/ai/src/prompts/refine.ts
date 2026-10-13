/**
 * Prompt Refiner system + user prompt builders
 *
 * The refiner takes a rough user prompt and produces a RefinedBrief JSON.
 * Uses a cheap model (Flash Lite tier), non-streaming, max 1500 output tokens.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { ICON_NAMES } from '../allowlists';

const ICON_NAMES_LIST = Array.from(ICON_NAMES).join(', ');

export function buildRefinerSystemPrompt(
  deviceWidth: number,
  deviceHeight: number,
  deviceKind: string,
): string {
  return `You are a senior mobile UI designer preparing a concise design brief for a UI generator.
Input: a rough user prompt plus device + brand + style context.
Output: ONLY valid JSON matching the RefinedBrief schema. No markdown, no prose, no code fences.

SCHEMA:
{
  "title": string,                    // "AppName — ScreenName"
  "purpose": string,                  // one sentence: what the user DOES on this screen
  "style": {
    "keywords": string[],             // e.g. ["dark", "minimal", "neon-green accent"]
    "density": "compact" | "comfortable",
    "radius": "sm" | "md" | "lg"
  },
  "outline": [                        // 3–8 items, top-to-bottom
    { "region": "header"|"body"|"footer"|"overlay", "component": string, "notes": string }
  ],
  "sampleContent": { [componentKey: string]: string[] }, // 3–6 realistic items per list; NO lorem ipsum
  "icons": string[],                  // 4–12 names from allowlist below
  "imageSlots": [                     // 0–4 items; only for photos/illustrations. Avatars are NOT image slots.
    { "slug": string, "alt": string, "ratio": "1:1"|"4:3"|"16:9"|"3:4"|"21:9", "tone": string }
  ],
  "motion": {
    "level": "none" | "subtle" | "rich",
    "entrance": string,               // e.g. "list items fade-up with stagger"
    "interactions": string[]          // e.g. ["buttons press-scale"]
  },
  "refinedPrompt": string             // 80–200 words, clear design direction for generator
}

RULES:
1. Keep the user's intent. Never invent features that contradict the prompt. Fill gaps with sensible common patterns.
2. outline: 3–8 items, top-to-bottom, each maps to a real UI component.
3. sampleContent: realistic human copy (real names, times, short messages). NO lorem ipsum.
4. icons: choose ONLY from this list — ${ICON_NAMES_LIST}. Drop any name not in the list.
5. imageSlots: only if screen genuinely needs photos/illustrations. Avatars use data-name="" NOT image slots.
6. motion: respect the provided level. none = empty entrance/interactions. subtle = entrance + press feedback. rich = subtle + ≤3 loop animations.
7. refinedPrompt: write as clear design direction: layout order, hierarchy, spacing feel, content, icons, motion. Mention "auto-layout, 4px grid".
8. Device: ${deviceWidth}×${deviceHeight} (${deviceKind}). Mobile = single column, bottom nav. Web = may use sidebar + grid.
9. Output ONLY the JSON object. Nothing else.`;
}

export function buildRefinerUserPrompt(params: {
  prompt: string;
  projectName?: string;
  projectDescription?: string;
  projectIdea?: string;
  styleKeywords?: string[];
  brandColor?: string;
  motionLevel?: string;
  deviceWidth?: number;
  deviceHeight?: number;
  deviceType?: string;
}): string {
  const {
    prompt,
    projectName,
    projectDescription,
    projectIdea,
    styleKeywords,
    brandColor,
    motionLevel = 'subtle',
    deviceWidth = 393,
    deviceHeight = 852,
    deviceType = 'mobile',
  } = params;

  return `USER PROMPT: ${prompt}

PROJECT: ${projectName || 'App'}
DESCRIPTION: ${projectDescription || ''}
IDEA: ${projectIdea || ''}
STYLE KEYWORDS: ${styleKeywords?.join(', ') || 'modern, clean, light'}
COLOR SCHEME: Follow the user's prompt. Use dark mode only when dark mode, a dark theme, night mode, or a dark background is explicitly requested; otherwise use light mode. Do not infer dark mode from the app category.
BRAND COLOR: ${brandColor || '#6C5CE7'}
MOTION LEVEL: ${motionLevel}
DEVICE: ${deviceType} ${deviceWidth}×${deviceHeight}px

Produce the RefinedBrief JSON. Output ONLY the JSON.`;
}
