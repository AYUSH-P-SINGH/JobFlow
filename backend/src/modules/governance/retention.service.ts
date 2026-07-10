import prisma from '../../prisma.js';
import { logger } from '../../common/logger/logger.js';

export class RetentionService {
  /**
   * Scans the database and cleans up finished workflows that exceed the retention period.
   * Default retention period is 90 days unless overridden per-tenant in TenantQuota.
   */
  public static async runCleanup(): Promise<void> {
    logger.info('=== Starting Data Retention Cleanup Job ===');

    try {
      // 1. Fetch all tenants
      const tenants = await prisma.tenant.findMany({
        include: { quota: true },
      });

      let totalDeleted = 0;

      // 2. Perform cleanup per tenant
      for (const tenant of tenants) {
        const retentionDays = tenant.quota?.retentionDays ?? 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        logger.debug(`Cleaning up workflows for tenant "${tenant.name}" (${tenant.id}) older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`);

        const deleteResult = await prisma.workflow.deleteMany({
          where: {
            tenantId: tenant.id,
            status: {
              in: ['COMPLETED', 'FAILED', 'CANCELLED'],
            },
            updatedAt: {
              lt: cutoffDate,
            },
          },
        });

        if (deleteResult.count > 0) {
          logger.info(`Deleted ${deleteResult.count} expired workflows for tenant "${tenant.name}".`);
          totalDeleted += deleteResult.count;
        }
      }

      // 3. Clean up orphaned workflows without a tenant (using default 90 days)
      const defaultCutoff = new Date();
      defaultCutoff.setDate(defaultCutoff.getDate() - 90);

      const defaultDelete = await prisma.workflow.deleteMany({
        where: {
          tenantId: null,
          status: {
            in: ['COMPLETED', 'FAILED', 'CANCELLED'],
          },
          updatedAt: {
            lt: defaultCutoff,
          },
        },
      });

      if (defaultDelete.count > 0) {
        logger.info(`Deleted ${defaultDelete.count} orphaned/global expired workflows.`);
        totalDeleted += defaultDelete.count;
      }

      logger.info(`=== Data Retention Cleanup Completed. Total workflows purged: ${totalDeleted} ===`);
    } catch (error) {
      logger.error(`Data retention cleanup job failed: ${(error as Error).message}`);
    }
  }
}
