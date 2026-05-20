// ============================================================================
// xense-mcap-viewer — Public API (v0.0.1)
// ============================================================================
// Only symbols exported here are part of the stable public contract and
// subject to semver guarantees. Internal modules may change without notice.
// ============================================================================

// Import global styles for library consumers (Tailwind + scoped tokens).
import '../index.css';

// ---------------------------------------------------------------------------
// Main viewer component
// ---------------------------------------------------------------------------
export { McapViewer } from '../features/viewer/McapViewer';
export type { McapViewerProps } from '../features/viewer/McapViewer';

// ---------------------------------------------------------------------------
// Provider + theme hook
// (wrap your own UI within the Xense MCAP Viewer theme/intl context)
// ---------------------------------------------------------------------------
export { McapViewerProvider, useMcapViewerTheme } from '../features/viewer/McapViewerProvider';
export type { McapViewerProviderProps } from '../features/viewer/McapViewerProvider';

// ---------------------------------------------------------------------------
// Preference types and read/write utilities
// (for host apps that manage persistence externally)
// ---------------------------------------------------------------------------
export type {
  PreferencePersistence,
  McapViewerLanguageCode,
  McapViewerPersistedTheme,
  McapViewerUiTheme,
} from '../core/preferences/types';
export { readPreferences, writePreferences } from '../core/preferences/readWritePreferences';
export {
  MCAP_VIEWER_LAYOUT_STORAGE_KEY,
  MCAP_VIEWER_PREFERENCES_STORAGE_KEY,
} from '../core/preferences/storageKeys';

// ---------------------------------------------------------------------------
// Dataset / source utilities
// (build custom dataset pickers or remote list manifests)
// ---------------------------------------------------------------------------
export type { DatasetItem, FileListItem } from '../shared/utils/datasetSources';
export {
  parseRemoteDatasetListJson,
  datasetItemsFromListItems,
} from '../shared/utils/datasetSources';

// ---------------------------------------------------------------------------
// Layout persistence utilities
// (save/restore the panel layout to localStorage or custom storage)
// ---------------------------------------------------------------------------
export {
  clearSavedDockviewLayout,
  readSavedDockviewLayout,
  saveDockviewLayoutToStorage,
} from '../core/preferences/layoutStorage';

// ---------------------------------------------------------------------------
// Foxglove layout interop
// (import/export Foxglove Studio-compatible layouts for cross-tool compatibility)
// ---------------------------------------------------------------------------
export {
  importFoxgloveLayout,
  buildFoxgloveLayout,
  parseFoxgloveLayout,
} from '../core/preferences/foxgloveLayout';
export type {
  FoxgloveLayoutData,
  ImportFoxgloveLayoutResult,
} from '../core/preferences/foxgloveLayout';
export {
  exportDockviewLayout,
  importDockviewLayout,
  openDockviewPanel,
} from '../features/layout/dockviewController';

// ---------------------------------------------------------------------------
// Extension API
// (third-party sidebar / playback overlay contributions)
// ---------------------------------------------------------------------------
export type {
  MessageAccessApi,
  PlaybackControlsApi,
  PlaybackOverlayContribution,
  PlaybackSnapshot,
  McapViewerExtension,
  McapViewerExtensionContext,
  SidebarTabContribution,
  TimelineApi,
  TimelineOverlayContribution,
} from '../core/extensions/types';
export type { GetMessagesInTimeRangeArgs } from '../core/types/player';

// ---------------------------------------------------------------------------
// Core ROS / player types
// (for typed message consumers via useMessagePipeline)
// ---------------------------------------------------------------------------
export type {
  Time,
  TimeRange,
  MessageEvent,
  TopicInfo,
  TopicStats,
  PlayerProblem,
} from '../core/types/ros';
export type {
  PlayerPresence,
  PlayerState,
  Subscription,
} from '../core/types/player';

// ---------------------------------------------------------------------------
// Advanced: MessagePipeline hook
// (subscribe to playback state and decoded messages from within custom panels)
// ---------------------------------------------------------------------------
export { useMessagePipeline } from '../core/pipeline/useMessagePipeline';
