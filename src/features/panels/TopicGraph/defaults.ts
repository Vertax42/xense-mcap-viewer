export interface TopicGraphConfig {
  rankDir: 'TB' | 'LR';
  showControls: boolean;
}

export const defaultTopicGraphConfig = (): TopicGraphConfig => ({
  rankDir: 'LR',
  showControls: true,
});
