// Global operational and unexpected error handler middleware
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/errors.js';
import { logger } from '../logger/logger.js';
import { config } from '../../config/env.js';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      logger.warn(`Database unique constraint violation: [${req.method} ${req.path}] - ${err.message}`);
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }
  }

  if (err instanceof ZodError) {
    logger.warn(`Validation failure: [${req.method} ${req.path}] - ${JSON.stringify(err.issues)}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof AppError) {
    logger.warn(`Operational error: [${req.method} ${req.path}] - ${err.message} (${err.statusCode})`);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Non-operational or unexpected error
  logger.error(`Unexpected error: [${req.method} ${req.path}] - ${err.message}\nStack: ${err.stack}`);

  const message = config.nodeEnv === 'production'
    ? 'Something went wrong'
    : err.message;

  return res.status(500).json({
    success: false,
    message,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
};
