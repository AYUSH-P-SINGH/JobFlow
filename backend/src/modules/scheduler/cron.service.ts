import prisma from '../../prisma.js';
import { createQueue } from '../../queues/queue.factory.js';
import { QueueNames } from '../../queues/queue.constants.js';
import { logger } from '../../common/logger/logger.js';
import { NotFoundError } from '../../common/errors/errors.js';

export class CronService {
  /**
   * Helper to get or initialize the scheduler queue
   */
  private static getSchedulerQueue() {
    return createQueue(QueueNames.SCHEDULER_QUEUE);
  }

  /**
   * Register a new cron schedule
   */
  public static async createSchedule(
    name: string,
    cron: string,
    templateId: string,
    tenantId: string
  ) {
    // Verify template exists
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundError('Workflow template not found');
    }

    const schedule = await prisma.workflowSchedule.create({
      data: {
        name,
        cron,
        templateId,
        tenantId,
        isActive: true,
      },
    });

    // Add repeatable job to BullMQ
    const queue = this.getSchedulerQueue();
    await queue.add(
      schedule.id,
      { templateId, tenantId },
      {
        repeat: { pattern: cron },
        jobId: schedule.id,
      }
    );

    logger.info(`Scheduled template ${templateId} with Cron "${cron}" (ID: ${schedule.id})`);
    return schedule;
  }

  /**
   * Remove/Delete a schedule
   */
  public static async deleteSchedule(id: string, tenantId: string) {
    const schedule = await prisma.workflowSchedule.findFirst({
      where: { id, tenantId },
    });
    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    await prisma.workflowSchedule.delete({
      where: { id },
    });

    // Remove repeatable job from BullMQ
    const queue = this.getSchedulerQueue();
    const repeatableJobs = await queue.getRepeatableJobs();
    const targetJob = repeatableJobs.find(
      (job) => job.id === id || job.name === id
    );

    if (targetJob) {
      await queue.removeRepeatableByKey(targetJob.key);
      logger.info(`Removed Repeatable Job from BullMQ: ${id}`);
    }

    logger.info(`Deleted Cron Schedule: ${id}`);
  }

  /**
   * List schedules for a tenant
   */
  public static async listSchedules(tenantId: string) {
    return prisma.workflowSchedule.findMany({
      where: { tenantId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Initialize all active database schedules on startup
   */
  public static async initSchedules() {
    try {
      const activeSchedules = await prisma.workflowSchedule.findMany({
        where: { isActive: true },
      });

      const queue = this.getSchedulerQueue();

      // Clear existing repeatables to avoid double registering stale cron patterns
      const repeatables = await queue.getRepeatableJobs();
      for (const r of repeatables) {
        await queue.removeRepeatableByKey(r.key);
      }

      for (const schedule of activeSchedules) {
        await queue.add(
          schedule.id,
          { templateId: schedule.templateId, tenantId: schedule.tenantId },
          {
            repeat: { pattern: schedule.cron },
            jobId: schedule.id,
          }
        );
      }

      logger.info(`Successfully synchronized ${activeSchedules.length} active cron schedules.`);
    } catch (error) {
      logger.error('Failed to initialize active cron schedules:', error);
    }
  }
}
