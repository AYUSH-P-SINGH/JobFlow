import { AuthenticatedSocket } from './socket.types.js';
import { verifyAccessToken } from '../common/utils/jwt.js';
import { userRepository } from '../modules/auth/auth.repository.js';
import { logger } from '../common/logger/logger.js';

/**
 * Socket.IO connection authentication middleware using JWT.
 */
export async function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) {
      logger.warn('[SocketAuth] Authentication failed: Missing token');
      return next(new Error('Authentication error: Token missing'));
    }

    // Verify token
    let decoded: { userId: string; email: string; role: string } | null = null;
    try {
      decoded = verifyAccessToken(token) as unknown as { userId: string; email: string; role: string };
    } catch (err) {
      logger.warn(`[SocketAuth] Authentication failed: ${(err as Error).message}`);
      return next(new Error('Authentication error: Token invalid or expired'));
    }

    if (!decoded) {
      logger.warn('[SocketAuth] Authentication failed: Decoded payload empty');
      return next(new Error('Authentication error: Token invalid or expired'));
    }

    // Verify user exists in database
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      logger.warn(`[SocketAuth] Authentication failed: User ${decoded.userId} not found`);
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    logger.debug(`[SocketAuth] User ${user.email} authenticated for socket connection`);
    next();
  } catch (error) {
    logger.error(`[SocketAuth] Error authenticating socket: ${(error as Error).message}`);
    next(new Error('Authentication error: Internal server error'));
  }
}
