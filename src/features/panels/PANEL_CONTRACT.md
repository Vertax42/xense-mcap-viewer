# Xense MCAP Viewer Panel Contract

## Goals

- Each panel lives in an isolated directory under `src/features/panels`.
- A panel crash must not break sibling panels.
- Every panel instance has a unique ID like `3D!a1b2c3` (Foxglove-compatible: `${PanelType}!${hash}`).
- Layout export/import must restore both dock arrangement and panel settings, and be compatible with Foxglove Studio layout JSON (`layout + configById + globalVariables + userNodes`).
- The framework provides a consistent "Settings" surface in the Sidebar; panels only contribute a renderer.

## Required files per panel

- `index.ts`: export the panel definition and the public config type.
- `defaults.ts`: define `<Panel>Config` interface and `default<Panel>Config()`.
- `schema.ts`: tolerant `parse<Panel>Config(input)` used for persist/restore.
- `definition.tsx`: panel metadata (`type`, `defaultTitle`, `configSchema`), the renderer, and an optional settings editor.
- `foxgloveAdapter.ts`: bi-directional mapping between Foxglove `configById[id]` JSON and our typed config.

## Definition requirements

```ts
interface PanelDefinition<TConfig> {
  type: PanelType;
  defaultTitle: string;
  createDefaultConfig: () => TConfig;
  configSchema: { version: number; parse(input: unknown): TConfig };
  render(props: PanelRenderProps<TConfig>): React.ReactNode;
  renderSettings?(ctx: PanelSettingsContext<TConfig>): React.ReactNode;
}
```

- `render` receives `{ player, panelId, panelTitle, config, setConfig, resetPanel }`.
- `renderSettings` is optional. When present, the tab header shows a gear icon that opens the Sidebar "Settings" tab for this panel.

## Settings context

Panels author any React UI they want as long as they honour the context:

```ts
interface PanelSettingsContext<TConfig> {
  panelId: string;
  panelTitle: string;
  config: TConfig;
  setConfig: (next: TConfig | ((prev: TConfig) => TConfig)) => void;
  player: Player;
  topics: ReadonlyArray<TopicInfo>;
  resetPanel: () => void;
  duplicatePanel: () => void;
  closePanel: () => void;
  copyPanelId: () => void;
  extras?: Readonly<Record<string, unknown>>;  // Foxglove round-trip data (read-only)
}
```

A reusable form kit ships under `framework/settings`:

| Component | Purpose |
|---|---|
| `SettingsSection` | Collapsible group with title/description |
| `SettingsField` | Label + help text + slot for any control |
| `SettingsText` / `SettingsTextArea` | Text input |
| `SettingsNumber` | Numeric input with min/max/step |
| `SettingsSelect<T>` | Typed dropdown |
| `SettingsSwitch` | Boolean checkbox |
| `TopicAutocomplete` | ROS topic picker (Popover + Command); same UI as `TopicQuickPicker`, filtered by type/name |
| `UrlInput` | Styled URL input |
| `FileInput` | Hidden `<input type=file>` + button, reads as text |

Panels may bring their own components instead.

## Runtime rules

- Panel rendering goes through `PanelRuntimeShell` which seeds the config store and registers tab-header actions.
- Each panel is wrapped by `PanelErrorBoundary`.
- Standardised tab-header actions:
  - Gear icon → opens Sidebar `Settings` tab (only when `renderSettings` is provided)
  - `⋮` menu → `Reset panel`, `Copy panel ID`, `Duplicate panel`, `Close`

## State and export rules

- `panelId` is the canonical runtime identity and encodes the Foxglove type via `${type}!${hash}`.
- `panelId` must be used as `subscriberId` for player subscriptions.
- Config is owned by the shared `panelConfigStore` (live, observable via `usePanelConfig`).
- Export format is Foxglove-compatible `LayoutData`:
  - `layout`: `MosaicNode<PanelId>` binary tree.
  - `configById`: per-panel config keyed by panel id (`foxglovePanelTitle` preserved).
  - `globalVariables`, `userNodes`.
  - Optional `__xense.tabGroups`: private field for round-tripping DockView tab groups.
- `<Panel>/foxgloveAdapter.ts` performs the mapping between Foxglove `PanelConfig` and our typed `{ config, extras, title }` triple.

## Best-effort import behavior

- Unknown panel types degrade to `Unavailable` panel. The original config is retained verbatim in `extras` so re-export is lossless.
- Valid panels are restored with parsed config.
- Invalid entries are skipped without blocking the full import.

## Example: 3D panel URDF source (demo adopter)

The 3D panel's `ThreeDConfig.urdf` lets the user choose where URDF comes from:

```ts
interface UrdfSource {
  sourceType: 'topic' | 'url' | 'file';
  topic: string;        // '' ⇒ auto-detect topic whose name contains `robot_description`
  url: string;          // fetched via `fetch()` with AbortController
  fileContent: string;  // inline XML from the FileInput control
}
```

See [`ThreeD/definition.tsx`](ThreeD/definition.tsx) for the settings UI built with the form kit.
