import { create } from 'zustand';
import type { DataQualityIssueType, DataQualitySeverity } from '@/core/types/ros';

export type SidebarTabId = string;

export type QualityFilter = {
  type?: DataQualityIssueType;
  topic?: string;
  severity?: DataQualitySeverity | 'all';
  query?: string;
};

interface SidebarState {
  tab: SidebarTabId;
  /** `panelId` whose settings are shown in the Settings tab (follows DockView's active panel). */
  activePanelId: string | null;
  qualityFilter?: QualityFilter;
  setTab: (tab: SidebarTabId) => void;
  setActivePanelId: (panelId: string | null) => void;
  setQualityFilter: (filter: QualityFilter | undefined) => void;
  openQuality: (filter?: QualityFilter) => void;
  /** Convenience: switch to the Settings tab and set `activePanelId` in one go. */
  openSettingsFor: (panelId: string) => void;
}

/**
 * Global UI store for the left Sidebar. Hoisted out of `Sidebar.tsx` so that
 * - the panel tab header's gear button can call `openSettingsFor(panelId)`;
 * - DockView's "active panel changed" event can seed `activePanelId` without
 *   drilling a React prop through every layer.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  tab: 'topics',
  activePanelId: null,
  qualityFilter: undefined,
  setTab: (tab) => set({ tab }),
  setActivePanelId: (panelId) => set({ activePanelId: panelId }),
  setQualityFilter: (qualityFilter) => set({ qualityFilter }),
  openQuality: (qualityFilter) => set({ tab: 'quality', qualityFilter }),
  openSettingsFor: (panelId) => set({ tab: 'settings', activePanelId: panelId }),
}));
