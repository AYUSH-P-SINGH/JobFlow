import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../../modules/auth/auth.repository.js';
import { UnauthorizedError } from '../errors/errors.js';
import { logger } from '../logger/logger.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Unauthorized Access: Missing or malformed Authorization header on ${req.method} ${req.path}`);
      throw new UnauthorizedError('Access token is missing or invalid');
    }

    const token = authHeader.split(' ')[1];

    let decoded: any;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      logger.warn(`Unauthorized Access: Invalid token signature/expiry on ${req.method} ${req.path}`);
      throw new UnauthorizedError('Access token is invalid or expired');
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      logger.warn(`Unauthorized Access: User ID ${decoded.userId} not found on ${req.method} ${req.path}`);
      throw new UnauthorizedError('User not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
