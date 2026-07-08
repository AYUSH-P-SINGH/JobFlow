import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { runWithCorrelationId } from '../tracing/context.js';

/**
 * Middleware to extract or generate correlation ID and run the request in its context.
 */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  res.setHeader('X-Correlation-ID', correlationId);
  runWithCorrelationId(correlationId, () => {
    next();
  });
}
