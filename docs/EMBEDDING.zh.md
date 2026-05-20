# 嵌入指南 — xense-mcap-viewer

> English: [EMBEDDING.md](EMBEDDING.md)

本指南说明如何将 Xense MCAP Viewer 作为可嵌入的 React 组件集成到你自己的应用中。

---

## 前置条件

- React ≥ 19 与 react-dom ≥ 19
- 支持 ES 模块与 Web Workers 的打包工具（推荐 Vite；Webpack 5+ 需适当配置）
- Node.js ≥ 22（与 `package.json` 中 `engines` 一致；CI 使用 Node 24）

---

## 安装

```bash
npm install @xense-robotics/mcap-viewer
```

---

## 步骤 1 — 引入样式表

组件依赖其打包后的 CSS。在应用根入口（如 `main.tsx` / `App.tsx`）中全局引入一次：

```tsx
// main.tsx 或 App.tsx（顶层入口）
import '@xense-robotics/mcap-viewer/style.css';
```

---

## 步骤 2 — 基本用法

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

组件默认高度为 `100vh`。嵌入到更大页面中时，请用 `className` 或 `style` 限制容器尺寸。

默认 `urlState` 为 `'off'`：组件**不会**调用 `history.pushState`，也不会把 `url` prop 中的 `file://` / `folder://` 当作可从 IndexedDB 恢复的定位符。仅当你构建与独立站点类似、独占地址栏的全页应用时，才使用 `urlState="spa"`。

---

## 步骤 3 — 本地文件选择

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

## 步骤 4 — 远程数据集清单

在数据门户或回放看板中，可提供 JSON manifest：

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

将 manifest 的 URL 传给 `fileManifest`：

```tsx
<McapViewer
  fileManifest="https://cdn.example.com/manifest.json"
  theme="dark"
/>
```

若你已在应用侧拉取并过滤好数据，可直接传入解析后的行数组：

```tsx
import { parseRemoteDatasetListJson } from '@xense-robotics/mcap-viewer';

const res = await fetch('/api/datasets');
const rows = parseRemoteDatasetListJson(await res.json());

<McapViewer fileManifest={rows} />
```

---

## 进阶：受控主题与语言

关闭组件内部的 localStorage 持久化，由宿主应用完全控制状态：

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

## 进阶：Foxglove 布局迁移

若团队使用 Foxglove Studio 布局，可直接导入：

```tsx
import { importFoxgloveLayout } from '@xense-robotics/mcap-viewer';

// layout 为 Foxglove 布局 .json 文件解析得到的对象
const result = importFoxgloveLayout(layout);
if (result.success) {
  console.log('Imported panels:', result.panelCount);
} else {
  console.warn('Import failed:', result.error);
}
```

---

## 进阶：自定义标注流程

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

## 打包工具配置

### Vite（推荐）

通常无需额外配置。Worker 导入（`?worker`）由 Vite 自动处理。

```ts
// vite.config.ts — 无需 Xense MCAP Viewer 专用配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

### Webpack 5

启用 WebAssembly 与 Worker 支持：

```js
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
};
```

---

## 故障排查

### "SharedArrayBuffer is not defined"

部分 WASM 解码器（bz2、lz4）在可用时会利用 `SharedArrayBuffer`。服务器需返回以下响应头：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

即使没有这些头，组件仍可工作；相关解码器会退回到非共享内存模式。

### 远程文件出现 "Failed to load: ..."

远程文件必须通过 CORS 允许你的应用来源，例如：

```
Access-Control-Allow-Origin: https://your-app.example.com
```

### 大文件加载慢

- 确认服务器支持 **HTTP Range**（`Accept-Ranges: bytes`）。
- 不支持 Range 时，往往需要整文件下载完成后才能开始回放。

### Firefox 中的 Worker 错误

Firefox 对 Worker 的 CSP 更严格。若使用 `Content-Security-Policy` 响应头，请添加 `worker-src 'self' blob:`。

---

## TypeScript 支持

包内提供完整类型声明，可直接导入类型：

```ts
import type {
  McapViewerProps,
  FileListItem,
  PreferencePersistence,
} from '@xense-robotics/mcap-viewer';
```

---

## 宿主扩展与业务逻辑

`@xense-robotics/mcap-viewer` **不包含**具体业务的标注、质检规则或持久化。宿主应用应：

1. 在 `McapViewer` 上传入不透明 `hostContext`（例如 `{ datasetId, canAnnotate }`），在扩展里通过 `context.hostContext` 读取。
2. 使用 `extensions` 实现侧边栏与 `playbackOverlays` / `timelineOverlays`，并结合 `context.playback`、`context.timeline`、`context.messages`。
3. 将所有 REST、权限与领域模型保留在宿主应用内。

