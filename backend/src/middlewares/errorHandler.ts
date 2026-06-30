import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
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
