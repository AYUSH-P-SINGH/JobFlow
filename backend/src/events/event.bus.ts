import { EventEmitter } from 'events';
import { EventType, EventMap } from './event.types.js';

/**
 * Type-safe in-process Event Bus utilizing Node.js EventEmitter.
 */
export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publishes an event to all active subscribers.
   */
  public publish<T extends EventType>(event: T, payload: EventMap[T]): void {
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribes to a type-safe event.
   * Returns an unsubscribe function to clean up listeners.
   */
  public subscribe<T extends EventType>(
    event: T,
    handler: (payload: EventMap[T]) => void | Promise<void>
  ): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }
}

export const eventBus = EventBus.getInstance();
