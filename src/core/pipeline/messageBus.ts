import type { MessageEvent } from '@/core/types/ros';

/**
 * MessageBus keeps message state out of Zustand so that the per-tick fan-out is
 * O(changed topics + changed subscribers) instead of O(all topics + all panels).
 *
 * Design notes:
 * - The Maps are mutated in place; per-tick we only increment the version
 *   counters for the topics/subscribers that actually changed.
 * - Each topic and each subscriberId has its own listener set. Only the exact
 *   listeners that care about the changed keys are notified.
 * - Hooks consume this through `useSyncExternalStore` in `useMessageBus.ts`.
 */
class MessageBus {
  #lastMessageByTopic: Map<string, MessageEvent> = new Map();
  #messagesBySubscriber: Map<string, MessageEvent[]> = new Map();
  #topicSeq: Map<string, number> = new Map();
  #subscriberSeq: Map<string, number> = new Map();

  #topicListeners: Map<string, Set<() => void>> = new Map();
  #subscriberListeners: Map<string, Set<() => void>> = new Map();

  update(
    batchBySubscriber: Map<string, MessageEvent[]>,
    lastByTopic: Map<string, MessageEvent>,
  ): void {
    if (batchBySubscriber.size === 0 && lastByTopic.size === 0) {
      return;
    }

    for (const [id, events] of batchBySubscriber) {
      this.#messagesBySubscriber.set(id, events);
      this.#subscriberSeq.set(id, (this.#subscriberSeq.get(id) ?? 0) + 1);
    }
    for (const [topic, evt] of lastByTopic) {
      this.#lastMessageByTopic.set(topic, evt);
      this.#topicSeq.set(topic, (this.#topicSeq.get(topic) ?? 0) + 1);
    }

    for (const topic of lastByTopic.keys()) {
      const set = this.#topicListeners.get(topic);
      if (!set) continue;
      for (const listener of set) listener();
    }
    for (const id of batchBySubscriber.keys()) {
      const set = this.#subscriberListeners.get(id);
      if (!set) continue;
      for (const listener of set) listener();
    }
  }

  reset(): void {
    this.#lastMessageByTopic.clear();
    this.#messagesBySubscriber.clear();
    this.#topicSeq.clear();
    this.#subscriberSeq.clear();

    for (const set of this.#topicListeners.values()) {
      for (const listener of set) listener();
    }
    for (const set of this.#subscriberListeners.values()) {
      for (const listener of set) listener();
    }
  }

  getTopicSeq(topic: string): number {
    return this.#topicSeq.get(topic) ?? 0;
  }

  getSubscriberSeq(subscriberId: string): number {
    return this.#subscriberSeq.get(subscriberId) ?? 0;
  }

  getLastMessage(topic: string): MessageEvent | null {
    return this.#lastMessageByTopic.get(topic) ?? null;
  }

  getSubscriberMessages(subscriberId: string): MessageEvent[] | null {
    return this.#messagesBySubscriber.get(subscriberId) ?? null;
  }

  subscribeTopic(topic: string, cb: () => void): () => void {
    let set = this.#topicListeners.get(topic);
    if (!set) {
      set = new Set();
      this.#topicListeners.set(topic, set);
    }
    set.add(cb);
    return () => {
      const current = this.#topicListeners.get(topic);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.#topicListeners.delete(topic);
    };
  }

  /** Subscribe to batched message deliveries for a specific subscriber ID. */
  subscribeToMessages(subscriberId: string, cb: () => void): () => void {
    let set = this.#subscriberListeners.get(subscriberId);
    if (!set) {
      set = new Set();
      this.#subscriberListeners.set(subscriberId, set);
    }
    set.add(cb);
    return () => {
      const current = this.#subscriberListeners.get(subscriberId);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.#subscriberListeners.delete(subscriberId);
    };
  }
}

export const messageBus = new MessageBus();
