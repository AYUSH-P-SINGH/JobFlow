import { Server } from 'socket.io';
import { eventBus } from '../events/event.bus.js';
import { ROOM_PREFIXES } from './socket.rooms.js';
import prisma from '../prisma.js';
import { logger } from '../common/logger/logger.js';

/**
 * SocketGateway handles routing internal events from the Event Bus to authenticated WebSocket clients.
 */
export class SocketGateway {
  private io: Server;
  private throttleMap: Map<string, number> = new Map();
  // History of recent events per workflow to support client reconnection replay
  private eventCache: Map<string, Array<{ event: string; payload: any }>> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.initializeSubscriptions();
  }

  /**
   * Listen to the internal Event Bus and dispatch events to Socket.IO.
   */
  private initializeSubscriptions(): void {
    // Workflow Lifecycle Events
    eventBus.subscribe('workflow.started', (payload) => this.handleWorkflowEvent('workflow.started', payload));
    eventBus.subscribe('workflow.updated', (payload) => this.handleWorkflowEvent('workflow.updated', payload));
    eventBus.subscribe('workflow.completed', (payload) => this.handleWorkflowEvent('workflow.completed', payload));
    eventBus.subscribe('workflow.failed', (payload) => this.handleWorkflowEvent('workflow.failed', payload));
    eventBus.subscribe('workflow.cancelled', (payload) => this.handleWorkflowEvent('workflow.cancelled', payload));

    // Job Execution Events
    eventBus.subscribe('job.started', (payload) => this.handleJobEvent('job.started', payload));
    eventBus.subscribe('job.progress', (payload) => this.handleJobEvent('job.progress', payload));
    eventBus.subscribe('job.completed', (payload) => this.handleJobEvent('job.completed', payload));
    eventBus.subscribe('job.failed', (payload) => this.handleJobEvent('job.failed', payload));
    eventBus.subscribe('job.cancelled', (payload) => this.handleJobEvent('job.cancelled', payload));
  }

  /**
   * Broadcast workflow events to the owner user's room and the workflow's specific tracking room.
   */
  private handleWorkflowEvent(event: string, payload: any): void {
    const { workflow } = payload;
    const userRoom = `${ROOM_PREFIXES.USER}${workflow.userId}`;
    const workflowRoom = `${ROOM_PREFIXES.WORKFLOW}${workflow.id}`;

    this.io.to(userRoom).to(workflowRoom).emit(event, payload);
    logger.debug(`[SocketGateway] Broadcasted ${event} for Workflow ${workflow.id}`);

    // Cache the event for future reconnection replays
    this.cacheEvent(workflow.id, event, payload);
  }

  /**
   * Broadcast job events to the workflow details room it belongs to and the admin room.
   */
  private async handleJobEvent(event: string, payload: any): Promise<void> {
    const { job } = payload;

    // Rate limit progress updates to max once every 200ms per job
    if (event === 'job.progress') {
      const lastEmit = this.throttleMap.get(job.id) || 0;
      const now = Date.now();
      if (now - lastEmit < 200) {
        return;
      }
      this.throttleMap.set(job.id, now);
    }

    // Try to resolve if this job is linked to a workflow step
    const step = await prisma.workflowStep.findUnique({
      where: { jobId: job.id },
    });

    if (step) {
      const workflowRoom = `${ROOM_PREFIXES.WORKFLOW}${step.workflowId}`;
      this.io.to(workflowRoom).emit(event, payload);
      logger.debug(`[SocketGateway] Broadcasted ${event} for Job ${job.id} to Workflow ${step.workflowId}`);

      // Cache the event under the workflowId key
      this.cacheEvent(step.workflowId, event, payload);
    }

    // Stream all job executions to the administrator dashboard
    this.io.to(ROOM_PREFIXES.ADMINS).emit(event, payload);
  }

  /**
   * Caches the event in a workflow-specific ring buffer.
   */
  private cacheEvent(workflowId: string, event: string, payload: any): void {
    const history = this.eventCache.get(workflowId) || [];
    history.push({ event, payload });
    if (history.length > 20) {
      history.shift();
    }
    this.eventCache.set(workflowId, history);
  }

  /**
   * Replays cached workflow and job events to a reconnected client.
   */
  public replayEvents(workflowId: string, socket: any): void {
    const history = this.eventCache.get(workflowId);
    if (history && history.length > 0) {
      logger.debug(`[SocketGateway] Replaying ${history.length} cached events for Workflow ${workflowId} to Socket ${socket.id}`);
      for (const cached of history) {
        socket.emit(cached.event, cached.payload);
      }
    }
  }
}
