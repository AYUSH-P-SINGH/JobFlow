import { Request, Response, NextFunction } from 'express';
import prisma from '../../prisma.js';

export class AnalyticsController {
  /**
   * Get Tenant-scoped usage and execution metrics
   */
  public static async getTenantAnalytics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || 'default-tenant-id';

      // 1. Total Workflow Executions count
      const totalExecutions = await prisma.workflow.count({
        where: { tenantId },
      });

      // 2. Counts grouped by Workflow status
      const executionsByStatus = await prisma.workflow.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: {
          id: true,
        },
      });

      const statusMap = {
        PENDING: 0,
        RUNNING: 0,
        COMPLETED: 0,
        FAILED: 0,
        CANCELLED: 0,
      };

      for (const group of executionsByStatus) {
        if (group.status in statusMap) {
          statusMap[group.status as keyof typeof statusMap] = group._count.id;
        }
      }

      // 3. Compute Success rate percentage
      const completedCount = statusMap.COMPLETED;
      const failedCount = statusMap.FAILED;
      const totalFinished = completedCount + failedCount;
      const successRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 100;

      // 4. Counts of other registered tenant assets
      const [apiKeysCount, webhooksCount, schedulesCount] = await Promise.all([
        prisma.apiKey.count({ where: { tenantId } }),
        prisma.webhook.count({ where: { tenantId } }),
        prisma.workflowSchedule.count({ where: { tenantId } }),
      ]);

      // 5. Average execution duration of completed runs (mocked or aggregated from histories)
      // Since Workflow step runs have startedAt/completedAt, we can compute average execution durations:
      const completedRuns = await prisma.workflow.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
        take: 50, // limit query payload
      });

      let totalDurationMs = 0;
      for (const run of completedRuns) {
        totalDurationMs += run.updatedAt.getTime() - run.createdAt.getTime();
      }
      const avgDurationSec = completedRuns.length > 0 ? (totalDurationMs / completedRuns.length) / 1000 : 0;

      res.status(200).json({
        data: {
          executions: {
            total: totalExecutions,
            successRatePercent: successRate,
            avgDurationSec: parseFloat(avgDurationSec.toFixed(2)),
            byStatus: statusMap,
          },
          quotas: {
            activeApiKeys: apiKeysCount,
            activeWebhooks: webhooksCount,
            activeSchedules: schedulesCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
