# VS Code Extension Plan

## Overview

TezMind will ship as a VS Code extension that hosts the `packages/editor-ui` in a Webview panel.
The extension will implement `HostBridge` using VS Code's native APIs.

## Status: Future (not started)

The extension host directory `apps/vscode/` is a placeholder.

## Architecture

```
VS Code Extension Host (Node.js)
    │
    │  implements HostBridge:
    │  - http: vscode.extensions.fetch (no CORS)
    │  - secrets: vscode.SecretStorage
    │  - projects: workspace file system (vscode.workspace.fs)
    │  - files: vscode.workspace.fs + vscode.window.showSaveDialog
    │  - ui: vscode.window.showInformationMessage / showErrorMessage
    │  - clock: Date.now()
    │
    ▼ postMessage bridge
VS Code Webview
    │
    │  loads packages/editor-ui web bundle
    │  HostBridge implemented as postMessage proxy to extension host
    │
    ▼
editor-ui (React Native Web)
```

## Implementation Steps

1. Create `apps/vscode/` as a VS Code extension project
2. Implement `HostBridge` in the extension host
3. Create a `postMessage`-based `HostBridge` adapter in the Webview
4. Build `packages/editor-ui` as a self-contained web bundle
5. Mount the bundle in the Webview
6. Test that all editor features work identically

## Extension Readiness Checklist (verified per phase)

- [ ] `packages/core`, `ai`, `codegen-*` import nothing host-specific (CI-enforced)
- [ ] Every I/O path goes through `HostBridge`
- [ ] Project format is file-based, versioned, and diff-friendly
- [ ] CLI can export a project to Flutter and RN without the UI
- [ ] Editor UI works when mounted with a different `HostBridge` (mock in tests)
- [ ] No secrets in project files, exports, or logs
