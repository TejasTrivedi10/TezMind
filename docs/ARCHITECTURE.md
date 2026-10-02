# Architecture — TezMind

## Overview

TezMind is a **web-first, local-first AI UI design tool** built as a React Native (Expo) monorepo. The primary target is a desktop browser at `http://localhost:8081`. Android/iOS are secondary.

## Monorepo Layout

```
tezmind/
  pnpm-workspace.yaml
  packages/
    core/             # Pure TS: DSL, tree ops, patch, linter, migrations, HostBridge
    ai/               # Pure TS: providers, prompts, validation/retry
    codegen-flutter/  # Pure TS: TezDSL → Dart
    codegen-rn/       # Pure TS: TezDSL → React Native TS
    figma/            # Pure TS: Figma REST → TezDSL
    editor-ui/        # RN + react-native-web: canvas, layers, inspector
    cli/              # tezmind export CLI
  apps/
    web/              # Expo web app: home, wizard, settings, editor
    proxy/            # Local CORS proxy (127.0.0.1:3333)
    vscode/           # FUTURE: VS Code extension host (placeholder)
  docs/               # Design documentation
```

## Host-Agnostic Core (Mandatory Architecture Rule)

`packages/core`, `ai`, `codegen-*`, and `figma` must import **nothing** from:
- `react`, `react-native`, `react-native-*`, `expo`, `expo-*`
- `fs`, `path`, `os`, `crypto` (Node built-ins)
- DOM APIs (`window`, `document`, `localStorage`)

This is enforced by ESLint `no-restricted-imports` rules in `.eslintrc.json`.

All I/O goes through the `HostBridge` interface defined in `packages/core/src/host.ts`.

## HostBridge

```typescript
interface HostBridge {
  http: HttpBridge;       // All network requests
  secrets: SecretsBridge; // Token storage (WebCrypto on web, SecretStorage on VS Code)
  projects: ProjectStore; // Project CRUD (IndexedDB on web, workspace files on VS Code)
  files: FilesBridge;     // Exports and image picking
  ui: UIBridge;           // Notifications and confirm dialogs
  clock: ClockBridge;     // now() for testability
}
```

**Web implementation:** `apps/web/host/` — browser fetch, WebCrypto AES-GCM, Dexie/IndexedDB.
**Future VS Code implementation:** extension-host fetch, `SecretStorage`, workspace FS.

## Design Tree (TezDSL)

The design is a JSON tree (not raw code). Every node has:
- `type`: one of 20 node types (frame, text, button, input, image, etc.)
- `sizing`: `{ width: SizeMode, height: SizeMode }` — fill/hug/fixed/percent
- `layout`: `{ direction, gap, padding, mainAxis, crossAxis, wrap, scroll }` — required on containers
- `style`: visual only (colors, shadows, borders, typography)
- `anchor`: edge-based anchoring for overlay children (no raw x/y)
- `constraints`: min/max/aspectRatio

AI output is validated against Zod schemas and semantic rules before being applied.
Invalid output is retried up to 2 times with validation errors as context.

## Data Flow

```
User Prompt
    │
    ▼
AIProvider.generate()     ← packages/ai
    │
    ▼ (streaming events)
validateScreensOutput()   ← packages/ai/validator
    │ (validated JSON)
    ▼
applyPatch() / store      ← packages/core/patch + apps/web/store
    │
    ▼
renderNode()              ← packages/editor-ui
    │
    ▼
Canvas (React Native Web)
```

## Storage

| Layer | Web | Native (future) |
|---|---|---|
| Projects | IndexedDB (Dexie) | expo-sqlite |
| Tokens | WebCrypto-encrypted localStorage | expo-secure-store |
| Assets | IndexedDB blob storage | expo-file-system |
| History | IndexedDB | expo-sqlite |

## Phases

See [`tezmind_plan.md`](../brain/5ae46ece.../tezmind_plan.md) for full phase tracking.

- **Phase 0:** ✅ Monorepo, contracts, HostBridge, DSL schemas
- **Phase 1:** ✅ Expo web app, home, wizard, settings, IndexedDB, WebCrypto
- **Phase 2:** 🔲 Canvas, renderer, layers, inspector, tap-select, undo/redo
- **Phase 3:** 🔲 AI generation pipeline, Anthropic + Gemini adapters
- **Phase 4:** 🔲 Drag-drop, resize, edit-by-prompt, components
- **Phase 5:** 🔲 Figma import, image-to-design, Flutter + RN codegen, CLI
- **Phase 6:** 🔲 Polish, perf, a11y, release
