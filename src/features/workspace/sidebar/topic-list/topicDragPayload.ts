export const TOPIC_DRAG_MIME = 'application/x-rosview-topic';

export type TopicDragPayload = {
  name: string;
  type: string;
};

export function writeTopicDragPayload(dataTransfer: DataTransfer, payload: TopicDragPayload): void {
  dataTransfer.setData(TOPIC_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.setData('text/plain', payload.name);
  dataTransfer.effectAllowed = 'copy';
}

export function readTopicDragPayload(dataTransfer: DataTransfer): TopicDragPayload | null {
  const raw = dataTransfer.getData(TOPIC_DRAG_MIME);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as TopicDragPayload).name === 'string' &&
      typeof (parsed as TopicDragPayload).type === 'string'
    ) {
      const payload = parsed as TopicDragPayload;
      return { name: payload.name, type: payload.type };
    }
  } catch {
    // Ignore invalid payloads from stale sessions or external sources.
  }
  return null;
}

export function hasTopicDragPayload(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(TOPIC_DRAG_MIME);
}
