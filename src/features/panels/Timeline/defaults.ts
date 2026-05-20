export interface TimelineConfig {
  showDrops: boolean;
}

export const defaultTimelineConfig = (): TimelineConfig => ({
  showDrops: true,
});
