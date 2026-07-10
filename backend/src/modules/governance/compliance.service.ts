import { AuditService } from '../monitoring/audit.service.js';

export class ComplianceService {
  /**
   * Records workflow initiation audit event.
   */
  public static async logWorkflowStart(
    userId: string,
    workflowId: string,
    name: string
  ): Promise<void> {
    await AuditService.log(userId, 'Workflow Started', 'Workflow', { workflowId, name });
  }

  /**
   * Records workflow cancellation audit event.
   */
  public static async logWorkflowCancellation(
    userId: string,
    workflowId: string
  ): Promise<void> {
    await AuditService.log(userId, 'Workflow Cancelled', 'Workflow', { workflowId });
  }

  /**
   * Records policy decision results (PASS or FAIL).
   */
  public static async logPolicyDecision(
    userId: string,
    policyId: string,
    rule: string,
    decision: 'PASS' | 'FAIL',
    details: string
  ): Promise<void> {
    await AuditService.log(userId, 'Policy Decision', 'Policy', {
      policyId,
      rule,
      decision,
      details,
    });
  }

  /**
   * Records API key authorization and usage.
   */
  public static async logApiKeyUsage(
    keyId: string,
    tenantId: string,
    path: string,
    method: string
  ): Promise<void> {
    await AuditService.log('api-key-actor', 'API Key Used', 'ApiKey', {
      keyId,
      tenantId,
      path,
      method,
    });
  }

  /**
   * Records configuration changes (e.g. templates, webhooks, or scheduled tasks).
   */
  public static async logConfigChange(
    userId: string,
    action: string,
    resource: string,
    details: any
  ): Promise<void> {
    await AuditService.log(userId, action, resource, details);
  }
}
