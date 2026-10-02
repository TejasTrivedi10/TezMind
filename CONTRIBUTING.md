# Contributing to TezMind

Thank you for your interest in contributing! TezMind is open-source and we welcome PRs, bug reports, and feature suggestions.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/TezMind.git`
3. Install pnpm: `npm install -g pnpm`
4. Install dependencies: `pnpm install`
5. Start the dev server: `pnpm dev`

## Branch Naming

- `feat/your-feature` — new features
- `fix/issue-description` — bug fixes
- `docs/what-you-documented` — documentation updates
- `refactor/what-you-changed` — refactors without behaviour change

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Gemini 2.0 support
fix: patch applier scope violation error message
docs: update DECISIONS.md with OpenAI CORS result
refactor: extract token redaction to util module
```

## Code Rules

- TypeScript strict mode everywhere
- No `any` without a comment explaining why
- `packages/core`, `ai`, `codegen-*`, `figma` must never import React, RN, Expo, or Node built-ins
- All AI tokens must go through `SecretsBridge`, never hardcoded or logged
- Run `pnpm lint` and `pnpm typecheck` before submitting

## Tests

- Write unit tests alongside code (Jest + React Native Testing Library)
- Mandatory tests: DSL operations, patch applier, provider adapters (mock HTTP), migrations
- Run tests: `pnpm test`

## Pull Requests

1. Open an issue first for large changes
2. Keep PRs focused — one thing at a time
3. Add tests for new functionality
4. Update docs if your change affects the architecture or developer experience

## Questions?

Open a [GitHub Discussion](https://github.com/TejasTrivedi10/TezMind/discussions) or an issue.
