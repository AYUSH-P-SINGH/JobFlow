import { AsyncLocalStorage } from 'async_hooks';

export interface TracingContext {
  correlationId: string;
}

export const tracingStorage = new AsyncLocalStorage<TracingContext>();

/**
 * Retrieves the current correlation ID from AsyncLocalStorage context.
 */
export function getCorrelationId(): string | undefined {
  return tracingStorage.getStore()?.correlationId;
}

/**
 * Runs a function within the context of a correlation ID.
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return tracingStorage.run({ correlationId }, fn);
}
