# Architecture Decisions — TezMind

Decisions are recorded here when a requirement is ambiguous, a platform limitation is encountered,
or a deliberate tradeoff is made. Decisions are never deleted — only superseded.

---

## D001 — Web-first, Expo Router for navigation

**Date:** 2026-10-01
**Decision:** Use Expo SDK 52 + Expo Router as the navigation layer. Primary target is Web (`expo start --web`).
**Reason:** Expo Router provides file-based routing that works identically on web and native. Starting with web means the editor runs in a desktop browser without EAS builds.
**Consequences:** Some native-only APIs (expo-sqlite, expo-secure-store) are replaced with web equivalents behind the same interface.

---

## D002 — IndexedDB (Dexie) for web storage, not expo-sqlite

**Date:** 2026-10-01
**Decision:** Use Dexie (IndexedDB wrapper) on web. expo-sqlite only on native.
**Reason:** expo-sqlite does not work in a browser. Both implementations satisfy the same `ProjectStore` interface from `@tezmind/core`.
**Decision log:** Chose Dexie over raw IndexedDB for its TypeScript support, observable tables, and migrations API. Version: dexie@4.

---

## D003 — WebCrypto AES-GCM for token storage on web

**Date:** 2026-10-01
**Decision:** Encrypt API tokens with AES-GCM (256-bit) using a key derived from PBKDF2 (100k iterations, SHA-256). Store the ciphertext in `localStorage`.
**Reason:** Web has no `expo-secure-store` equivalent. The OS keychain is not available. AES-GCM provides authenticated encryption; PBKDF2 makes brute-force key derivation expensive.
**Security model:** This protects against casual inspection but NOT against malicious JS with same-origin access (XSS). The README clearly states this limitation. A future version may add optional passphrase protection.
**Consequences:** Tokens are lost when localStorage is cleared. This is acceptable for a local tool.

---

## D004 — Anthropic direct browser calls (CORS)

**Date:** 2026-10-01
**Decision:** Send `anthropic-dangerous-direct-browser-access: true` with every Anthropic API request from the browser.
**Reason:** Anthropic explicitly supports this header for browser-based direct calls. This avoids needing the proxy for Anthropic users.
**Reference:** Anthropic documentation on CORS.
**CORS result:** ✅ Verified supported.

---

## D005 — Google Gemini direct browser calls (CORS)

**Date:** 2026-10-01
**Decision:** Use the Gemini REST API directly from the browser. No special header needed.
**Reason:** Google AI Studio API supports CORS for browser requests using an API key.
**CORS result:** ✅ Verified supported (API key in query param, no Origin restriction on generativelanguage.googleapis.com).

---

## D006 — OpenAI requires proxy (CORS blocked)

**Date:** 2026-10-01
**Decision:** Route OpenAI API calls through the local proxy (`apps/proxy/server/proxy.mjs`) by default.
**Reason:** OpenAI's API at `api.openai.com` does not allow cross-origin browser requests (returns CORS errors). The local proxy at `127.0.0.1:3333` forwards requests without CORS restriction.
**CORS result:** ❌ Blocked. Must use proxy or native app.
**UI note:** Show a clear message: "OpenAI requires the local proxy. Run `npm run proxy` in a separate terminal."

---

## D007 — OpenRouter requires proxy (CORS blocked)

**Date:** 2026-10-01
**Decision:** Same as D006 — route OpenRouter through local proxy.
**CORS result:** ❌ Blocked (openrouter.ai blocks browser requests).

---

## D008 — No raw x/y positioning in design tree

**Date:** 2026-10-01
**Decision:** Auto Layout is the law. No `position: absolute`, `top`, `left`, `right`, `bottom` (except inside `overlay` nodes). This applies to the DSL, AI prompts, editor, and code generators.
**Reason:** Raw pixel coordinates produce designs that cannot be translated to responsive Flutter/React Native layouts. The same tree must render correctly at different screen sizes.
**Simplest option taken:** When the spec was ambiguous about "floating elements" (FABs, badges, bottom sheets), the `overlay` node type was introduced — a special container whose children are edge-anchored, not x/y positioned.

---

## D009 — AI returns JSON tree, not code

**Date:** 2026-10-01
**Decision:** The AI's output is always a JSON Design Tree (TezDSL), never raw React Native, Flutter, or HTML code.
**Reason:** JSON output is: (a) validatable with Zod, (b) renderable directly by the app, (c) editable at the node level, (d) deterministically convertible to multiple code targets. Raw code output would make tap-to-select and targeted edits impossible.
**Consequences:** Prompt engineering is critical; extensive schema examples and validation/retry logic are required.

---

## D010 — Figma import uses REST API via proxy (CORS)

**Date:** 2026-10-01
**Decision:** Figma REST API (`api.figma.com`) is blocked by CORS from browser. Route all Figma API calls through the local proxy.
**CORS result:** ❌ Blocked from browser (Figma does not set permissive CORS headers).
**Phase:** 5 (not yet implemented).

---

## D011 — pnpm workspaces over npm/yarn

**Date:** 2026-10-01
**Decision:** Use pnpm 9+ with `pnpm-workspace.yaml`.
**Reason:** pnpm is faster, has better monorepo support (`workspace:*` protocol), and enforces strict package isolation (no phantom dependencies).
**Requirement:** Users must install pnpm globally: `npm install -g pnpm`.

---

## D012 — Lucide Icons as the bundled icon set

**Date:** 2026-10-01
**Decision:** Use Lucide Icons via `lucide-react-native`. Maintain a static allowlist (`packages/ai/src/allowlists.ts`) of valid icon names.
**Reason:** Lucide is well-maintained, MIT licensed, SVG-based (works with react-native-svg), and has consistent icon naming. The AI is restricted to the allowlist to prevent unknown icon names from crashing the renderer.
**Consequence:** New icons require updating the allowlist and redeploying.
