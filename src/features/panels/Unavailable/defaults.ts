export interface UnavailableConfig {
  originalType: string;
  reason: string;
}

export const defaultUnavailableConfig = (): UnavailableConfig => ({
  originalType: 'Unknown',
  reason: 'Panel definition is not available in current build.',
});
