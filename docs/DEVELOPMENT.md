# Development, fixtures, and release checks

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (default `http://localhost:5173`). |
| `npm run lint` | ESLint on `src/**/*.ts(x)` and `tests/**/*.ts`. |
| `npm run test` | Vitest unit tests. |
| `npm run build` | `tsc` + Vite **SPA** build only (`vite.config.ts` → `dist/`). |
| `npm run build:lib` | `tsc` + **npm package** build (`vite.lib.config.ts` → `dist-lib/`); used by `prepublishOnly` and embedders. |
| `npm run test:e2e` | Playwright (requires fixture MCAP; see below). |

## Fixtures (`public/examples/`)

Place sample bags/MCAP files here for local dev and E2E. Expected names include:

- `test_5s.mcap` — minimal indexed MCAP for most Playwright cases (generated automatically before `test:e2e`; see `scripts/gen-test-mcap.mjs`)
- `episode_20260122_122345.hdf5` — optional HDF5 case

Regenerate the default small MCAP (also run as `pretest:e2e` via `npm run gen:e2e:fixtures`):

```bash
npm run gen:e2e:fixtures
```

Override paths when files live elsewhere:

```bash
export ROSVIEW_TEST_MCAP=/absolute/path/to/test_5s.mcap
export ROSVIEW_TEST_HDF5=/absolute/path/to/episode.hdf5
npm run test:e2e
```

For sample deep links (`?url=sample://…`), set `VITE_SAMPLE_DATASETS_MANIFEST_URL` in `.env` to a reachable JSON manifest (see `src/services/sampleDatasets.ts`).

For remote lists in the browser during dev, prefer **same-origin** URLs, e.g.  
`http://localhost:5173/?url=/examples/test_5s.mcap`  
so Vite serves static files and Range requests correctly.

## Performance gates

### Manual baseline (recommended for PR notes)

| Scenario | Action | Goal (suggested) |
|----------|--------|------------------|
| ~1GB MCAP | Open via `?url=` until first frame is usable | Note seconds; watch main-thread long tasks |
| Multi-panel playback | 3+ panels, 2× speed for 60s | No severe jank; memory stable |
| Remote Range | Large file over HTTP Range | Time to first useful frame / draggable scrubber |

### Automated checks

- `npm run lint`, `npm run test`, `npm run build` (SPA), `npm run build:lib` (when validating the npm bundle), `npm run test:e2e` (with fixtures).
- CI: see `.github/workflows/ci.yml` (Node version should match `package.json` `engines`).

### WASM re-evaluation

Prefer main-thread rendering and subscription tuning before MCAP-parse WASM. Consider a WASM PoC only if worker traces show deserialize dominating, main-thread R3F cost is already low, and message latency still needs improvement.

## Acceptance (multi-source MCAP)

**Prerequisites**

1. `npm install` and (first time) `npx playwright install`.
2. Put `test_5s.mcap` under `public/examples/` or set `ROSVIEW_TEST_MCAP`.
3. `npm run dev` → `http://localhost:5173`.

**Playwright**

```bash
npm run test:e2e
```

**Manual checks (e.g. Chrome DevTools MCP)**

1. Open  
   `http://localhost:5173/?url=/examples/test_5s.mcap`  
   Confirm Dockview loads; no fatal console errors.
2. Sidebar shows Topics / Data / Tags (or localized equivalents).
3. Switch to **Data** if multiple sources are present; the successfully loaded row is highlighted.
4. Open `/`, upload or drag a local `.mcap`; confirm load succeeds.

If no local sample is available, smoke-test routing and sidebar shell only; full Range behavior needs same-origin static assets and correct CORS/Range headers.
