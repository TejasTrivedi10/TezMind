# TezDSL — Design Tree Reference

## Overview

TezDSL is the canonical JSON representation of a UI design in TezMind.
Every AI-generated screen, manually edited element, and exported design is a TezDSL tree.

## Key Principles

1. **Auto Layout first** — No raw x/y positions. All layout uses `sizing` + `layout` fields.
2. **Type-safe** — Validated with Zod schemas in `packages/core/src/dsl.ts`.
3. **Code-generation-ready** — The same tree generates Flutter, React Native, and HTML.
4. **AI-input validated** — All AI output is parsed and rejected if invalid.

## Node Types

| Type | Description | Children? |
|---|---|---|
| `frame` | Generic flexbox container | ✅ |
| `stack` | Convenience alias for frame with direction preset | ✅ |
| `overlay` | Floating container; children are edge-anchored | ✅ |
| `text` | Text label or paragraph | ❌ |
| `button` | Pressable button | ❌ |
| `input` | Text input field | ❌ |
| `image` | Image or placeholder | ❌ |
| `icon` | Vector icon (Lucide) | ❌ |
| `divider` | Horizontal/vertical line | ❌ |
| `card` | Styled card container | ✅ |
| `list` | Repeating item template | ✅ (template) |
| `header` | App bar / navigation bar | ✅ |
| `footer` | Tab bar / footer area | ✅ |
| `switch` | Toggle switch | ❌ |
| `checkbox` | Checkbox | ❌ |
| `avatar` | User avatar | ❌ |
| `badge` | Badge/notification dot | ❌ |
| `chip` | Pill/chip label | ❌ |

## Sizing Modes

```typescript
type SizeMode =
  | { mode: 'fixed'; value: number }    // px
  | { mode: 'hug' }                     // shrink to content
  | { mode: 'fill'; flex?: number }     // expand to available space
  | { mode: 'percent'; value: number }  // % of parent
```

## Layout (required on all containers)

```typescript
interface Layout {
  direction: 'row' | 'column';
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  mainAxis: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly';
  crossAxis: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  wrap?: boolean;
  scroll?: 'none' | 'vertical' | 'horizontal';
}
```

## Design Tokens

```typescript
interface DesignTokens {
  colors: { primary, secondary, background, surface, text, textSecondary, border, error, success, warning, ... };
  fonts: { default: { family: string; weights: string[] } };
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 };
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, ... };
}
```

Color references: `$primary`, `$background`, `$surface`, etc. (must be defined in tokens).

## Example: Login Screen

```json
{
  "screens": [{
    "id": "screen-1",
    "name": "Login",
    "width": 393,
    "height": 852,
    "root": {
      "id": "root",
      "type": "frame",
      "name": "Screen",
      "props": {},
      "style": { "backgroundColor": "$background" },
      "sizing": { "width": { "mode": "fill" }, "height": { "mode": "fill" } },
      "layout": {
        "direction": "column", "gap": 0,
        "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
        "mainAxis": "start", "crossAxis": "stretch"
      },
      "children": [...]
    }
  }]
}
```

## Auto Layout Rules (enforced by linter)

1. Every container must have a `layout` field.
2. No raw `x`, `y` coordinates — use `anchor` on overlay children only.
3. Spacing values must be multiples of 4.
4. Colors must be hex or token references (`$primary`).
5. Icon names must be in the Lucide allowlist.
6. Font families must be in the allowed list.
7. Tree depth ≤ 12 nodes.
8. Total nodes per screen ≤ 400.
9. Touch targets ≥ 44px.
