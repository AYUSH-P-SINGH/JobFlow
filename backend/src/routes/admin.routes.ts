import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getAllQueues } from '../queues/queue.factory.js';

/**
 * Creates and configures the Bull Board admin dashboard.
 * Must be called AFTER queues have been initialized (i.e., after initJobQueue()).
 */
export function createAdminRouter(): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queues = getAllQueues();

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  return serverAdapter.getRouter() as unknown as Router;
}
