import prisma from '../../prisma.js';
import { logger } from '../../common/logger/logger.js';

export interface FeatureFlagRules {
  allowedTenants?: string[];
  percentage?: number; // 0 to 100
}

export class FeatureService {
  /**
   * Evaluates if a feature flag is enabled for the current context.
   */
  public static async isEnabled(
    key: string,
    context?: { tenantId?: string }
  ): Promise<boolean> {
    try {
      const flag = await prisma.featureFlag.findUnique({
        where: { key },
      });

      if (!flag) {
        logger.debug(`Feature flag "${key}" not found in database. Defaulting to false.`);
        return false;
      }

      if (!flag.enabled) {
        return false;
      }

      const rules = flag.rules as unknown as FeatureFlagRules;
      if (!rules) {
        return true;
      }

      // Check allowed tenants rule
      if (rules.allowedTenants && rules.allowedTenants.length > 0) {
        const tenantId = context?.tenantId;
        if (!tenantId || !rules.allowedTenants.includes(tenantId)) {
          return false;
        }
      }

      // Check percentage rollout rule
      if (rules.percentage !== undefined) {
        const tenantId = context?.tenantId;
        if (tenantId) {
          // Deterministic hash based on tenant ID to keep feature toggle sticky
          let hash = 0;
          for (let i = 0; i < tenantId.length; i++) {
            hash = tenantId.charCodeAt(i) + ((hash << 5) - hash);
          }
          const score = Math.abs(hash) % 100;
          return score < rules.percentage;
        } else {
          // Random rollout score if no context is provided
          return Math.random() * 100 < rules.percentage;
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error checking feature flag "${key}": ${(error as Error).message}`);
      return false;
    }
  }
}
