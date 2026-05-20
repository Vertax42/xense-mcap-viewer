import React, { useCallback, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Navbar } from '@/features/workspace/navbar/Navbar';
import { McapViewerContent } from '@/features/viewer/McapViewerContent';
import type { Player } from '@/core/types/player';
import type { DatasetItem } from '@/shared/utils/datasetSources';
import type { PreferencePersistence } from '@/core/preferences/types';
import type { SampleDataset } from '@/services/sampleDatasets';
import type { DatasetHistoryListItem } from '@/shared/utils/datasetHistory';
import type { McapViewerExtension } from '@/core/extensions/types';

import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { SampleDatasetDialog } from '@/features/workspace/common/SampleDatasetDialog';

interface AppShellProps {
  player: Player;
  loadingSourceName?: string;
  manualOpenHint?: string | null;
  sourceLoading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'zh' | 'ja';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onLanguageChange: (lang: 'en' | 'zh' | 'ja') => void;
  showLanguageSwitcher?: boolean;
  showThemeSwitcher?: boolean;
  onBrandClick?: () => void;
  preferAutoLayout?: boolean;
  preferencePersistence: PreferencePersistence;
  datasets: DatasetItem[];
  activeDatasetId?: string;
  onDatasetSelect: (id: string) => void;
  onAddFilesFromPicker: (files: FileList | null) => void;
  onOpenDirectory: () => void;
  onOpenFilePick: () => void;
  onOpenTarPick: () => void;
  onLocalTarSelected: (file: File) => void | Promise<void>;
  onOpenRemotePrompt: () => void;
  onSubmitRemoteUrl: (url: string) => void | Promise<void>;
  remoteSubmitLoading?: boolean;
  onSelectSample: (sample: SampleDataset) => void | Promise<void>;
  historyItems: DatasetHistoryListItem[];
  onReplayHistory: (id: string) => void | Promise<void>;
  onDropRosRecordingFiles: (files: File[], items?: DataTransferItemList) => void | Promise<void>;
  /** Optional third-party extension contributions. */
  extensions?: McapViewerExtension[];
  /** Opaque value forwarded to extension context (`hostContext`). */
  hostContext?: unknown;
}

export const AppShell: React.FC<AppShellProps> = ({
  player,
  loadingSourceName,
  manualOpenHint,
  sourceLoading = false,
  className,
  style,
  theme,
  language,
  onThemeChange,
  onLanguageChange,
  showLanguageSwitcher = true,
  showThemeSwitcher = true,
  onBrandClick,
  preferAutoLayout = false,
  preferencePersistence,
  datasets,
  activeDatasetId,
  onDatasetSelect,
  onAddFilesFromPicker,
  onOpenDirectory,
  onOpenFilePick,
  onOpenTarPick,
  onLocalTarSelected,
  onOpenRemotePrompt,
  onSubmitRemoteUrl,
  remoteSubmitLoading,
  onSelectSample,
  historyItems,
  onReplayHistory,
  onDropRosRecordingFiles,
  extensions,
  hostContext,
}) => {
  useKeyboardShortcuts(player);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) {
        return;
      }
      event.preventDefault();
      void onDropRosRecordingFiles(Array.from(event.dataTransfer.files), event.dataTransfer.items);
    },
    [onDropRosRecordingFiles],
  );

  return (
    <div
      className={cn('flex h-screen flex-col overflow-hidden bg-background text-foreground', className)}
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Navbar
        sourceName={loadingSourceName}
        sourceLoading={sourceLoading}
        theme={theme}
        language={language}
        onThemeChange={onThemeChange}
        onLanguageChange={onLanguageChange}
        showLanguageSwitcher={showLanguageSwitcher}
        showThemeSwitcher={showThemeSwitcher}
        onBrandClick={onBrandClick}
        onOpenFilePick={onOpenFilePick}
        onOpenDirectory={onOpenDirectory}
        onOpenTarPick={onOpenTarPick}
        onOpenRemotePrompt={onOpenRemotePrompt}
        onOpenSampleDialog={() => setSampleDialogOpen(true)}
        recentHistoryItems={historyItems.slice(0, 10)}
        onReplayHistory={onReplayHistory}
      />
      <McapViewerContent
        player={player}
        loadingSourceName={loadingSourceName}
        manualOpenHint={manualOpenHint}
        preferencePersistence={preferencePersistence}
        preferAutoLayout={preferAutoLayout}
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        onDatasetSelect={onDatasetSelect}
        onAddFilesFromPicker={onAddFilesFromPicker}
        onOpenDirectory={onOpenDirectory}
        onOpenFilePick={onOpenFilePick}
        onOpenTarPick={onOpenTarPick}
        onLocalTarSelected={onLocalTarSelected}
        onSubmitRemoteUrl={onSubmitRemoteUrl}
        remoteSubmitLoading={remoteSubmitLoading}
        onSelectSample={onSelectSample}
        onRequestChangeRemoteUrl={onOpenRemotePrompt}
        historyItems={historyItems}
        onReplayHistory={onReplayHistory}
        onDropRosRecordingFiles={onDropRosRecordingFiles}
        extensions={extensions}
        hostContext={hostContext}
        locale={language}
        theme={theme}
        activeDataset={datasets.find((item) => item.id === activeDatasetId)}
      />
      <SampleDatasetDialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen} onSelect={onSelectSample} />
    </div>
  );
};
