# Contributing to Xense MCAP Viewer

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Development setup

```bash
# 1. Fork the repository on GitHub, then clone your fork:
git clone https://github.com/<your-username>/rosview.git
cd rosview

# 2. Use the pinned Node.js version:
#    Install nvm: https://github.com/nvm-sh/nvm
nvm install   # reads .nvmrc (Node 24)
nvm use

# 3. Install dependencies and start dev server:
npm install
npm run dev   # http://localhost:5173
```

## Branch and PR workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or: fix/bug-description, docs/update-api-reference
   ```
2. Make your changes with focused commits (see commit convention below).
3. Run the full pre-PR check:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. Open a Pull Request against `main`. Fill in the PR template.
5. A maintainer will review within a few business days.

## Commit message convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

Examples:
```
feat(viewer): add autoPlay prop to McapViewerProps
fix(mcap): handle empty channel list without throwing
docs(api): document fileManifest prop with JSON example
```

## Testing

- **Unit tests** — add or update `*.test.ts` / `*.test.tsx` alongside the changed module:
  ```bash
  npm test              # run once
  npm test -- --watch   # watch mode
  ```
- **E2E tests** — see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for Playwright instructions.
- **Coverage** — run `npm test -- --coverage` to generate an lcov report.

## Internationalization

User-visible strings must go through **react-intl**. When adding UI text:

1. Pick the correct shard under `src/shared/intl/messages/<locale>/` (for example `panels.json` for panel UI, `welcome.json` for the welcome screen).
2. Add the same key to `en` and `zh` shards so all locales stay in sync.
3. Use stable dot-separated IDs (e.g. `panels.audio.settings.field.mute`).
4. Use ICU placeholders for dynamic values: `{count}` not string concatenation

`getMcapViewerMessages()` in [`src/shared/intl/loadMcapViewerMessages.ts`](src/shared/intl/loadMcapViewerMessages.ts) merges shards at build time; [`src/features/panels/framework/panelMessageSlug.ts`](src/features/panels/framework/panelMessageSlug.ts) documents `PanelType` → message slug mapping for `panels.<slug>.*` keys.

## Code style

- Match existing TypeScript and React patterns.
- Do not mix unrelated refactors with a bug fix in the same PR.
- All exported symbols in `src/entrypoints/index.ts` are stable public API — changes there require semver impact review, and breaking changes must be documented in the PR description.

## Need help?

Open a [GitHub Discussion](https://github.com/Vertax42/xense-mcap-viewer/discussions) if you have questions before opening an issue or PR.

**Note:** The open-source code and npm package live under the GitHub repository `Vertax42/xense-mcap-viewer`. Security and conduct contacts are listed under `SECURITY.md`.
