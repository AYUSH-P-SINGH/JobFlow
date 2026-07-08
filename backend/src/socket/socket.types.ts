import { Socket } from 'socket.io';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUser;
}

export interface SocketEventThrottlerOptions {
  limit: number;     // max events
  windowMs: number;  // time window in ms
}
