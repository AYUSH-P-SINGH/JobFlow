import { Request, Response } from 'express';
import { WorkerService } from './worker.service.js';
import { registerWorkerSchema, heartbeatSchema, drainWorkerSchema } from './worker.validation.js';
import { logger } from '../../common/logger/logger.js';

export class WorkerController {
  /**
   * POST /api/v1/workers/register
   * Register a new worker node.
   */
  static async register(req: Request, res: Response) {
    try {
      const data = registerWorkerSchema.parse(req.body);
      const worker = await WorkerService.registerWorker(data);
      res.status(201).json({
        message: 'Worker registered successfully',
        worker,
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`[WorkerController] Registration failed: ${err.message}`);
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: err });
      }
      res.status(500).json({ error: 'Failed to register worker', message: err.message });
    }
  }

  /**
   * POST /api/v1/workers/:id/heartbeat
   * Send a heartbeat update from a worker.
   */
  static async heartbeat(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = heartbeatSchema.parse(req.body);
      const worker = await WorkerService.heartbeat(id, data);
      res.status(200).json({
        message: 'Heartbeat received',
        worker: {
          id: worker.id,
          status: worker.status,
          lastHeartbeat: worker.lastHeartbeat,
          runningJobs: worker.runningJobs,
          currentLoad: worker.currentLoad,
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      logger.error(`[WorkerController] Heartbeat failed: ${err.message}`);
      res.status(500).json({ error: 'Heartbeat failed', message: err.message });
    }
  }

  /**
   * GET /api/v1/workers
   * List all registered workers.
   */
  static async listWorkers(req: Request, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const workers = await WorkerService.getAllWorkers(status);
      res.status(200).json({
        count: workers.length,
        workers,
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`[WorkerController] List workers failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to list workers', message: err.message });
    }
  }

  /**
   * GET /api/v1/workers/metrics
   * Get aggregated worker and scheduling metrics.
   */
  static async getMetrics(req: Request, res: Response) {
    try {
      const metrics = await WorkerService.getWorkerMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      const err = error as Error;
      logger.error(`[WorkerController] Get metrics failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to get metrics', message: err.message });
    }
  }

  /**
   * GET /api/v1/workers/:id
   * Get a single worker by ID.
   */
  static async getWorker(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const worker = await WorkerService.getWorker(id);
      res.status(200).json(worker);
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      logger.error(`[WorkerController] Get worker failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to get worker', message: err.message });
    }
  }

  /**
   * POST /api/v1/workers/:id/drain
   * Start draining a worker (stop accepting new jobs).
   */
  static async drainWorker(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = drainWorkerSchema.parse(req.body);
      const worker = await WorkerService.drainWorker(id, data.reason);
      res.status(200).json({
        message: 'Worker is now draining',
        worker,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes('already')) {
        return res.status(409).json({ error: err.message });
      }
      logger.error(`[WorkerController] Drain worker failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to drain worker', message: err.message });
    }
  }

  /**
   * DELETE /api/v1/workers/:id
   * Deregister a worker.
   */
  static async deregisterWorker(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await WorkerService.deregisterWorker(id);
      res.status(200).json({
        message: 'Worker deregistered',
        ...result,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      logger.error(`[WorkerController] Deregister worker failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to deregister worker', message: err.message });
    }
  }
}
