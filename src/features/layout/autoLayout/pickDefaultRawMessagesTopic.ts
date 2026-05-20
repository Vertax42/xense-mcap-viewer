import type { TopicInfo } from '@/core/types/ros';
import { isJointStateSchema, isRosImageSchema } from '@/shared/ros/rosMessageTypes';

interface PickDefaultRawMessagesTopicOptions {
  excludeTopics?: ReadonlySet<string>;
}

export function pickDefaultRawMessagesTopic(
  topics: ReadonlyArray<TopicInfo>,
  options?: PickDefaultRawMessagesTopicOptions,
): string {
  const excludeTopics = options?.excludeTopics;
  const available = topics.filter((topic) => !excludeTopics?.has(topic.name));
  const firstJointState = available.find((topic) => isJointStateSchema(topic.type));
  if (firstJointState) {
    return firstJointState.name;
  }
  const firstNonImage = available.find((topic) => !isRosImageSchema(topic.type));
  if (firstNonImage) {
    return firstNonImage.name;
  }
  return available[0]?.name ?? topics[0]?.name ?? '';
}
