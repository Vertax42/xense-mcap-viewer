# Xense MCAP Viewer

[English README](README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> XenseRobotics 出品的浏览器原生机器人数据可视化工具 —— **TacFlow** 数据处理管线下的可视化组件，用于 MCAP、ROS bag、ROS 2 db3、HDF5、BVH 等格式数据的浏览与回放。基于 React 19、Vite 8、Web Workers 从零构建。

支持 **MCAP**、**ROS 1 bag**、**ROS 2 db3**、**HDF5** 与 **BVH** 文件。可作为独立 SPA（零安装，本地启动）或作为可嵌入 npm 包集成进 TacFlow / 任意 React 19 宿主使用。

---

## 文档

| 文档 | 说明 |
|------|------|
| [嵌入指南（中文）](docs/EMBEDDING.zh.md) | 将 `xense-mcap-viewer` 集成到 React 应用（打包器、清单、排错）。 |
| [API 参考（中文）](docs/API.zh.md) | 公开导出：`McapViewer` props、类型、偏好、布局工具、扩展。 |
| [架构（英文）](docs/ARCHITECTURE.md) | 需求、设计与技术说明（SPA + npm）；[中文版](docs/ARCHITECTURE.zh.md)。 |
| [Internals 深入文档](docs/internals/) | `ARCHITECTURE.md` / `RUNTIME_PIPELINE.md` / `THREADING_MODEL.md` / `DATAFLOW.md` / `PERFORMANCE.md` / `EXTENSION_GUIDE.md` / `IMPORTANT_FILES.md` |
| [开发（英文）](docs/DEVELOPMENT.md) | 本地环境、测试、Playwright、fixture。 |
| [发版（英文）](docs/RELEASE.md) | 维护者流程：版本号、tag、npm 与 GitHub Release。 |
| [贡献指南](CONTRIBUTING.md) | 分支流程、提交规范、PR 自检。 |
| [安全策略](SECURITY.md) | 支持版本与负责任披露。 |
| [文档索引（英文）](docs/README.md) | 全部文档路径一览。 |

**English:** [README](README.md) · [Embedding](docs/EMBEDDING.md) · [API](docs/API.md) · [Architecture](docs/ARCHITECTURE.md)

---

## 功能特性

- **多格式** — MCAP · ROS 1 `.bag` · ROS 2 `.db3` · HDF5 `.h5/.hdf5` · BVH 骨骼动画
- **Worker 解析** — 专用 Web Worker + Comlink + SharedArrayBuffer 环；主线程不被阻塞
- **HTTP Range 流式加载** — 无需整文件下载即可开始回放
- **多面板布局** — 基于 DockView 的可拖拽、可停靠面板
- **可视化面板** — 图像（H.264）、3D（点云、URDF、TF）、Plot（uPlot）、关节、地图、音频、RawMessages、TopicGraph、位姿
- **Foxglove 布局兼容** — 导入 / 导出 Foxglove Studio 布局
- **国际化** — English · 简体中文 · 日本語
- **明 / 暗 / 跟随系统** 主题
- **扩展 API** — 注册第三方侧边栏 Tab 与播放条上方叠加区域

---

## 快速开始（SPA）

克隆仓库本地启动：

```bash
git clone https://github.com/Vertax42/xense-mcap-viewer.git
cd xense-mcap-viewer
npm install
npm run dev          # 开发服务器位于 http://localhost:5173
npm run build        # 生产 SPA 构建 → dist/
```

启动后可通过 URL 参数直达文件：

```
http://localhost:5173/?url=https://your-server.com/recording.mcap
http://localhost:5173/?url=/examples/run.mcap
http://localhost:5173/?url=file://run.mcap
http://localhost:5173/?url=folder://MyDataset
http://localhost:5173/?url=https://your-server.com/recording.mcap&theme=dark&language=zh
```

远程 manifest 与多 URL 请在 npm 集成时使用 `fileManifest` / `urls` props。

---

## 嵌入（npm 包 — TacFlow 集成）

### 安装

```bash
npm install xense-mcap-viewer
```

> **Peer dependencies**：你的项目需已安装 React ≥ 19、react-dom ≥ 19、three、@react-three/fiber、@react-three/drei。

### 引入样式

```tsx
import 'xense-mcap-viewer/style.css';
```

### 基础用法

```tsx
import { McapViewer } from 'xense-mcap-viewer';

export function MyApp() {
  return (
    <McapViewer
      url="https://your-server.com/recording.mcap"
      theme="dark"
      language="zh"
    />
  );
}
```

### 加载本地文件

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

### 多数据源 + 远程清单

```tsx
<McapViewer
  urls={['https://cdn.example.com/run1.mcap', 'https://cdn.example.com/run2.mcap']}
  fileManifest="https://cdn.example.com/manifest.json"
  theme="dark"
  language="zh"
  onFatalError={(err) => console.error('Fatal:', err)}
/>
```

`manifest.json` 格式：

```json
[
  { "url": "https://cdn.example.com/run1.mcap", "name": "Run 1", "sizeBytes": 1073741824 },
  { "url": "https://cdn.example.com/run2.mcap", "name": "Run 2", "durationSec": 120 }
]
```

---

## 支持的文件格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| MCAP | `.mcap` | ROS 2 / 机器人通用标准；支持 zstd 与 lz4 |
| ROS 1 bag | `.bag` | ROS 1 录制格式 |
| ROS 2 SQLite | `.db3` | ROS 2 默认录制格式（通过 `@foxglove/sql.js` WASM） |
| HDF5 | `.h5`, `.hdf5` | 科学数据格式；通过 `@ioai/hdf5`（WASM）部分读取 |
| BVH | `.bvh` | 骨骼动画动作捕捉格式 |

所有格式均完全在浏览器里通过 Web Worker 解析，**无需服务端处理**。

---

## 键盘快捷键

| 键 | 操作 |
|----|------|
| `空格` | 播放 / 暂停 |
| `← / →` | 上 / 下一帧 |
| `[ / ]` | 减 / 增速 |
| `Home` | 跳到起始 |
| `End` | 跳到结束 |

---

## URL 参数（SPA）

| 参数 | 示例 | 说明 |
|------|------|------|
| `url` | `?url=https://…/file.mcap` 或 `?url=/examples/run.mcap` | 单个远程文件；切换时 `pushState` 更新 |
| `url` | `?url=file://name.mcap` | 本地文件定位（从 Recent / IndexedDB 句柄恢复） |
| `url` | `?url=folder://MyDataset` | 本地目录定位 |
| `theme` | `?theme=dark` | `light` · `dark` · `system` |
| `language` | `?language=zh` | `en` · `zh` · `ja` |

多 URL 与远程清单仅在嵌入时通过 `urls` / `fileManifest` **props** 支持。

---

## License

[MIT](LICENSE) © 2026 XenseRobotics
