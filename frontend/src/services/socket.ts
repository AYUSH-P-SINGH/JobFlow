import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  public connect(baseUrl: string, token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(baseUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('✔ Socket.IO connected to backend:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('✖ Socket.IO disconnected:', reason);
    });

    // Register active local event listeners
    this.socket.onAny((eventName, ...args) => {
      const callbacks = this.listeners.get(eventName);
      if (callbacks) {
        callbacks.forEach((cb) => cb(...args));
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public subscribeWorkflow(workflowId: string) {
    if (this.socket) {
      console.log('Subscribing to workflow events room:', workflowId);
      this.socket.emit('join:workflow', { workflowId });
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: (...args: any[]) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
}

export const socketService = new SocketService();
