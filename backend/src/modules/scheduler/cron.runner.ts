import { Worker } from 'bullmq';
import { QueueNames } from '../../queues/queue.constants.js';
import { createQueueOptions } from '../../config/bullmq.js';
import { TemplateService } from '../workflow/template.service.js';
import { logger } from '../../common/logger/logger.js';

let cronWorker: Worker | null = null;

export function startCronWorker(): Worker {
  if (cronWorker) return cronWorker;

  const defaultOpts = createQueueOptions(QueueNames.SCHEDULER_QUEUE);

  cronWorker = new Worker(
    QueueNames.SCHEDULER_QUEUE,
    async (job) => {
      const { templateId, tenantId } = job.data;
      logger.info(`[CronRunner] Firing cron schedule for template ${templateId} in Tenant ${tenantId}`);
      try {
        await TemplateService.startExecution(
          templateId,
          'cron-system-actor',
          tenantId,
          undefined,
          'CRON',
          { jobId: job.id, fireTime: new Date().toISOString() }
        );
      } catch (err) {
        logger.error(`[CronRunner] Failed to execute cron template ${templateId}: ${(err as Error).message}`);
        throw err;
      }
    },
    {
      connection: defaultOpts.connection,
      concurrency: 5,
    }
  );

  cronWorker.on('failed', (job, err) => {
    logger.error(`[CronRunner] Cron repeatable job ${job?.id} failed: ${err.message}`);
  });

  logger.info('[CronRunner] Cron Scheduler Worker initialized');
  return cronWorker;
}

export async function stopCronWorker(): Promise<void> {
  if (cronWorker) {
    await cronWorker.close();
    cronWorker = null;
    logger.info('[CronRunner] Cron Scheduler Worker closed');
  }
}
