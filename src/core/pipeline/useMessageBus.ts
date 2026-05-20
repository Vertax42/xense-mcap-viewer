import { useSyncExternalStore } from 'react';
import { messageBus } from './messageBus';

/** Subscribe only to the seq counter for a single topic. */
export function useTopicSeq(topic: string): number {
  return useSyncExternalStore(
    (cb) => messageBus.subscribeTopic(topic, cb),
    () => messageBus.getTopicSeq(topic),
    () => 0,
  );
}

/** Subscribe only to the seq counter for a single subscriber id. */
export function useSubscriberSeq(subscriberId: string): number {
  return useSyncExternalStore(
    (cb) => messageBus.subscribeToMessages(subscriberId, cb),
    () => messageBus.getSubscriberSeq(subscriberId),
    () => 0,
  );
}
