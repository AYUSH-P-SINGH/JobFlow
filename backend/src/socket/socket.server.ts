import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socket.types.js';
import { socketAuthMiddleware } from './socket.middleware.js';
import { handleDefaultRoomsJoin, registerRoomListeners } from './socket.rooms.js';
import { SocketGateway } from './socket.gateway.js';
import { logger } from '../common/logger/logger.js';

let io: Server | null = null;
let gateway: SocketGateway | null = null;

/**
 * Initializes the Socket.IO server and binds it to the HTTP server.
 */
export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Enforce JWT authentication
  io.use(socketAuthMiddleware as any);

  // Initialize event mapping gateway
  gateway = new SocketGateway(io);

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Socket client connected: ID ${socket.id}, User: ${socket.user?.email}`);

    // Join user-specific and role-specific rooms
    handleDefaultRoomsJoin(socket);

    // Register room subscriptions (e.g. joining workflow room)
    registerRoomListeners(socket);

    // Hook join:workflow to automatically replay cached events for that workflow
    socket.on('join:workflow', ({ workflowId }) => {
      if (gateway && workflowId) {
        gateway.replayEvents(workflowId, socket);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ID ${socket.id}`);
    });
  });

  logger.info('Socket.IO server initialized successfully');
  return io;
}

/**
 * Returns the active Socket.IO server instance.
 */
export function getSocketServer(): Server {
  if (!io) {
    throw new Error('Socket.IO server is not initialized');
  }
  return io;
}

/**
 * Gracefully shuts down the Socket.IO server.
 */
export async function closeSocketServer(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => {
        logger.info('Socket.IO server closed');
        resolve();
      });
    });
    io = null;
    gateway = null;
  }
}
