import prisma from '../../prisma.js';
import { logger } from '../../common/logger/logger.js';
import { BadRequestError } from '../../common/errors/errors.js';

export interface PolicyRules {
  allowedJobTypes?: string[];
  restrictedUsers?: string[];
  businessHours?: {
    start: string; // e.g. "09:00"
    end: string;   // e.g. "17:00"
  };
  maxParallelism?: number;
  maxRuntimeSeconds?: number;
}

export class PolicyEngine {
  /**
   * Evaluates if a workflow creation request conforms to all active policies.
   * Throws a BadRequestError if any policy rule is violated.
   */
  public static async evaluate(
    userId: string,
    tenantId: string | null,
    steps: { jobType: string }[]
  ): Promise<void> {
    logger.info(`Evaluating policies for User ${userId} and Tenant ${tenantId}...`);

    // 1. Fetch active policies (both global and tenant-specific)
    const activePolicies = await prisma.policy.findMany({
      where: {
        isActive: true,
        OR: [
          { tenantId },
          { tenantId: null }, // Global policies
        ],
      },
    });

    if (activePolicies.length === 0) {
      logger.info('No active policies found. Skipping policy evaluation.');
      return;
    }

    for (const policy of activePolicies) {
      const rules = policy.rules as unknown as PolicyRules;
      if (!rules) continue;

      logger.debug(`Evaluating Policy: "${policy.name}"...`);

      // A. Check Allowed Job Types
      if (rules.allowedJobTypes && rules.allowedJobTypes.length > 0) {
        const allowedTypes = new Set(rules.allowedJobTypes.map((t) => t.toUpperCase()));
        for (const step of steps) {
          const type = step.jobType.toUpperCase();
          if (!allowedTypes.has(type)) {
            const msg = `Policy Violation [${policy.name}]: Job type "${step.jobType}" is not allowed. Allowed types: ${rules.allowedJobTypes.join(', ')}`;
            await this.logViolation(userId, tenantId, policy.id, msg);
            throw new BadRequestError(msg);
          }
        }
      }

      // B. Check Restricted Users
      if (rules.restrictedUsers && rules.restrictedUsers.length > 0) {
        if (rules.restrictedUsers.includes(userId)) {
          const msg = `Policy Violation [${policy.name}]: User "${userId}" is restricted from executing workflows.`;
          await this.logViolation(userId, tenantId, policy.id, msg);
          throw new BadRequestError(msg);
        }
      }

      // C. Check Business Hours
      if (rules.businessHours) {
        const { start, end } = rules.businessHours;
        const now = new Date();
        const currentHourMin = now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }); // e.g. "14:30"

        if (currentHourMin < start || currentHourMin > end) {
          const msg = `Policy Violation [${policy.name}]: Workflows can only be executed during business hours (${start} to ${end}). Current time is ${currentHourMin}.`;
          await this.logViolation(userId, tenantId, policy.id, msg);
          throw new BadRequestError(msg);
        }
      }

      // D. Check Max Parallelism
      if (rules.maxParallelism && rules.maxParallelism > 0 && tenantId) {
        const runningCount = await prisma.workflow.count({
          where: {
            tenantId,
            status: 'RUNNING',
          },
        });

        if (runningCount >= rules.maxParallelism) {
          const msg = `Policy Violation [${policy.name}]: Maximum running workflows limit (${rules.maxParallelism}) reached for tenant.`;
          await this.logViolation(userId, tenantId, policy.id, msg);
          throw new BadRequestError(msg);
        }
      }
    }

    logger.info('Policy evaluation: PASSED');

    // Log successful policy decision for compliance
    await prisma.auditLog.create({
      data: {
        actor: userId,
        action: 'Policy Decision',
        resource: 'Workflow',
        tenantId,
        metadata: {
          decision: 'PASS',
          details: 'All active policies evaluated and passed successfully.',
        },
      },
    }).catch((err) => {
      logger.error(`Failed to log policy decision success: ${err.message}`);
    });
  }

  /**
   * Logs a policy violation event in the AuditLog database table.
   */
  private static async logViolation(
    userId: string,
    tenantId: string | null,
    policyId: string,
    message: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actor: userId,
          action: 'Policy Violation',
          resource: 'Workflow',
          tenantId,
          metadata: {
            policyId,
            error: message,
          },
        },
      });
    } catch (err) {
      logger.error(`Failed to log policy violation: ${(err as Error).message}`);
    }
  }
}
