export function resolveStepMsFromModifiers(input: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): number {
  if (input.ctrlKey || input.metaKey) return 100;
  if (input.altKey) return 33;
  return 10;
}
