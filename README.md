# TezMind

<div align="center">
  <h3>Open-source AI UI Design Tool — Bring Your Own Key</h3>
  <p>Generate beautiful, editable UI screens with Claude, Gemini, or GPT-4.<br/>Your API key stays in your browser. No backend. No lock-in.</p>
</div>

---

## ✨ What is TezMind?

TezMind is a local-first AI UI design tool. You describe an app idea, pick a screen size, and TezMind generates a complete, editable design using an AI model of your choice. Every generated screen is a structured **Auto Layout design tree** — not raw code or a static image — so you can tap to select, drag to reorder, and edit properties in the Inspector.

**Inspired by Google Stitch.** Open-source, extensible, and built to last.

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- pnpm ≥ 9 (`npm install -g pnpm`)

### Run locally

```bash
# Clone the repo
git clone https://github.com/TejasTrivedi10/TezMind.git
cd TezMind

# Install dependencies
pnpm install

# Start the web app
pnpm dev
# Open http://localhost:8081

# (Optional) Start the local CORS proxy in a second terminal
# Needed for OpenAI, OpenRouter; not required for Anthropic or Gemini
pnpm proxy
```

### Available commands

| Command | Description |
|---|---|
| `pnpm dev` | Start Expo web app (http://localhost:8081) |
| `pnpm proxy` | Start local CORS proxy (http://localhost:3333) |
| `pnpm build:web` | Build static web export to `apps/web/dist/` |
| `pnpm serve` | Serve the static build locally |
| `pnpm lint` | ESLint across all packages |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm test` | Run all tests |

## 🔑 Bring Your Own Key

TezMind never contacts any AI provider on your behalf. You supply your own API key:

1. Go to **Settings** in the app
2. Paste your API key for Anthropic, Google AI Studio, OpenAI, or OpenRouter
3. Keys are encrypted with WebCrypto AES-GCM and stored only in **this browser's localStorage**
4. Keys are sent **directly from your browser to the provider** — no intermediate server

**Supported providers:**
- **Anthropic (Claude)** — Opus, Sonnet, Haiku — [Get key](https://console.anthropic.com/settings/keys)
- **Google (Gemini)** — 1.5 Pro, 1.5 Flash, 2.0 — [Get key](https://aistudio.google.com/app/apikey)
- **OpenAI (GPT)** — GPT-4o, GPT-4o Mini, o1 — [Get key](https://platform.openai.com/api-keys)
- **OpenRouter** — 100+ models via one key — [Get key](https://openrouter.ai/keys)

## 🏗️ Architecture

### Generated image assets

When a generated screen contains image placeholders (`.img[data-img]`), the preview can search Google Images using the image's descriptive alt text or topic via `google_images_scraper` and display the first suitable result. Image discovery is optional: without the Python service running, TezMind keeps its local gradient placeholders.

1. Install the service dependencies with `python -m pip install -r python/requirements.txt`.
2. Start the service with `pnpm images:dev` alongside `pnpm dev`.

Set `EXPO_PUBLIC_IMAGE_SEARCH_URL` when the service runs on a different address (defaults to `http://127.0.0.1:8000`).

TezMind uses a **pnpm monorepo** with strict package boundaries:

```
tezmind/
  packages/
    core/           # DSL schemas, tree ops, HostBridge types — pure TypeScript
    ai/             # Provider adapters, prompts, validation — pure TypeScript
    codegen-flutter/ # TezDSL → Dart code generator
    codegen-rn/     # TezDSL → React Native TS code generator
    figma/          # Figma → TezDSL converter
    editor-ui/      # Canvas, layers, inspector (React Native + Web)
    cli/            # tezmind export CLI
  apps/
    web/            # Expo web app — the main product
    proxy/          # Local CORS proxy (127.0.0.1 only)
    vscode/         # Future VS Code extension (placeholder)
  docs/             # Architecture, decisions, prompts, DSL reference
```

**Key design decisions:**
- All AI output is validated JSON (TezDSL) — never `eval`'d, never raw code
- All I/O goes through a `HostBridge` interface, making the editor host-agnostic
- Auto Layout model (no raw x/y positions) ensures clean Flutter + RN code output
- IndexedDB (Dexie) on web, SQLite on native — same `ProjectStore` interface

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full details.

## 🔒 Privacy & Security

- **No telemetry.** The app collects no data by default.
- **No backend.** There is no TezMind server. The app is entirely local.
- **Keys encrypted.** API keys are encrypted with AES-GCM before storage.
- **Keys never logged.** All error messages redact token-like strings.
- **Keys never exported.** Project files and exports never contain tokens.
- **AI output sandboxed.** AI responses are validated as JSON; no `eval`, no HTML injection.
- **Image URLs sanitized.** Only `https://` and `data:` URIs are accepted from AI output.
- **Proxy is localhost-only.** The optional proxy binds to `127.0.0.1` and forwards only to an allowlist of known provider hosts.

## 📖 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design
- [`docs/UI_GENERATION_FLOW.md`](docs/UI_GENERATION_FLOW.md) — End-to-end UI generation pipeline & asset discovery
- [`docs/DSL.md`](docs/DSL.md) — TezDSL design tree reference
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Recorded architecture decisions
- [`docs/CODEGEN_MAPPING.md`](docs/CODEGEN_MAPPING.md) — Auto Layout → Flutter/RN mapping
- [`docs/VSCODE_PLAN.md`](docs/VSCODE_PLAN.md) — Future VS Code extension plan
- [`docs/PROMPTS.md`](docs/PROMPTS.md) — AI prompt templates documentation

## 🤝 Contributing

We welcome contributions! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit with conventional commits: `git commit -m 'feat: add amazing feature'`
4. Push and open a Pull Request

## 📄 License & Attribution

MIT License — see [`LICENSE`](LICENSE).

If you build something with TezMind, attribution is appreciated:
> Powered by [TezMind](https://github.com/TejasTrivedi10/TezMind) by Tejas Trivedi
