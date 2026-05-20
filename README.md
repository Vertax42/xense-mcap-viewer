# Xense MCAP Viewer

[简体中文文档 - README.zh.md](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> XenseRobotics MCAP & robotics data visualizer — a browser-native viewer used inside **TacFlow** for MCAP, ROS bag, ROS 2 db3, HDF5, and BVH recordings. Built from scratch on React 19, Vite 8, and Web Workers.

Supports **MCAP**, **ROS 1 bag**, **ROS 2 db3**, **HDF5**, and **BVH** files. Available as a standalone SPA (zero-install, runs locally) or as an embeddable npm package within TacFlow / any React 19 host.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Embedding guide](docs/EMBEDDING.md) | Integrate `xense-mcap-viewer` into a React app (bundler, manifest, troubleshooting). Chinese: [EMBEDDING.zh.md](docs/EMBEDDING.zh.md). |
| [API reference](docs/API.md) | Public exports: `McapViewer` props, types, preferences, layout helpers, extensions. Chinese: [API.zh.md](docs/API.zh.md). |
| [Architecture](docs/ARCHITECTURE.md) | Requirements, design, and technical notes (SPA + npm). Chinese: [ARCHITECTURE.zh.md](docs/ARCHITECTURE.zh.md). |
| [Internals — runtime deep-dive](docs/internals/) | `ARCHITECTURE.md`, `RUNTIME_PIPELINE.md`, `THREADING_MODEL.md`, `DATAFLOW.md`, `PERFORMANCE.md`, `EXTENSION_GUIDE.md`, `IMPORTANT_FILES.md` |
| [Development](docs/DEVELOPMENT.md) | Local setup, tests, Playwright, fixtures. |
| [Release](docs/RELEASE.md) | Maintainer workflow: versioning, tags, npm & GitHub Releases. |
| [Contributing](CONTRIBUTING.md) | Branch workflow, commits, PR checklist. |
| [Security](SECURITY.md) | Supported versions and responsible disclosure. |
| [Docs index](docs/README.md) | Full map of all documentation files. |

**Simplified Chinese:** [README](README.zh.md) · [Embedding](docs/EMBEDDING.zh.md) · [API](docs/API.zh.md) · [Architecture](docs/ARCHITECTURE.zh.md)

---

## Features

- **Multi-format** — MCAP · ROS 1 `.bag` · ROS 2 `.db3` · HDF5 `.h5/.hdf5` · BVH skeletal animation
- **Zero-copy parsing** — dedicated Web Workers + Comlink + SharedArrayBuffer ring; main thread is never blocked
- **HTTP Range streaming** — load remote files without downloading them in full
- **Multi-panel layout** — draggable, dockable panels powered by DockView
- **Visualization panels** — Image (H.264), 3D (point clouds, URDF, TF), Plot (uPlot), Joints, Map, Audio, RawMessages, TopicGraph, Pose
- **Internationalization** — English · Simplified Chinese · Japanese
- **Dark / light / system** theme
- **Extension API** — register third-party sidebar tabs and playback-track overlay regions

---

## Quick Start (SPA)

Clone and run locally — no installation hosted demo required.

```bash
git clone https://github.com/Vertax42/xense-mcap-viewer.git
cd xense-mcap-viewer
npm install
npm run dev          # development server at http://localhost:5173
npm run build        # production SPA → dist/
```

You can deep-link directly to a file via URL parameters once the dev server is running:

```
http://localhost:5173/?url=https://your-server.com/recording.mcap
http://localhost:5173/?url=/examples/run.mcap
http://localhost:5173/?url=file://run.mcap
http://localhost:5173/?url=folder://MyDataset
http://localhost:5173/?url=https://your-server.com/recording.mcap&theme=dark&language=zh
```

Remote manifests and multiple URLs are supported via the `fileManifest` / `urls` props when embedding the npm package.

---

## Embedding (npm package — TacFlow integration)

### Installation

```bash
npm install xense-mcap-viewer
```

> **Peer dependencies**: React ≥ 19, react-dom ≥ 19, three, @react-three/fiber, and @react-three/drei must already be installed in your project.

### Import the stylesheet

```tsx
import 'xense-mcap-viewer/style.css';
```

### Basic usage

```tsx
import { McapViewer } from 'xense-mcap-viewer';

export function MyApp() {
  return (
    <McapViewer
      url="https://your-server.com/recording.mcap"
      theme="dark"
      language="en"
    />
  );
}
```

### Load local files

```tsx
import { McapViewer } from 'xense-mcap-viewer';

export function FileLoader() {
  const [file, setFile] = React.useState<File>();

  return (
    <>
      <input type="file" accept=".mcap,.bag,.db3,.h5,.hdf5,.bvh"
        onChange={e => setFile(e.target.files?.[0])} />
      {file && <McapViewer file={file} theme="system" />}
    </>
  );
}
```

### Multiple sources + remote manifest

```tsx
<McapViewer
  urls={['https://cdn.example.com/run1.mcap', 'https://cdn.example.com/run2.mcap']}
  fileManifest="https://cdn.example.com/manifest.json"
  theme="dark"
  language="zh"
  onFatalError={(err) => console.error('Fatal:', err)}
/>
```

**`manifest.json`** format:

```json
[
  { "url": "https://cdn.example.com/run1.mcap", "name": "Run 1", "sizeBytes": 1073741824 },
  { "url": "https://cdn.example.com/run2.mcap", "name": "Run 2", "durationSec": 120 }
]
```

---

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| MCAP | `.mcap` | ROS 2 / robotics standard; zstd and lz4 compression |
| ROS 1 bag | `.bag` | ROS 1 recording format |
| ROS 2 SQLite | `.db3` | ROS 2 default recording (via `@foxglove/sql.js` WASM) |
| HDF5 | `.h5`, `.hdf5` | Scientific data; partial read via `@ioai/hdf5` (WASM) |
| BVH | `.bvh` | Skeletal motion capture animation |

All formats are parsed entirely in the browser via Web Workers — no server-side processing required.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` / `→` | Step backward / forward one frame |
| `[` / `]` | Decrease / increase playback speed |
| `Home` | Jump to start |
| `End` | Jump to end |

---

## URL Parameters (SPA)

| Parameter | Example | Description |
|-----------|---------|-------------|
| `url` | `?url=https://…/file.mcap` or `?url=/examples/run.mcap` | Single remote file; updated on load/switch via `pushState` |
| `url` | `?url=file://name.mcap` | Local file locator (replay from Recent / IndexedDB handles) |
| `url` | `?url=folder://MyDataset` | Local folder locator (replay from Recent directory handle) |
| `theme` | `?theme=dark` | `light` · `dark` · `system` |
| `language` | `?language=zh` | `en` · `zh` · `ja` |

Multiple remote URLs or a remote manifest JSON URL are supported via the `urls` / `fileManifest` **props** when embedding the library, not via extra query keys in the standalone SPA.

---

## API Reference

See [docs/API.md](docs/API.md) for the complete component props, TypeScript types, utility functions, and advanced embedding patterns. Chinese: [docs/API.zh.md](docs/API.zh.md).

---

## Contributing

We welcome issues and pull requests! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting.

- **Bug reports** — use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml) template
- **Feature requests** — use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml) template
- **Security vulnerabilities** — see [SECURITY.md](SECURITY.md)

---

## License

[MIT](LICENSE) © 2026 XenseRobotics
