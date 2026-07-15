import { Router } from 'express';
import { WorkerController } from './worker.controller.js';

const router = Router();

// Worker Registration
router.post('/register', WorkerController.register);

// Worker Heartbeat
router.post('/:id/heartbeat', WorkerController.heartbeat);

// Worker Draining
router.post('/:id/drain', WorkerController.drainWorker);

// Aggregated Scheduling Metrics (must be before /:id to avoid conflict)
router.get('/metrics', WorkerController.getMetrics);

// List All Workers
router.get('/', WorkerController.listWorkers);

// Get Single Worker
router.get('/:id', WorkerController.getWorker);

// Deregister Worker
router.delete('/:id', WorkerController.deregisterWorker);

export default router;
