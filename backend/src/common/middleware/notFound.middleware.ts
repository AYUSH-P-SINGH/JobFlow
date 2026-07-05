import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/errors.js';

export const notFoundMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};
