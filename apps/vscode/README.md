# VS Code Extension — Future

This directory is a placeholder for the future VS Code extension host.

See [`docs/VSCODE_PLAN.md`](../../docs/VSCODE_PLAN.md) for the full plan.

## Why this directory exists

The monorepo structure is designed so that when the VS Code extension is built,
it slots into this directory with minimal changes to `packages/core`, `packages/ai`,
and `packages/editor-ui`. The extension implements `HostBridge` using VS Code APIs
and mounts the editor UI in a Webview panel.

## Status

Not started. Contributions welcome after Phase 5 is complete.
