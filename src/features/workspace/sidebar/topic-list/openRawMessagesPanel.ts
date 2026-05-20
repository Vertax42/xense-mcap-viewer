import { getDockviewApi } from '@/features/layout/dockviewGlobalApi';
import { openDockviewPanel } from '@/features/layout/dockviewController';
import { listPanelStates } from '@/features/panels/framework';

export function openRawMessagesPanel(topicName: string): string | null {
  const api = getDockviewApi();
  if (!api) {
    return null;
  }

  const existing = Object.values(listPanelStates()).find((panel) => {
    const panelTopic = (panel.config as { topic?: string } | undefined)?.topic;
    return panel.type === 'RawMessages' && panelTopic === topicName;
  });

  if (existing && api.getPanel(existing.id)) {
    api.getPanel(existing.id)?.api.setActive();
    return existing.id;
  }

  const safeTitle = topicName.split('/').pop() || topicName;
  return openDockviewPanel({
    type: 'RawMessages',
    title: safeTitle,
    config: { topic: topicName },
  });
}
