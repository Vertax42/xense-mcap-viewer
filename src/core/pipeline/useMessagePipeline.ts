import { useMessagePipelineStore } from './store';
import type { MessagePipelineState } from './store';

export function useMessagePipeline<T>(
  selector: (state: MessagePipelineState) => T,
): T {
  return useMessagePipelineStore(selector);
}
