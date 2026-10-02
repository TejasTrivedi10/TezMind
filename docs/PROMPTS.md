# AI Prompt Templates — TezMind

## Overview

All prompt templates live in `packages/ai/src/prompts/v1.ts`.
They are plain TypeScript strings with typed parameters — easy to review, version, and test in a public repo.

## Versioning

Prompts are versioned. A new file (`v2.ts`) is created when breaking changes are needed.
Both versions may coexist during a migration period.

## Templates

### 1. Screen Generation (`buildScreenGenPrompt`)

**Input:**
- Project name, description, idea
- Style keywords, brand color
- Device type + dimensions
- Existing screens summary (for consistency)
- Design tokens (for color references)
- Max screens per request

**Output format:** `{ "screens": [Screen, ...], "tokens": DesignTokens }`

**Key rules enforced in the prompt:**
1. Output ONLY JSON — no markdown, no commentary
2. Use Auto Layout (sizing modes, layout field on containers)
3. Use token references (`$primary`, `$background`) for colors
4. No raw x/y; `anchor` only for overlay children
5. Spacing multiples of 4
6. Touch targets ≥ 44px
7. WCAG AA contrast
8. Realistic copy (no lorem ipsum)
9. Named sections for Layers panel readability

### 2. Image-to-Design (`buildImageToDesignPrompt`)

Same as screen generation plus:
- "Reproduce the layout, hierarchy, spacing, colors, and text from the image"
- Use placeholder boxes for photos (`isPlaceholder: true`)
- Extract color palette into `tokens`
- Infer semantic types (button, input, etc.)

### 3. Edit-by-Prompt (`buildEditByPromptPrompt`)

**Input:**
- Selected node ID + its JSON subtree
- Parent style summary
- Available design tokens
- User instruction

**Output format:** `{ "ops": [PatchOp, ...] }`

**Key rule:** "Only modify the selected node and its descendants. NEVER touch nodes outside the selected subtree."

### 4. Validation Retry (`buildValidationRetryPrompt`)

Sent when AI output fails validation:
- Lists all validation errors (numbered)
- Repeats the original request
- "Return corrected JSON only. No commentary."

## DSL Schema Summary

The schema summary (`DSL_SCHEMA_SUMMARY`) is injected into every system prompt.
It includes:
- Node structure (id, type, props, style, sizing, layout, children)
- SizeMode options (fixed/hug/fill/percent)
- Layout fields (direction, gap, padding, mainAxis, crossAxis)
- StyleSpec fields (visual only)
- Allowed fonts and icon names (from allowlists.ts)
- DesignTokens structure

## Testing Prompts

Run the validation module directly to test AI output:
```typescript
import { validateScreensOutput } from '@tezmind/ai';
const result = validateScreensOutput(rawAIOutput);
if (!result.ok) console.error(result.errors);
```

## Prompt Engineering Notes

- The schema summary + example adds ~2000 tokens to each request. This is necessary for reliable output.
- Models that work best: Claude Sonnet (most reliable JSON), Gemini 1.5 Pro (fast + cheap), GPT-4o
- Retry loop handles the most common failures: missing layout field, wrong color format, unknown icon name
- For edit-by-prompt, always inject the full selected node JSON — truncating it causes missed properties
