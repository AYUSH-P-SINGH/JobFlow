import { AuthenticatedSocket } from './socket.types.js';
import { logger } from '../common/logger/logger.js';

export const ROOM_PREFIXES = {
  USER: 'room:user:',
  WORKFLOW: 'room:workflow:',
  ADMINS: 'room:admins',
};

/**
 * Handles default room associations on socket connection.
 */
export function handleDefaultRoomsJoin(socket: AuthenticatedSocket): void {
  if (!socket.user) return;

  // 1. Join personal user room
  const userRoom = `${ROOM_PREFIXES.USER}${socket.user.id}`;
  socket.join(userRoom);
  logger.debug(`Socket ${socket.id} joined personal room: ${userRoom}`);

  // 2. Join admin room if role is ADMIN
  if (socket.user.role === 'ADMIN') {
    socket.join(ROOM_PREFIXES.ADMINS);
    logger.debug(`Socket ${socket.id} joined admin room: ${ROOM_PREFIXES.ADMINS}`);
  }
}

/**
 * Register subscription/unsubscription listeners for workflow details rooms.
 */
export function registerRoomListeners(socket: AuthenticatedSocket): void {
  socket.on('join:workflow', ({ workflowId }) => {
    if (!workflowId) return;
    const room = `${ROOM_PREFIXES.WORKFLOW}${workflowId}`;
    socket.join(room);
    logger.debug(`Socket ${socket.id} subscribed to workflow room: ${room}`);
  });

  socket.on('leave:workflow', ({ workflowId }) => {
    if (!workflowId) return;
    const room = `${ROOM_PREFIXES.WORKFLOW}${workflowId}`;
    socket.leave(room);
    logger.debug(`Socket ${socket.id} unsubscribed from workflow room: ${room}`);
  });
}
