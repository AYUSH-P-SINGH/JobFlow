import { logger } from '../../common/logger/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before tripping
  cooldownPeriod?: number;   // Time in ms before trying again (OPEN -> HALF_OPEN)
}

export class CircuitBreakerOpenException extends Error {
  constructor(name: string) {
    super(`Circuit breaker is OPEN for: ${name}. Execution blocked to protect resources.`);
    this.name = 'CircuitBreakerOpenException';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;

  private failureThreshold: number;
  private cooldownPeriod: number;

  constructor(public readonly name: string, options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownPeriod = options?.cooldownPeriod ?? 10000; // 10 seconds default
  }

  /**
   * Returns the current state of the circuit breaker.
   */
  public getState(): CircuitState {
    this.checkCooldown();
    return this.state;
  }

  /**
   * Executes a callback function wrapped inside the circuit breaker.
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkCooldown();

    if (this.state === 'OPEN') {
      logger.warn(`[CircuitBreaker: ${this.name}] Blocked call because circuit is OPEN`);
      throw new CircuitBreakerOpenException(this.name);
    }

    try {
      logger.debug(`[CircuitBreaker: ${this.name}] Executing call in state ${this.state}`);
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Transitions state to CLOSED on successful execution.
   */
  private onSuccess(): void {
    if (this.state !== 'CLOSED') {
      logger.info(`[CircuitBreaker: ${this.name}] Circuit recovered! Transitioning to CLOSED.`);
      this.state = 'CLOSED';
      this.failureCount = 0;
    }
  }

  /**
   * Handles execution failure, updating failure count and tripping if necessary.
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`[CircuitBreaker: ${this.name}] Failure detected (${this.failureCount}/${this.failureThreshold}): ${error.message}`);

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      logger.error(`[CircuitBreaker: ${this.name}] Trip limit reached! Transitioning to OPEN.`);
      this.state = 'OPEN';
    }
  }

  /**
   * Checks if the cooldown period has elapsed, transitioning from OPEN to HALF_OPEN.
   */
  private checkCooldown(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.cooldownPeriod) {
        logger.info(`[CircuitBreaker: ${this.name}] Cooldown elapsed. Transitioning from OPEN to HALF_OPEN.`);
        this.state = 'HALF_OPEN';
      }
    }
  }
}
