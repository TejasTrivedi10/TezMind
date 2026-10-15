# TezMIND vs Proposed Pipeline — Architecture Audit

## Overall Coverage: ~72%

The proposed pipeline has **6 numbered steps**. TezMIND has fully built 4 of them,
partially built 1, and is missing 1 entirely.

---

## Step-by-step breakdown

### ✅ [1] Art Direction Picker — **Fully Implemented (and exceeded)**

> *"flash model → picks a preset + tweaks"*

**What you have:**

| Proposed | TezMIND equivalent | File |
|---|---|---|
| `presets.ts` — fintech / wellness / etc. | `UI_KIT_CATALOG` — 8 curated kits (Material 3, Glassmorphism, Booking & Travel, Bike, SMS, Minimal, Soft UI, Editorial) | [`ui_kits/catalog.ts`](file:///e:/TTech/TezMIND/packages/ai/src/ui_kits/catalog.ts) |
| `compileTokens()` — generates CSS vars | Full HTML reset + CSS token injection in [`resetCss.ts`](file:///e:/TTech/TezMIND/packages/core/src/html/resetCss.ts) | `core/src/html/resetCss.ts` |
| Keyword matching to pick a preset | `matchTerms: RegExp[]` auto-selects the right kit from the user's prompt | `catalog.ts` |
| `vibe` string injected into prompt | `guidance`, `vibe`, `description` injected into the generator system prompt | `expand.ts` |

**Where you go further:** You include hand-crafted reference `.html` files per kit
(e.g. `Booking_ui_kit_style.html`, `Glassmorphism UI kit.html`) as few-shot examples — something the
prompt _explicitly recommends_ as a tip. ✅

**Minor gap:** The proposed `compileTokens()` outputs pure CSS custom properties with a
strict spacing scale (`--space-4/8/12/16/24/32/48/64`). Your system uses a utility-class approach
(`.px-4`, `.gap-3`) compiled into a reset CSS — functionally equivalent, but tokens are embedded
in the class system rather than explicit `--space-*` vars enforced in lint.

---

### ✅ [2] Token Compiler — **Implemented (different shape)**

> *"your code → CSS variables, no model involved"*

| Proposed | TezMIND equivalent |
|---|---|
| `compileTokens(preset)` → `:root { --space-*, --c-*, ... }` | `resetCss.ts` + `hydrate.ts` inject full CSS (colors, spacing, typography, kit-specific overrides) |
| Spacing + type scale as tokens | Utility class system (`fill`, `hug`, `row`, `col`, `gap-*`, `text-*`) baked into reset |

**Gap:** Your token system is class-based, not `var(--c-*)` variable-based. The linter
(Step 4) cannot statically check "did the model use a token var?" but instead checks whether
the model used allowed utility classes. This is a deliberate tradeoff — arguably more robust
for LLM generation than pure CSS variables.

---

### ✅ [3] UI Generator — **Fully Implemented (and exceeded)**

> *"main model → HTML using ONLY the tokens"*

| Proposed | TezMIND equivalent |
|---|---|
| `systemPrompt(tokens, vibe)` with hard rules | `prompts/html.ts` — 322-line system prompt with hard rules on icons, images, motion, spacing, roles | [`html.ts`](file:///e:/TTech/TezMIND/packages/ai/src/prompts/html.ts) |
| `callModel({ user, system, temperature })` | `provider.generate()` with streaming via `streamComplete()` | [`pipeline.ts`](file:///e:/TTech/TezMIND/packages/ai/src/pipeline.ts) |
| Single-pass generation | `streamComplete()` handles MAX_TOKENS truncation + automatic continuation (up to 3 attempts) | `pipeline.ts:70–119` |
| Realistic content instruction | `sampleContent` injected into `generatorPrompt` from expander | [`expand.ts`](file:///e:/TTech/TezMIND/packages/ai/src/expand.ts) |
| Structured brief | `ExpandedBrief` with `outline`, `icons`, `imageSlots`, `motion`, `requiredRoles` | `expand.ts` |

**Where you go further:**
- Two-stage expansion: `expand()` runs a _fast flash model_ to produce a `RefinedBrief`, then
  `renderGeneratorPrompt()` builds the detailed prompt from it — exactly the pattern the tip
  recommends ("art direction first, generator second").
- Archetype detection (`analyze()`) maps prompts to known screen patterns, giving structure hints.
- Golden example in system prompt (the SMS app example in `html.ts`) — matches the tip about
  "1-2 gold-standard examples per preset."

---

### ✅ [4] Static Linter — **Fully Implemented (and more comprehensive)**

> *"your code → spacing, contrast, emoji, icons"*

| Proposed `lint.ts` check | TezMIND equivalent | File |
|---|---|---|
| Off-scale `px` values | `gap-*` off-4px-grid check (Rule 6) | [`htmlLint.ts`](file:///e:/TTech/TezMIND/packages/core/src/html/htmlLint.ts) |
| Raw hex colors | `style` attribute color check | `htmlLint.ts` |
| Emoji as icons | Disallowed — icons must use `<span class="icon" data-icon="NAME">` | `htmlLint.ts` Rule 11 |
| Placeholder content | Prompt-level enforcement + `sampleContent` from brief | `expand.ts` |
| Inconsistent icon stroke widths | Icon name allowlist check (unknown icon = error) | `htmlLint.ts` Rule 12 |
| — | **22 additional rules** beyond what's proposed | `htmlLint.ts` |
| — | Deterministic **autofix** before lint (idempotent) | [`autofix.ts`](file:///e:/TTech/TezMIND/packages/core/src/html/autofix.ts) |

**Where you go further:**
- `autofix.ts` auto-heals common violations _before_ the linter runs — exactly the tip:
  _"auto-fix before retrying; it's cheaper than a model retry."_
- Roles system: `data-role` attributes are required and validated (`completeness.ts`, `roles.ts`).

**Minor gap:** You don't have an explicit **contrast ratio** check in the static linter (the
proposed `lint.ts` delegates contrast to Playwright in Step 5). Your linter is token-class-based
so computed contrast isn't visible statically — which is why Step 5 (Playwright) matters.

---

### 🟡 [5] Render + DOM Checks — **Partially Implemented**

> *"Playwright → overflow, overlap, tap targets"*

| Proposed | TezMIND status |
|---|---|
| Playwright browser launch | ❌ Not present — no Playwright dependency |
| Overflow check | ✅ Partially — `lintBounds()` in `pipeline.ts` does bounds checking | [`pipeline.ts:168–183`](file:///e:/TTech/TezMIND/packages/ai/src/pipeline.ts#L168-L183) |
| Tap target size check (44px min) | ✅ — in `core/src/lint.ts` Rule 6 (TOUCH_TARGET_TOO_SMALL) but on DSL nodes, not rendered DOM |
| Text clipping / scroll width | ❌ Not computed (requires browser) |
| Real contrast (computed styles) | ❌ Not computed (requires browser) |
| Overlap detection | ❌ Not present |
| Screenshot capture | ❌ Not present |

**Summary:** The bounds/tap-target checks exist at the DSL level but not via real browser
rendering. The screenshot pipeline for vision critique (Step 6) depends on this step — so
Step 6 is also blocked.

---

### ❌ [6] Vision Critique — **Not Implemented**

> *"flash model → scored rubric on screenshot"*

| Proposed | TezMIND status |
|---|---|
| `critiquePrompt` with 1-5 scores (primary action, hierarchy, spacing, alignment, etc.) | ❌ Not present |
| `PASS()` threshold function | ❌ Not present |
| Feedback fed back to generator on fail | ✅ Partially — the repair loop in `pipeline.ts` uses lint errors as feedback (but no vision) |

**Impact:** Without the screenshot → vision critique loop, the retry only catches
_structural/code_ violations (linter), not _visual quality_ problems (bad hierarchy, generic
look, unclear primary action). This is the highest-value missing piece.

---

## Retry Loop — **Implemented (lint-only, not vision)**

| Proposed | TezMIND equivalent |
|---|---|
| `for attempt < 3` | `for pass < profile.repairPasses` (default = 2) | [`pipeline.ts:199`](file:///e:/TTech/TezMIND/packages/ai/src/pipeline.ts#L199) |
| Lint errors → feed back to model | `buildRepairPrompt(out, errs, brief)` | [`prompts/repair.ts`](file:///e:/TTech/TezMIND/packages/ai/src/prompts/repair.ts) |
| Cheap checks first, vision last | ✅ Autofix → lint → LLM repair (vision step missing) | `pipeline.ts` |
| Fall back to best attempt | ❌ Not implemented — always returns last repaired output | |

---

## Summary Table

| Step | Description | Status | Coverage |
|------|-------------|--------|----------|
| 1 | Art Direction Picker | ✅ Done (exceeded) | ~110% |
| 2 | Token Compiler | ✅ Done (different shape) | ~90% |
| 3 | UI Generator | ✅ Done (exceeded) | ~115% |
| 4 | Static Linter + Autofix | ✅ Done (exceeded) | ~120% |
| 5 | Render + DOM Checks (Playwright) | 🟡 Partial (no real browser) | ~35% |
| 6 | Vision Critique (screenshot → flash model) | ❌ Missing | 0% |
| — | Retry loop | 🟡 Partial (lint only, no vision) | ~70% |

**Overall: ~72% of the proposed architecture is implemented.**

---

## What to build next (priority order)

### Priority 1 — Playwright render check (unblocks Step 6)
```ts
// Missing: packages/ai/src/renderCheck.ts
import { chromium } from 'playwright';
export async function renderCheck(html: string, width = 390) { ... }
```
Install: `pnpm add -D playwright`

### Priority 2 — Vision critique loop
```ts
// Missing: packages/ai/src/critique.ts
// Use existing flash model provider → critiquePrompt → scored JSON
// Wire into pipeline.ts after renderCheck passes
```

### Priority 3 — Best-attempt tracking
```ts
// In pipeline.ts generateFromBrief():
let best = { html: '', score: -1 };
// Track score per attempt, return best if all retries fail
```

### Priority 4 — CSS contrast in htmlLint.ts
Add computed-style approximation using hex palette from the active kit — allows contrast
checking without a browser for the common case.
