/**
 * Generation prompt templates — versioned, typed, reviewable.
 * Plain TypeScript strings with typed parameters.
 *
 * Version: v1
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { ICON_NAMES_ARRAY, ALLOWED_FONTS } from '../allowlists';

// ─── SCHEMA SUMMARY (injected into prompts) ──────────────────────────────────

export const DSL_SCHEMA_SUMMARY = `
## TezDSL Schema (Auto Layout Design Tree)

Every output must be a JSON object \`{ "screens": [Screen, ...] }\` (or \`{ "ops": [...] }\` for patches).

### Screen
\`\`\`
{ id: string, name: string, width: number, height: number, root: DesignNode, tokens?: DesignTokens }
\`\`\`

### DesignNode (recursive)
\`\`\`
{
  id: string,          // short alphanumeric, unique per screen
  type: NodeType,      // see types below
  name?: string,       // human label for Layers panel (required on top-level sections)
  props: {...},        // type-specific fields (see Props below)
  style: StyleSpec,    // visual only (no layout/sizing here)
  sizing: { width: SizeMode, height: SizeMode },
  layout?: Layout,     // REQUIRED for container types
  constraints?: { minWidth?, maxWidth?, minHeight?, maxHeight?, aspectRatio? },
  anchor?: { top?, right?, bottom?, left?, alignment? },  // ONLY for children of overlay nodes
  children?: DesignNode[]
}
\`\`\`

### NodeType
frame | stack | overlay | text | button | input | image | icon | divider | card | list | header | footer | switch | checkbox | avatar | badge | chip

### SizeMode
\`{ mode: "fixed", value: number }\` | \`{ mode: "hug" }\` | \`{ mode: "fill", flex?: number }\` | \`{ mode: "percent", value: 0-100 }\`

### Layout (required on all containers)
\`\`\`
{
  direction: "row" | "column",
  gap: number,
  padding: { top, right, bottom, left },
  mainAxis: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly",
  crossAxis: "start" | "center" | "end" | "stretch" | "baseline",
  wrap?: boolean,
  scroll?: "none" | "vertical" | "horizontal"
}
\`\`\`

### StyleSpec (visual only — no positioning)
backgroundColor, borderRadius, borderWidth, borderColor, opacity, shadow: { color, offsetX, offsetY, blur, opacity },
color, fontSize, fontWeight ("400"-"900"), fontFamily, lineHeight, textAlign, letterSpacing, textDecoration, textTransform, overflow

### Colors
Hex (#RGB, #RRGGBB, #RRGGBBAA) or token reference (\$primary, \$surface, etc.)

### Allowed fonts
${ALLOWED_FONTS.join(', ')}

### Allowed icon names (excerpt)
${ICON_NAMES_ARRAY.slice(0, 40).join(', ')}, ... (full list at allowlists.ts)

### DesignTokens (optional, recommended)
\`\`\`
{ colors: { primary, secondary, background, surface, text, textSecondary, border, error, success, warning }, fonts: {...}, radii: {...}, spacing: {...} }
\`\`\`
`.trim();

// ─── EXAMPLE SCREEN ──────────────────────────────────────────────────────────

export const DSL_EXAMPLE_COMPACT = `
Example (compact login card):
{ "screens": [{ "id":"s1","name":"Login","width":393,"height":852,
"root":{ "id":"root","type":"frame","name":"Screen","props":{},
"style":{"backgroundColor":"$background"},
"sizing":{"width":{"mode":"fill"},"height":{"mode":"fill"}},
"layout":{"direction":"column","gap":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"mainAxis":"start","crossAxis":"stretch"},
"children":[
  {"id":"h1","type":"header","name":"Top Bar","props":{},
   "style":{"backgroundColor":"$surface","borderColor":"$border","borderWidth":1},
   "sizing":{"width":{"mode":"fill"},"height":{"mode":"fixed","value":56}},
   "layout":{"direction":"row","gap":8,"padding":{"top":0,"right":16,"bottom":0,"left":16},"mainAxis":"spaceBetween","crossAxis":"center"},
   "children":[
     {"id":"logo","type":"text","name":"Logo","props":{"content":"TezMind"},
      "style":{"color":"$primary","fontSize":20,"fontWeight":"700","fontFamily":"Inter"},
      "sizing":{"width":{"mode":"hug"},"height":{"mode":"hug"}}},
     {"id":"icon1","type":"icon","name":"Help","props":{"name":"help-circle","size":24,"color":"$textSecondary"},
      "sizing":{"width":{"mode":"fixed","value":44},"height":{"mode":"fixed","value":44}}}
   ]},
  {"id":"body","type":"frame","name":"Body","props":{},
   "style":{},"sizing":{"width":{"mode":"fill"},"height":{"mode":"fill","flex":1}},
   "layout":{"direction":"column","gap":24,"padding":{"top":40,"right":24,"bottom":40,"left":24},"mainAxis":"center","crossAxis":"stretch"},
   "children":[
     {"id":"t1","type":"text","name":"Title","props":{"content":"Welcome back"},"style":{"color":"$text","fontSize":28,"fontWeight":"700"},"sizing":{"width":{"mode":"fill"},"height":{"mode":"hug"}}},
     {"id":"in1","type":"input","name":"Email","props":{"placeholder":"Email address","inputType":"email","label":"Email"},"style":{},"sizing":{"width":{"mode":"fill"},"height":{"mode":"fixed","value":56}}},
     {"id":"in2","type":"input","name":"Password","props":{"placeholder":"Password","inputType":"password","label":"Password"},"style":{},"sizing":{"width":{"mode":"fill"},"height":{"mode":"fixed","value":56}}},
     {"id":"btn1","type":"button","name":"Sign In","props":{"label":"Sign In","variant":"filled"},"style":{"backgroundColor":"$primary","borderRadius":12},"sizing":{"width":{"mode":"fill"},"height":{"mode":"fixed","value":52}}}
   ]}
]}}]}
`.trim();

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

export interface ScreenGenParams {
  projectName: string;
  projectDescription: string;
  idea?: string;
  styleKeywords?: string[];
  brandColor?: string;
  deviceWidth: number;
  deviceHeight: number;
  deviceType: string;
  prompt: string;
  existingScreensSummary?: string;
  tokensJson?: string;
  maxScreens: number;
}

/**
 * v1 — Screen generation system prompt.
 * Instructs the model to output ONLY JSON matching the TezDSL schema.
 */
export function buildScreenGenPrompt(params: ScreenGenParams): { system: string; user: string } {
  const system = `You are a senior product designer and UI engineer specializing in mobile and web interfaces.
Your ONLY job is to output a valid JSON design tree (TezDSL format) — no markdown fences, no commentary, no explanation.
Output ONLY the JSON object. If you write anything else, the pipeline will fail.

${DSL_SCHEMA_SUMMARY}

${DSL_EXAMPLE_COMPACT}

## Auto Layout Rules (MANDATORY — violating these will cause rejection and retry)
1. EVERY container node (frame, stack, card, list, header, footer) MUST have a "layout" field.
2. Use "sizing" with modes (fill/hug/fixed/percent). NEVER use raw width/height numbers at the DesignNode level.
3. Use token references (\$primary, \$background, etc.) for all colors where applicable.
4. Use only spacing values that are multiples of 4 (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
5. Use only whitelisted font families. Use only the whitelisted icon names.
6. Touch targets (buttons, switches) must be at least 44px in their fixed dimension.
7. NEVER output x/y coordinates. Use anchor { top/right/bottom/left } ONLY for children of "overlay" nodes.
8. Every top-level section must have a "name" field (for the Layers panel).
9. Use realistic copy — no lorem ipsum. Write actual labels, titles, and placeholder text appropriate for the app.
10. Maintain WCAG AA contrast: dark text on light backgrounds, light text on dark backgrounds.
11. Design for the EXACT device dimensions provided; respect safe areas (top 44px, bottom 34px on iOS).
12. Output must be parseable JSON. No trailing commas, no comments inside JSON.

Output format: \`{ "screens": [Screen, ...], "tokens": DesignTokens }\`
Maximum screens per response: ${'{maxScreens}'}.`;

  const user = `Project: ${params.projectName}
Description: ${params.projectDescription}${params.idea ? `\nIdea: ${params.idea}` : ''}${params.styleKeywords?.length ? `\nStyle: ${params.styleKeywords.join(', ')}` : ''}${params.brandColor ? `\nBrand color: ${params.brandColor}` : ''}
Device: ${params.deviceType} (${params.deviceWidth}×${params.deviceHeight}px)${params.existingScreensSummary ? `\n\nExisting screens (for consistency):\n${params.existingScreensSummary}` : ''}${params.tokensJson ? `\n\nDesign tokens to use:\n${params.tokensJson}` : ''}

Task: ${params.prompt}

Generate up to ${params.maxScreens} screen(s). Output ONLY the JSON object.`;

  return { system: system.replace('{maxScreens}', String(params.maxScreens)), user };
}

// ─── IMAGE TO DESIGN ─────────────────────────────────────────────────────────

export interface ImageToDesignParams extends Omit<ScreenGenParams, 'prompt' | 'maxScreens'> {
  followUpInstruction?: string;
}

export function buildImageToDesignPrompt(params: ImageToDesignParams): { system: string; user: string } {
  const base = buildScreenGenPrompt({
    ...params,
    prompt: 'Reproduce this design',
    maxScreens: 1,
  });

  const user = `Project: ${params.projectName}
Description: ${params.projectDescription}
Device: ${params.deviceType} (${params.deviceWidth}×${params.deviceHeight}px)

Reproduce the layout, hierarchy, spacing, colors, and text from the provided image as faithfully as possible.
- Use placeholder boxes (type: "image", props.isPlaceholder: true) for photos and illustrations.
- Extract a color palette into the "tokens" field.
- Infer semantic node types: if it looks like a button, use "button"; if it looks like an input, use "input".
${params.followUpInstruction ? `\nAdditional instruction: ${params.followUpInstruction}` : ''}

Output ONLY the JSON object.`;

  return { system: base.system, user };
}

// ─── EDIT BY PROMPT ──────────────────────────────────────────────────────────

export interface EditByPromptParams {
  selectedNodeId: string;
  selectedNodeJson: string;
  parentStyleSummary?: string;
  tokensJson?: string;
  instruction: string;
  deviceType: string;
}

/**
 * v1 — Edit-by-prompt system prompt.
 * Returns a JSON patch, not a full screen.
 */
export function buildEditByPromptPrompt(params: EditByPromptParams): { system: string; user: string } {
  const system = `You are a senior UI designer. Your job is to apply a targeted edit to a specific node in a design tree.

Output ONLY a JSON patch object: \`{ "ops": [...] }\`

## Patch operations:
- \`{ "op": "replace", "target": "<nodeId>", "node": { ...full DesignNode... } }\`
- \`{ "op": "update_style", "target": "<nodeId>", "style": { ...partial StyleSpec... } }\`
- \`{ "op": "update_props", "target": "<nodeId>", "props": { ...partial props... } }\`
- \`{ "op": "insert", "parent": "<nodeId>", "index": number, "node": { ...DesignNode... } }\`
- \`{ "op": "delete", "target": "<nodeId>" }\`
- \`{ "op": "move", "target": "<nodeId>", "parent": "<nodeId>", "index": number }\`

## HARD RULES
1. Only modify the selected node (${'{selectedNodeId}'}) and its descendants.
2. NEVER touch nodes outside the selected subtree unless the user explicitly says "change the whole screen."
3. All new or replaced nodes must follow Auto Layout rules (sizing modes, layout field on containers, no raw x/y).
4. Keep all other nodes exactly as they are.
5. Output ONLY the JSON patch. No commentary, no markdown.

${DSL_SCHEMA_SUMMARY}`;

  const user = `Selected node (id: ${params.selectedNodeId}):
${params.selectedNodeJson}
${params.parentStyleSummary ? `\nParent context: ${params.parentStyleSummary}` : ''}
${params.tokensJson ? `\nAvailable tokens: ${params.tokensJson}` : ''}

Instruction: ${params.instruction}

Output ONLY the JSON patch.`;

  return {
    system: system.replace('{selectedNodeId}', params.selectedNodeId),
    user,
  };
}

// ─── VALIDATION RETRY ────────────────────────────────────────────────────────

export function buildValidationRetryPrompt(
  originalRequest: string,
  validationErrors: string[],
): string {
  return `Your previous output failed validation with the following errors:

${validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Return a corrected version. Output ONLY the valid JSON object. No commentary, no markdown fences.

Original request:
${originalRequest}`;
}
