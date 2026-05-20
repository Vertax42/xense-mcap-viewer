# Embedding Guide — xense-mcap-viewer

> Simplified Chinese: [EMBEDDING.zh.md](EMBEDDING.zh.md)

This guide walks through integrating Xense MCAP Viewer as an embeddable React component into your own application.

---

## Prerequisites

- React ≥ 19 and react-dom ≥ 19
- A bundler that supports ES modules and Web Workers (Vite recommended; Webpack 5+ works with configuration)
- Node.js ≥ 22 (matches `engines` in `package.json`; CI uses Node 24)

---

## Installation

```bash
npm install @xense-robotics/mcap-viewer
```

---

## Step 1 — Import the stylesheet

The component requires its bundled CSS. Import it once at your application root:

```tsx
// main.tsx or App.tsx (top-level entry point)
import '@xense-robotics/mcap-viewer/style.css';
```

---

## Step 2 — Basic usage

```tsx
import { McapViewer } from '@xense-robotics/mcap-viewer';

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <McapViewer
        url="https://cdn.example.com/recording.mcap"
        theme="dark"
        language="en"
      />
    </div>
  );
}
```

The component defaults to `height: 100vh`. Use the `className` or `style` props to constrain its dimensions when embedding within a larger page.

By default `urlState` is `'off'`: the viewer does **not** call `history.pushState` or interpret `file://` / `folder://` in the `url` prop as restorable locators. Use `urlState="spa"` only if you are building a full-page app that owns the address bar (same behavior as the standalone site).

---

## Step 3 — Local file picker

```tsx
import React from 'react';
import { McapViewer } from '@xense-robotics/mcap-viewer';

export function FileViewer() {
  const [file, setFile] = React.useState<File>();

  return (
    <div style={{ height: '100vh' }}>
      {!file && (
        <input
          type="file"
          accept=".mcap,.bag,.db3,.h5,.hdf5,.bvh"
          onChange={e => setFile(e.target.files?.[0])}
        />
      )}
      {file && (
        <McapViewer
          file={file}
          theme="system"
          onFatalError={err => alert(`Failed to load: ${err.message}`)}
        />
      )}
    </div>
  );
}
```

---

## Step 4 — Remote dataset manifest

For data portals or review dashboards with many recordings, serve a JSON manifest:

```json
[
  {
    "url": "https://cdn.example.com/session_001.mcap",
    "name": "Session 001 — Parking lot",
    "sizeBytes": 2147483648,
    "durationSec": 180,
    "topicCount": 24
  },
  {
    "url": "https://cdn.example.com/session_002.mcap",
    "name": "Session 002 — Highway",
    "sizeBytes": 1073741824,
    "durationSec": 90
  }
]
```

Then pass the manifest URL:

```tsx
<McapViewer
  fileManifest="https://cdn.example.com/manifest.json"
  theme="dark"
/>
```

Or pass the parsed rows directly (if you already fetched and filtered them):

```tsx
import { parseRemoteDatasetListJson } from '@xense-robotics/mcap-viewer';

const res = await fetch('/api/datasets');
const rows = parseRemoteDatasetListJson(await res.json());

<McapViewer fileManifest={rows} />
```

---

## Advanced: Controlled theme & language

Disable internal localStorage persistence and fully control state from your application:

```tsx
import { McapViewer } from '@xense-robotics/mcap-viewer';
import { readPreferences, writePreferences } from '@xense-robotics/mcap-viewer';

function ControlledViewer() {
  const saved = readPreferences();
  const [theme, setTheme] = React.useState(saved?.theme ?? 'system');
  const [lang, setLang]   = React.useState(saved?.language ?? 'en');

  const handleThemeChange = (t: typeof theme) => {
    setTheme(t);
    writePreferences({ theme: t !== 'system' ? t : undefined });
  };

  return (
    <McapViewer
      url="https://cdn.example.com/recording.mcap"
      theme={theme}
      language={lang}
      preferencePersistence="off"
      onThemeChange={handleThemeChange}
      onLanguageChange={setLang}
    />
  );
}
```

---

## Advanced: Foxglove layout migration

If your team uses Foxglove Studio layouts, you can import them directly:

```tsx
import { importFoxgloveLayout } from '@xense-robotics/mcap-viewer';

// layout is the JSON object from a .json Foxglove layout file
const result = importFoxgloveLayout(layout);
if (result.success) {
  console.log('Imported panels:', result.panelCount);
} else {
  console.warn('Import failed:', result.error);
}
```

---

## Advanced: Custom annotation workflow

```tsx
import { McapViewer, useAnnotationController } from '@xense-robotics/mcap-viewer';

function AnnotationApp() {
  const controller = useAnnotationController({
    dictionary: {
      skills: [
        { id: 'pick', label: 'Pick object' },
        { id: 'place', label: 'Place object' },
      ],
    },
    onAnnotationsChange: ({ annotations }) => {
      console.log('Updated annotations:', annotations.length);
    },
    onExport: async (payload) => {
      await fetch('/api/annotations', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  return (
    <McapViewer
      url="https://cdn.example.com/recording.mcap"
      theme="dark"
    />
  );
}
```

---

## Bundler configuration

### Vite (recommended)

No special configuration needed. Worker imports (`?worker`) are handled by Vite automatically.

```ts
// vite.config.ts — no Xense MCAP Viewer-specific config required
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

### Webpack 5

Enable WebAssembly and Worker support:

```js
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
};
```

---

## Troubleshooting

### "SharedArrayBuffer is not defined"

Some WASM decoders (bz2, lz4) benefit from `SharedArrayBuffer`. Your server must send the following headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The component works without these headers; affected decoders fall back to non-shared memory.

### "Failed to load: ..." with remote files

Remote files must be served with CORS headers that allow your application's origin:

```
Access-Control-Allow-Origin: https://your-app.example.com
```

### Large files load slowly

- Ensure the server supports **HTTP Range requests** (`Accept-Ranges: bytes`).
- Files without Range support are downloaded in full before playback can start.

### Worker errors in Firefox

Firefox has stricter CSP enforcement for workers. If you use a `Content-Security-Policy` header, add `worker-src 'self' blob:`.

---

## TypeScript support

The package ships full TypeScript declarations. Import types directly:

```ts
import type {
  McapViewerProps,
  FileListItem,
  PreferencePersistence,
} from '@xense-robotics/mcap-viewer';
```

---

## Host extensions and business logic

`@xense-robotics/mcap-viewer` ships **no** product-specific annotation, QC rules, or persistence. Host applications should:

1. Pass opaque `hostContext` on `McapViewer` (for example `{ datasetId, canAnnotate }`) and read `context.hostContext` inside `extensions`.
2. Implement sidebar tabs and `playbackOverlays` / `timelineOverlays` using `context.playback`, `context.timeline`, and optionally `context.messages.getMessagesInTimeRange`.
3. Keep all REST calls, permissions, and domain models in the host app.

