import prisma from '../prisma.js';
import os from 'os';

export class AnalyticsService {
  /**
   * Generates a platform performance and usage analytics report.
   */
  public static async getAnalytics(): Promise<any> {
    // 1. Calculate Average Runtime of Completed Workflows
    const completedWorkflows = await prisma.workflow.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    let avgRuntimeMs = 0;
    if (completedWorkflows.length > 0) {
      const totalRuntimeMs = completedWorkflows.reduce((sum, wf) => {
        return sum + (new Date(wf.updatedAt).getTime() - new Date(wf.createdAt).getTime());
      }, 0);
      avgRuntimeMs = totalRuntimeMs / completedWorkflows.length;
    }

    // 2. Count Workflow Statuses (Failures vs Success ratio)
    const successCount = await prisma.workflow.count({ where: { status: 'COMPLETED' } });
    const failureCount = await prisma.workflow.count({ where: { status: 'FAILED' } });
    const cancelledCount = await prisma.workflow.count({ where: { status: 'CANCELLED' } });
    const runningCount = await prisma.workflow.count({ where: { status: 'RUNNING' } });

    // 3. Most Used Templates
    const templates = await prisma.workflowTemplate.findMany({
      include: {
        versions: {
          select: {
            id: true,
            _count: {
              select: { executions: true },
            },
          },
        },
      },
      take: 5,
    });

    const mostUsedTemplates = templates
      .map((t) => {
        const executions = t.versions.reduce((sum, v) => sum + v._count.executions, 0);
        return {
          templateId: t.id,
          name: t.name,
          executions,
        };
      })
      .sort((a, b) => b.executions - a.executions);

    // 4. Top Job Types / Plugins Used
    const stepsGrouping = await prisma.workflowStep.groupBy({
      by: ['jobType'],
      _count: {
        id: true,
      },
    });

    const topPlugins = stepsGrouping
      .map((g) => ({
        pluginId: g.jobType,
        invocations: g._count.id,
      }))
      .sort((a, b) => b.invocations - a.invocations);

    // 5. Host & Worker Utilization
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUtilization = ((totalMem - freeMem) / totalMem) * 100;

    return {
      performance: {
        avgRuntimeMs: Math.round(avgRuntimeMs),
        completedWorkflows: successCount,
        failedWorkflows: failureCount,
        cancelledWorkflows: cancelledCount,
        activeWorkflowsCount: runningCount,
      },
      marketplace: {
        mostUsedTemplates,
        topPlugins,
      },
      infrastructure: {
        memoryUtilizationPercent: Math.round(memUtilization),
        totalMemoryBytes: totalMem,
        freeMemoryBytes: freeMem,
        cpuCoresCount: os.cpus().length,
        systemUptimeSeconds: os.uptime(),
      },
    };
  }
}
